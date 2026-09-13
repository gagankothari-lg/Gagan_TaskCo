import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// P27: same font-loading pattern as lgdesk/apps/web/src/app/layout.tsx.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
