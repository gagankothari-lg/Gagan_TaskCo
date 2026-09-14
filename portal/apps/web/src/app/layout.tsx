import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';

// P27: same font-loading pattern as lgdesk/apps/web/src/app/layout.tsx.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // P29: suppressHydrationWarning is required with next-themes -- the theme class is
    // applied client-side before hydration (via next-themes' injected script) based on
    // localStorage/system preference the server can't know, which would otherwise cause
    // a benign hydration-mismatch warning on <html>. Same setup as LGDesk's own layout.tsx.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
