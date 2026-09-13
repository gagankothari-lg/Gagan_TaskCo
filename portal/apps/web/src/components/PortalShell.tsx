'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, UserRound, UserCheck, FileEdit, LogOut } from 'lucide-react';
import { apiFetch, clearToken } from '../lib/api';
import { isManager } from '../lib/auth';
import type { Me } from '../lib/useMe';

// P27: LGDesk's own sidebar shell (layout-client.tsx), simplified to Portal's much
// smaller nav set. Same gate pattern LGDesk itself uses for admin-only nav items
// (`gate: 'manager'` -> isManager(role), evaluated at render time) -- not a new
// authorization concept, the same one already live in LGDesk's sidebar.
type NavItem = { label: string; icon: typeof LayoutGrid; href: string; gate?: 'manager' };

const NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutGrid, href: '/dashboard' },
  { label: 'My Profile', icon: UserRound, href: '/profile' },
  { label: 'Registration Approvals', icon: UserCheck, href: '/registration', gate: 'manager' },
  { label: 'Profile Update Approvals', icon: FileEdit, href: '/profile-updates', gate: 'manager' },
];

export function PortalShell({ me, title, children }: { me: Me; title: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const manager = isManager(me.role);

  async function onLogout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Best-effort — clear locally regardless of server outcome (matches LGDesk's logout()).
    }
    clearToken();
    router.replace('/');
  }

  return (
    <div className="min-h-screen flex">
      <aside id="sidebar" className="w-sidebar shrink-0 bg-p flex flex-col text-white">
        <div className="h-hh flex items-center gap-2 px-5 border-b border-white/10 font-bold text-lg">
          Portal
        </div>
        <nav className="flex-1 py-3">
          {NAV.filter((it) => !it.gate || manager).map((it) => {
            const active = pathname === it.href;
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors border-l-[3px] ${
                  active
                    ? 'bg-white/10 border-white font-semibold text-white'
                    : 'border-transparent text-white/75 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={17} />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-p2 flex items-center justify-center text-sm font-bold shrink-0">
            {me.firstName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{me.name}</div>
            <div className="text-xs text-white/60 truncate">{me.role}</div>
          </div>
          <button onClick={onLogout} title="Log out" className="text-white/70 hover:text-white shrink-0">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <div id="main" className="flex-1 min-w-0">
        <header className="h-hh bg-surface border-b border-border flex items-center px-6">
          <h1 className="text-lg font-bold text-text">{title}</h1>
        </header>
        <main className="p-6 max-w-5xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
