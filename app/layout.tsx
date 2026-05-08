import type { Metadata } from 'next';
import { SessionProvider } from 'next-auth/react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Base Home: District Wars',
  description: 'A persistent browser MMO. Build your home. Raid rivals. Control districts. Dominate the Grid.',
  icons: { icon: '/favicon.ico' },
};

export const viewport = { maximumScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
