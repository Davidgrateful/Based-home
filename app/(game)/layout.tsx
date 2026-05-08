import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { GameSidebar } from '@/components/game/GameSidebar';

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-void)' }}>
      <GameSidebar userId={session.user.id} userName={session.user.email ?? ''} />
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
