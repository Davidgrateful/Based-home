import { redirect } from 'next/navigation';
import { auth } from './(auth)/auth';

export default async function RootPage() {
  const session = await auth();
  if (session?.user) redirect('/game');
  redirect('/login');
}
