import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { auth } from './(auth)/auth';

// Reads the session (request data), so it renders inside Suspense under cacheComponents.
export default function RootPage() {
  return (
    <Suspense fallback={null}>
      <RootRedirect />
    </Suspense>
  );
}

async function RootRedirect() {
  const session = await auth();
  if (session?.user) redirect('/game');
  redirect('/login');
  return null;
}
