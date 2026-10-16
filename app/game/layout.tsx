import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { auth } from '@/app/(auth)/auth';
import { GameSidebar } from '@/components/game/GameSidebar';

// The session is request data: with cacheComponents on it has to be read
// inside a Suspense boundary (same pattern as the chat layout).
export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-void)' }} />}>
      <GameShell>{children}</GameShell>
    </Suspense>
  );
}

async function GameShell({ children }: { children: React.ReactNode }) {
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
