import type { Config } from 'tailwindcss';

// P27: same brand tokens as LGDesk (lgdesk/apps/web/tailwind.config.ts), backed by the
// same-named CSS custom properties in globals.css -- one design language, two apps.
// Portal has no dark mode (nothing asked for one; kept deliberately out of scope).
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        p: 'var(--p)',
        p2: 'var(--p2)',
        p3: 'var(--p3)',
        accent: 'var(--accent)',
        danger: 'var(--danger)',
        warn: 'var(--warn)',
        ok: 'var(--ok)',
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        muted2: 'var(--muted2)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: 'var(--r)',
      },
      boxShadow: { card: 'var(--sh)' },
      width: {
        sidebar: 'var(--sidebar-width)',
      },
      spacing: {
        hh: 'var(--hh)',
      },
    },
  },
  plugins: [],
};
export default config;
