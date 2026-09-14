'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

// P29: same toggle pattern as LGDesk's layout-client.tsx (a small icon button flipping
// next-themes' resolvedTheme). `mounted` guards against a hydration mismatch --
// resolvedTheme is only known client-side (localStorage/system preference), so the
// server-rendered icon would otherwise briefly disagree with the client's real theme.
//
// `variant` covers the two contexts this renders in: 'surface' (login/register cards,
// the topbar -- both always a light var(--surface)/var(--p3) regardless of theme choice
// for the page *content*) vs 'sidebar' (the always-dark-navy sidebar, styled like the
// adjacent logout icon instead of a light chip that would look out of place there).
export function ThemeToggle({ variant = 'surface', className }: { variant?: 'surface' | 'sidebar'; className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className={className} style={{ width: 24, height: 24 }} />;

  const isDark = resolvedTheme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  const style =
    variant === 'sidebar'
      ? undefined
      : {
          display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
          width: 24, height: 24, borderRadius: '50%', background: 'var(--p3)', border: 'none',
          color: 'var(--p)', cursor: 'pointer', flexShrink: 0,
        };

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className={variant === 'sidebar' ? `text-white/70 hover:text-white shrink-0 p-1 ${className ?? ''}` : className}
      style={style}
    >
      {isDark ? <Sun size={variant === 'sidebar' ? 17 : 14} /> : <Moon size={variant === 'sidebar' ? 17 : 14} />}
    </button>
  );
}
