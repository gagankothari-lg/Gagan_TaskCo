import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import { AuthProvider } from '../contexts/auth-context';
import { cn } from '../lib/utils';
import { KeepAlivePing } from '../components/keep-alive-ping';

// design.md — Inter, weights 400-800, loaded via next/font/google (no CDN
// <link>). The --font-inter variable is consumed by tailwind.config.ts
// (fontFamily.sans) and globals.css (body).
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'LG Desk',
  description: 'Leveraged Growth internal workspace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(inter.variable, 'font-sans')} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <KeepAlivePing />
          <AuthProvider>{children}</AuthProvider>
          {/* Global toast mount — bottom-right stack (see lib/toast). */}
          <div id="toasts" />
        </ThemeProvider>
      </body>
    </html>
  );
}
