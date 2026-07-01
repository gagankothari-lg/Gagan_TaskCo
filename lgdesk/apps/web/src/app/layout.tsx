import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../contexts/auth-context';
import { cn } from '../lib/utils';

// LGDesk_Master_Reference.md Part 8 — Montserrat, weights 300-800, loaded via
// next/font/google (no CDN <link>). The --font-montserrat variable is
// consumed by tailwind.config.ts (fontFamily.sans) and globals.css (body).
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  title: 'LG Desk',
  description: 'Leveraged Growth internal workspace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(montserrat.variable, 'font-sans')}>
      <body>
        <AuthProvider>{children}</AuthProvider>
        {/* Global toast mount — bottom-right stack (see lib/toast). */}
        <div id="toasts" />
      </body>
    </html>
  );
}
