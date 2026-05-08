"use server";

import { z } from "zod";

import { createUser, getUser } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { character, skill, home } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { emptyLayout } from "@/lib/game/homeRooms";

import { signIn } from "./auth";

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
};

export const login = async (
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export type RegisterActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
};

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const [existingUser] = await getUser(validatedData.email);

    if (existingUser) {
      return { status: "user_exists" } as RegisterActionState;
    }

    await createUser(validatedData.email, validatedData.password);
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    // Auto-create character if class and name provided
    const characterClass = formData.get("characterClass") as string | null;
    const characterName = formData.get("characterName") as string | null;
    const [newUser] = await getUser(validatedData.email);
    if (characterClass && characterName && newUser?.id) {
      const [existing] = await db.select().from(character).where(eq(character.name, characterName)).limit(1);
      if (!existing) {
        const shieldDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const [newChar] = await db.insert(character).values({
          userId: newUser.id,
          name: characterName,
          class: characterClass as 'warrior' | 'mage' | 'ranger',
          shieldExpiresAt: shieldDate,
        }).returning();
        const skillNames = ['mining', 'crafting', 'engineering', 'fishing', 'cooking', 'architecture', 'combat', 'alchemy', 'trading', 'hacking'] as const;
        await db.insert(skill).values(skillNames.map(s => ({ characterId: newChar.id, name: s, level: 1, xp: 0 })));
        await db.insert(home).values({ ownerId: newChar.id, name: `${characterName}'s Home`, layout: emptyLayout(3) as any, unlockedSize: 3 });
      }
    }

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};
