import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        p:       '#1a237e',
        p2:      '#3949ab',
        p3:      '#e8eaf6',
        accent:  '#00897b',
        danger:  '#c62828',
        warn:    '#e65100',
        ok:      '#2e7d32',
        bg:      '#f0f2f5',
        surface: '#ffffff',
        border:  '#e0e0e0',
        muted:   '#757575',
        muted2:  '#9e9e9e',
      },
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
      },
      borderRadius: { DEFAULT: '8px' },
      boxShadow: { card: '0 2px 8px rgba(0,0,0,.1)' },
    },
  },
  plugins: [],
};
export default config;
