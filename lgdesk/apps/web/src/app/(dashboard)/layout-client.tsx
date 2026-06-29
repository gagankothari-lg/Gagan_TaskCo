'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../hooks/use-auth';
import { isManager } from '../../lib/auth';
import { Icon } from '../../components/ui/icon';
import { toast } from '../../lib/toast';
import { ImportModal } from '../../components/modules/import/import-modal';

type NavItem = { label: string; icon: string; href: string; badge?: number; misOnly?: boolean };

const PRES = {
  online: { label: 'Online', cls: 'pres-online' },
  away: { label: 'Away', cls: 'pres-away' },
  dnd: { label: 'Do Not Disturb', cls: 'pres-dnd' },
  offline: { label: 'Offline', cls: 'pres-offline' },
} as const;
type PresKey = keyof typeof PRES;

function Spinner() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="btn-spinner-dark" style={{ width: 28, height: 28 }} />
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout, refresh, tasks, pendingLeaveCount, pendingDdrCount } = useAuth();

  const [mobNavOpen, setMobNavOpen] = useState(false);
  const [presOpen, setPresOpen] = useState(false);
  const [pres, setPres] = useState<PresKey>('online');
  const [refreshing, setRefreshing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const presWrap = useRef<HTMLDivElement>(null);

  // Protect: bounce unauthenticated users to /login once bootstrap settles.
  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  // Close presence menu on outside click.
  useEffect(() => {
    if (!presOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (presWrap.current && !presWrap.current.contains(e.target as Node)) setPresOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [presOpen]);

  // Close mobile nav on route change.
  useEffect(() => setMobNavOpen(false), [pathname]);

  const openTaskCount = useMemo(
    () => tasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled').length,
    [tasks],
  );

  const groups = useMemo(() => {
    const mySpace: NavItem[] = [
      { label: 'Dashboard', icon: 'home', href: '/dashboard' },
      { label: 'Plan My Week', icon: 'calendar_view_week', href: '/tasks/plan-week' },
      { label: 'My Tasks', icon: 'task_alt', href: '/tasks', badge: openTaskCount },
      { label: 'My Projects', icon: 'folder_open', href: '/projects' },
      { label: 'Work Log', icon: 'edit_note', href: '/work-log' },
      { label: 'Calendar', icon: 'calendar_month', href: '/calendar' },
      { label: 'Meetings', icon: 'video_call', href: '/meetings' },
      { label: 'Org Chart', icon: 'account_tree', href: '/org-chart' },
      { label: 'My Leaves', icon: 'event_available', href: '/leaves' },
      { label: 'Directory', icon: 'contacts', href: '/directory' },
    ];
    const team: NavItem[] = [
      { label: 'Team Tasks', icon: 'checklist_rtl', href: '/tasks/team' },
      { label: 'Team Projects', icon: 'folder_special', href: '/projects/team' },
      { label: 'Team Work Logs', icon: 'monitoring', href: '/work-log/team' },
      { label: 'MIS Report', icon: 'assessment', href: '/mis-report', misOnly: true },
      { label: 'Leave Approvals', icon: 'pending_actions', href: '/leaves/approvals', badge: pendingLeaveCount },
      { label: 'Team Members', icon: 'groups', href: '/team-members', badge: pendingDdrCount },
    ];
    const company: NavItem[] = [
      { label: 'All Tasks', icon: 'table_rows', href: '/tasks/all' },
      { label: 'All Projects', icon: 'account_tree', href: '/projects/all' },
      { label: 'Organisation', icon: 'corporate_fare', href: '/organisation' },
    ];
    return { mySpace, team, company };
  }, [openTaskCount, pendingLeaveCount, pendingDdrCount]);

  // Longest-prefix match so exactly one nav item is active (e.g. /tasks/team beats /tasks).
  const activeHref = useMemo(() => {
    const all = [...groups.mySpace, ...groups.team, ...groups.company];
    let best = '';
    for (const it of all) {
      if (pathname === it.href || pathname.startsWith(it.href + '/')) {
        if (it.href.length > best.length) best = it.href;
      }
    }
    return best;
  }, [groups, pathname]);

  if (isLoading || !user) return <Spinner />;

  const manager = isManager(user.role);
  const avatarLetter = (user.name?.[0] ?? 'U').toUpperCase();

  async function globalRefresh() {
    setRefreshing(true);
    try {
      await refresh();
      toast('Refreshed', 'success');
    } catch {
      toast('Refresh failed', 'error');
    } finally {
      setRefreshing(false);
    }
  }

  const renderItem = (it: NavItem) => {
    if (it.misOnly && !user.hasMisAccess) return null;
    const active = activeHref === it.href;
    return (
      <Link key={it.href} href={it.href} className={`nav-item${active ? ' active' : ''}`}>
        <span className="nav-icon"><Icon name={it.icon} size={20} /></span>
        <span style={{ flex: 1 }}>{it.label}</span>
        {!!it.badge && it.badge > 0 && <span className="nav-badge">{it.badge}</span>}
      </Link>
    );
  };

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <header
        id="header"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--hh)',
          background: 'var(--p)', zIndex: 100, display: 'flex', alignItems: 'center',
          gap: 12, padding: '0 16px', color: '#fff',
        }}
      >
        <button
          aria-label="Open navigation"
          className="md:hidden"
          onClick={() => setMobNavOpen((v) => !v)}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}
        >
          <Icon name="menu" size={24} />
        </button>

        <div className="h-logo" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700 }}>
          <Icon name="task_alt" size={24} />
          <span className="mob-hide-text">LG Desk</span>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={globalRefresh}
          disabled={refreshing}
          title="Refresh"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 20, padding: '5px 10px', cursor: 'pointer', fontSize: 12,
          }}
        >
          <Icon name="refresh" size={16} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : undefined} />
          <span className="mob-hide-text">Refresh</span>
        </button>

        {/* User chip + presence menu */}
        <div
          ref={presWrap}
          style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: '4px 10px 4px 4px' }}
        >
          <div
            onClick={() => setPresOpen((v) => !v)}
            title="Set your status"
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            <div style={{ position: 'relative', width: 28, height: 28 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                {avatarLetter}
              </div>
              <div className={`pres-dot ${PRES[pres].cls}`} style={{ position: 'absolute', bottom: -1, right: -1 }} />
            </div>
            <span className="mob-hide-text" style={{ fontSize: 13 }}>{user.name}</span>
            <span className="role-badge mob-hide-text" style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 10, background: '#283593' }}>{user.role}</span>
          </div>

          {presOpen && (
            <div
              style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 400, background: 'var(--surface)', color: 'var(--text)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', minWidth: 200, padding: 6 }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', padding: '6px 10px' }}>Set Status</div>
              {(Object.keys(PRES) as PresKey[]).map((k) => (
                <div
                  key={k}
                  onClick={() => { setPres(k); setPresOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--p3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className={`pres-dot ${PRES[k].cls}`} /> {PRES[k].label}
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
              <div
                onClick={() => { setPresOpen(false); toast('Profile editing coming soon', 'info'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--p3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Icon name="manage_accounts" size={18} /> My Profile
              </div>
              <div
                onClick={() => { setPresOpen(false); logout(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--danger)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--p3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Icon name="logout" size={18} /> Sign Out
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Mobile backdrop ───────────────────────────────── */}
      {mobNavOpen && (
        <div
          onClick={() => setMobNavOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 80 }}
          className="md:hidden"
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────── */}
      <nav
        id="sidebar"
        className={mobNavOpen ? 'open' : ''}
        style={{ width: 'var(--sidebar)', background: 'var(--surface)', position: 'fixed', top: 'var(--hh)', bottom: 0, overflowY: 'auto', zIndex: 90, boxShadow: '2px 0 4px rgba(0,0,0,0.05)' }}
      >
        <div className="nav-sec">My Space</div>
        {groups.mySpace.map(renderItem)}

        {manager && (
          <>
            <div className="nav-sec">Team</div>
            {groups.team.map(renderItem)}
            <div className="nav-sec">Company</div>
            {groups.company.map(renderItem)}
          </>
        )}

        {/* Import Tasks — managers/admins only (GAP-003 fix) */}
        {manager && (
          <div className="nav-item" onClick={() => setImportOpen(true)} style={{ cursor: 'pointer' }}>
            <span className="nav-icon"><Icon name="upload_file" size={20} /></span>
            <span style={{ flex: 1 }}>Import Tasks</span>
          </div>
        )}

        {/* ── Chats ─────────────────────────────── */}
        <div className="nav-sec">Chats</div>
        <button
          onClick={() => toast('Google Chat integration is not available yet', 'info')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: 'var(--p)', background: '#fff', cursor: 'pointer', margin: '4px 8px', width: 'calc(100% - 16px)' }}
        >
          <Icon name="add_link" size={16} /> Connect Google Chat
        </button>
      </nav>

      {/* ── Main ──────────────────────────────────────────── */}
      <div
        id="main"
        style={{ marginLeft: 'var(--sidebar)', marginTop: 'var(--hh)', minHeight: 'calc(100vh - var(--hh))', background: 'var(--bg)', padding: 24 }}
      >
        {children}
      </div>

      {manager && <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />}
    </div>
  );
}

export default DashboardShell;
