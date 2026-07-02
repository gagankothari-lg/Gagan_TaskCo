import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand tokens — LGDesk_Master_Reference.md Part 8 + Part 37
        //    checklist. Backed by CSS custom properties in globals.css so
        //    there is exactly one source of truth per value.
        p:       'var(--p)',
        p2:      'var(--p2)',
        p3:      'var(--p3)',
        accent:  'var(--accent)',
        danger:  'var(--danger)',
        warn:    'var(--warn)',
        ok:      'var(--ok)',
        bg:      'var(--bg)',
        surface: 'var(--surface)',
        border:  'var(--border)',
        text:    'var(--text)',
        muted:   {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        muted2:  'var(--muted2)',
        hover:   'var(--hover)',

        // ── shadcn/ui semantic aliases — same CSS vars, shadcn's own
        //    expected names, so `bg-primary`/`text-danger`-style utilities
        //    and shadcn-generated components read from one token system.
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        input: 'var(--input)',
        ring: 'var(--ring)',
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'Montserrat', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: 'var(--r)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: { card: 'var(--sh)' },
      width: {
        sidebar: 'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-collapsed)',
      },
      spacing: {
        hh: 'var(--hh)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
