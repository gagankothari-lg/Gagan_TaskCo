import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../contexts/auth-context';

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
    <html lang="en" className={montserrat.variable}>
      <head>
        {/* Material Symbols Outlined — the only icon set (no Lucide). */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,300,0,0"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: 'Montserrat, sans-serif' }}>
        <AuthProvider>{children}</AuthProvider>
        {/* Global toast mount — bottom-right stack (see lib/toast). */}
        <div id="toasts" />
      </body>
    </html>
  );
}
