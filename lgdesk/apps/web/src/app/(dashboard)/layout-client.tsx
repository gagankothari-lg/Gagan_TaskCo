'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../hooks/use-auth';
import { isManager } from '../../lib/auth';
import { Icon } from '../../components/ui/icon';
import { toast } from '../../lib/toast';
import { ImportModal } from '../../components/modules/import/import-modal';
import { ClockWidget } from '../../components/modules/work-duration/clock-widget';
import { WeekGlanceWidget } from '../../components/modules/work-log/week-glance-widget';

type NavItem = { label: string; icon: string; href: string; badge?: number };

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
  const [collapsed, setCollapsed] = useState(false);
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

  // Nav skeleton per LGDesk_Master_Reference.md Part 10 (Navigation Structure).
  // Section grouping (My Space / Team / Company) is informal in the source
  // doc — role-gating is really per-item (`.nav-mgr-only`) — but the task
  // brief and the pre-existing implementation both use these three labelled
  // groups, so that convention is kept here.
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
      { label: 'Notes', icon: 'checklist_rtl', href: '/notes' },
    ];
    // Team Tasks/Projects/Logs/Members + Leave Approvals — `.nav-mgr-only` in
    // the source doc, i.e. gated by isManager(role) as a whole block.
    const team: NavItem[] = [
      { label: 'Leave Approvals', icon: 'pending_actions', href: '/leaves/approvals', badge: pendingLeaveCount },
      { label: 'Team Tasks', icon: 'groups', href: '/tasks/team' },
      { label: 'Team Projects', icon: 'folder_special', href: '/projects/team' },
      { label: 'Team Work Logs', icon: 'monitoring', href: '/work-log/team' },
      { label: 'Team Members', icon: 'table_rows', href: '/team-members', badge: pendingDdrCount },
    ];
    const company: NavItem[] = [
      { label: 'All Tasks', icon: 'table_rows', href: '/tasks/all' },
      { label: 'All Projects', icon: 'folder_special', href: '/projects/all' },
      { label: 'Organisation', icon: 'corporate_fare', href: '/organisation' },
      { label: 'Forms', icon: 'description', href: '/forms' },
    ];
    // MIS Report — gated by hasMisAccess alone (Part 10: "any role"), NOT by
    // isManager, so it is kept out of the `team` block on purpose.
    const misReport: NavItem = { label: 'MIS Report', icon: 'assessment', href: '/mis-report' };
    return { mySpace, team, company, misReport };
  }, [openTaskCount, pendingLeaveCount, pendingDdrCount]);

  // Longest-prefix match so exactly one nav item is active (e.g. /tasks/team beats /tasks).
  const activeHref = useMemo(() => {
    const all = [...groups.mySpace, groups.misReport, ...groups.team, ...groups.company];
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
  const sidebarVar = collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)';

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
    const active = activeHref === it.href;
    return (
      <Link key={it.href} href={it.href} className={`nav-item${active ? ' active' : ''}`} title={collapsed ? it.label : undefined}>
        <span className="nav-icon"><Icon name={it.icon} size={20} /></span>
        <span className="sb-label" style={{ flex: 1 }}>{it.label}</span>
        {!!it.badge && it.badge > 0 && <span className="nav-badge sb-label">{it.badge}</span>}
      </Link>
    );
  };

  return (
    <div>
      {/* ── Sidebar ───────────────────────────────────────────
          Children in this exact order (PROJECT_CONTEXT.md §2.3, the
          authoritative DOM ordering): collapse button, logo row, Import
          Tasks (pinned above the scroll area), .sb-scroll (nav), then
          #sidebar-profile-pin (presence menu + user chip) as a
          non-scrolling sibling AFTER .sb-scroll.
          (The drag-resize handle is a nice-to-have per the task brief and
          is deferred — sidebar width is fixed 230px / 54px collapsed.) */}
      <nav
        id="sidebar"
        className={`${mobNavOpen ? 'open' : ''}${collapsed ? ' sb-collapsed' : ''}`}
        style={{
          width: sidebarVar,
          background: 'var(--surface)',
          position: 'fixed', top: 0, bottom: 0, left: 0,
          display: 'flex', flexDirection: 'column',
          overflow: 'visible', zIndex: 90,
          boxShadow: '2px 0 4px rgba(0,0,0,0.05)',
          transition: 'width 0.15s ease',
        }}
      >
        {/* 1. Collapse button — protrudes past the sidebar's right edge. */}
        <button
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed((v) => !v)}
          className="hidden md:flex"
          style={{
            position: 'absolute', top: 78, right: -12, zIndex: 10,
            width: 24, height: 24, borderRadius: '50%',
            background: 'var(--surface)', border: '1px solid var(--border)',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          }}
        >
          <Icon name={collapsed ? 'chevron_right' : 'chevron_left'} size={14} />
        </button>

        {/* 2. Logo row — moved from the header into the sidebar (Change #47). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 12px', color: '#28384a', flexShrink: 0 }}>
          <Icon name="task_alt" size={17} />
          <span className="sb-label" style={{ fontSize: 16, fontWeight: 700 }}>LG Desk</span>
        </div>

        {/* 3. Import Tasks — pinned above the scroll area, ALL logged-in
               roles (deliberate product decision 2026-06-30 — no RBAC gate). */}
        <button
          onClick={() => setImportOpen(true)}
          className="sb-label"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, margin: '0 8px 8px', padding: '8px 10px',
            borderRadius: 6, border: 'none', cursor: 'pointer', flexShrink: 0,
            background: '#faece7', color: '#28384a', fontWeight: 500, fontSize: 13,
          }}
        >
          <Icon name="upload_file" size={17} style={{ color: '#993c1d' }} />
          <span className="sb-label">Import Tasks</span>
        </button>

        {/* 4. .sb-scroll — the only scrollable child. */}
        <div className="sb-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <div className="nav-sec sb-label">My Space</div>
          {groups.mySpace.map(renderItem)}
          {user.hasMisAccess && renderItem(groups.misReport)}

          {manager && (
            <>
              <div className="nav-sec sb-label">Team</div>
              {groups.team.map(renderItem)}
              <div className="nav-sec sb-label">Company</div>
              {groups.company.map(renderItem)}
            </>
          )}

          <div className="nav-sec sb-label">Chats</div>
          <button
            onClick={() => toast('Google Chat integration is not available yet', 'info')}
            className="sb-label"
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: 'var(--p)', background: '#fff', cursor: 'pointer', margin: '4px 8px', width: 'calc(100% - 16px)' }}
          >
            <Icon name="add_link" size={16} /> Connect Google Chat
          </button>
        </div>

        {/* 5. #sidebar-profile-pin — sibling AFTER .sb-scroll; never scrolls out. */}
        <div style={{ flexShrink: 0, position: 'relative', borderTop: '1px solid var(--border)' }} ref={presWrap}>
          {presOpen && (
            <div
              style={{ position: 'absolute', bottom: 'calc(100% + 2px)', left: 8, right: 8, zIndex: 30, background: 'var(--surface)', color: 'var(--text)', borderRadius: 8, boxShadow: '0 -4px 16px rgba(0,0,0,0.18)', padding: 6, border: '1px solid var(--border)' }}
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

          <div
            onClick={() => setPresOpen((v) => !v)}
            title="Set your status"
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 12px' }}
          >
            <div style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                {avatarLetter}
              </div>
              <div className={`pres-dot ${PRES[pres].cls}`} style={{ position: 'absolute', bottom: -1, right: -1 }} />
            </div>
            <div className="sb-label" style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: '#1a2533', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 10, color: '#28384a', background: 'rgba(40,56,74,.1)' }}>{user.role}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Mobile backdrop ───────────────────────────────── */}
      {mobNavOpen && (
        <div
          onClick={() => setMobNavOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 80 }}
          className="md:hidden"
        />
      )}

      {/* ── Header — ONLY the week-glance widget, clock in/out widget, and
             global refresh button live here now (logo + user chip moved
             into the sidebar, Change #47). The hamburger button is a
             mobile-only affordance for opening the sidebar drawer. ───── */}
      <header
        id="header"
        style={{
          position: 'fixed', top: 0, left: sidebarVar, right: 0, height: 'var(--hh)',
          background: 'var(--p)', zIndex: 100, display: 'flex', alignItems: 'center',
          gap: 10, padding: '0 16px', color: '#fff', transition: 'left 0.15s ease',
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

        <div style={{ flex: 1 }} />

        <WeekGlanceWidget />

        <div style={{ display: 'flex', alignItems: 'center', height: 46, borderRadius: 14, background: 'rgba(255,255,255,.08)', padding: '0 10px' }}>
          <ClockWidget />
        </div>

        <button
          onClick={globalRefresh}
          disabled={refreshing}
          aria-label="Refresh"
          title="Refresh"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 46, height: 46,
            background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: 14, cursor: 'pointer',
          }}
        >
          <Icon name="refresh" size={18} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : undefined} />
        </button>
      </header>

      {/* ── Main ──────────────────────────────────────────── */}
      <div
        id="main"
        style={{ marginLeft: sidebarVar, marginTop: 'var(--hh)', minHeight: 'calc(100vh - var(--hh))', background: 'var(--bg)', padding: 24, transition: 'margin-left 0.15s ease' }}
      >
        {children}
      </div>

      {/* Import Tasks is available to ALL logged-in roles (product decision
          2026-06-30, see PROJECT_CONTEXT.md §2.3) — the modal must not be
          manager-gated, only the button's visibility mattered historically. */}
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

export default DashboardShell;
