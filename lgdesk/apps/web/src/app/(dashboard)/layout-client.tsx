'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useAuth } from '../../hooks/use-auth';
import { isManager } from '../../lib/auth';
import { Icon } from '../../components/ui/icon';
import { toast } from '../../lib/toast';
import { AuthRefreshPing } from '../../components/auth-refresh-ping';
import { ImportModal } from '../../components/modules/import/import-modal';
import { ProfileModal } from '../../components/modules/users/profile-modal';
import { ClockWidget } from '../../components/modules/work-duration/clock-widget';
import { WeekGlanceWidget } from '../../components/modules/work-log/week-glance-widget';
import { useRegistrations, useProfileRequests } from '../../lib/api/teamMembers';
import { useSetPresence, HEARTBEAT_MS, IDLE_MS } from '../../lib/api/presence';
import { PageHeaderProvider, usePageHeaderSlot } from '../../components/layout/page-header-context';

// PREORDER-SIDEBAR: gate is applied at render time (manager -> isManager(role),
// misAccess -> user.hasMisAccess), same checks as before -- this is a pure reorder,
// not a permissions change. A plain item (no `gate`) is unconditional, as today.
type NavItem = { label: string; icon: string; href: string; badge?: number; gate?: 'manager' | 'misAccess' };
type NavRow = NavItem | { divider: true };

// Mobile (<=768px) is a deliberately reduced feature set (Full Mobile Redesign
// is a separate, later roadmap item) — these 8 nav items are hidden below the
// md breakpoint only, per reference/lgdesk-gas-source.html's JS-injected
// mobile CSS block (`.nav-item[data-view="calendar"],[...="meetings"],
// [...="org-chart"],[...="directory"],[...="team-tasks"],[...="team-mgmt"],
// [...="org-page"],[...="forms"]{display:none!important}`), mapped onto this
// codebase's nav labels (team-mgmt → Team Members, org-page → Organisation).
const MOBILE_HIDDEN_LABELS = new Set([
  'Calendar',
  'Meetings',
  'Org Chart',
  'Directory',
  'Team Members',
  'Organisation',
  'Forms',
]);

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
  return (
    <PageHeaderProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </PageHeaderProvider>
  );
}

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout, refresh, tasks, pendingLeaveCount, pendingDdrCount } = useAuth();
  const managerLoaded = !!user && isManager(user.role);
  // Round5 add'l-1: Registrations/Profile Updates no longer have their own nav items —
  // both are embedded-only now (members-view.tsx), matching the reference (Part 10's
  // full nav table has no standalone entries for either). Their pending counts fold into
  // Team Members'/Organisation's own badge instead of disappearing, matching the
  // reference's actual composition: Team Management's badge combines all 3 pending
  // queues (Registrations, Profile Updates, Due-Date Requests) into one number.
  const { data: registrations } = useRegistrations(managerLoaded);
  const { data: profileRequests } = useProfileRequests(managerLoaded);
  const pendingRegCount = useMemo(() => (registrations ?? []).filter((r) => r.status === 'Pending').length, [registrations]);
  const pendingProfileCount = useMemo(() => (profileRequests ?? []).filter((r) => r.status === 'Pending').length, [profileRequests]);
  const pendingTeamMgmtCount = pendingDdrCount + pendingRegCount + pendingProfileCount;

  const [mobNavOpen, setMobNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [presOpen, setPresOpen] = useState(false);
  const [pres, setPres] = useState<PresKey>('online');
  const [refreshing, setRefreshing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const presWrap = useRef<HTMLDivElement>(null);
  const setPresence = useSetPresence();
  // Tracks whether the current 'away' state was auto-set by the idle timer (vs. the
  // user deliberately picking Away from the dropdown) -- only an auto-away should be
  // cleared by the next bit of activity (Round6 #12, mirrors app.js.html's
  // `_presActivityHandler`'s manual-vs-auto distinction).
  const autoAwayRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manual status pick: always explicit, always clears the auto-away flag.
  function pickPresence(k: PresKey) {
    autoAwayRef.current = false;
    setPres(k);
    setPresOpen(false);
    setPresence.mutate(k);
  }

  // Heartbeat: touch presenceUpdatedAt every HEARTBEAT_MS while the app is open, plus
  // once immediately on mount (matches the reference's initial `_presPing('online')`).
  useEffect(() => {
    if (!user) return;
    setPresence.mutate('online');
    const id = setInterval(() => setPresence.mutate(undefined), HEARTBEAT_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.empId]);

  // Idle-to-away: simple version of the reference's idle timer (app.js.html
  // PRES_IDLE_MS/_presResetIdleTimer) -- 5 min of no mouse/keyboard/touch/scroll
  // activity auto-flips 'online' to 'away'; the next bit of activity flips back, but
  // only if that 'away' was auto-set, never overriding a manually chosen status.
  useEffect(() => {
    if (!user) return;
    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setPres((current) => {
          if (current !== 'online') return current;
          autoAwayRef.current = true;
          setPresence.mutate('away');
          return 'away';
        });
      }, IDLE_MS);
    };
    const onActivity = () => {
      setPres((current) => {
        if (current === 'away' && autoAwayRef.current) {
          autoAwayRef.current = false;
          setPresence.mutate('online');
          return 'online';
        }
        return current;
      });
      resetIdleTimer();
    };
    resetIdleTimer();
    const events: (keyof DocumentEventMap)[] = ['mousemove', 'click', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => document.addEventListener(ev, onActivity, { passive: true }));
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach((ev) => document.removeEventListener(ev, onActivity));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.empId]);

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
  // PCONSOLIDATE-TASKS-PROJECTS-NAV flattened the prior three labelled groups (My
  // Space/Team/Company) into one list with no section headers. PREORDER-SIDEBAR
  // (this pass) reorders that flat list into clusters separated by unlabeled visual
  // dividers -- every gate (manager -> isManager(role), misAccess -> hasMisAccess) is
  // exactly what it was before, just relocated; this is a pure reorder, not a
  // permissions change. PMERGE-LEAVES-PAGES folded Leave Approvals into the single,
  // always-visible Leaves entry (which now carries the badge Leave Approvals used to).
  const groups = useMemo((): NavRow[] => [
    { label: 'Dashboard', icon: 'home', href: '/dashboard' },
    { label: 'Work Log', icon: 'edit_note', href: '/work-log' },
    { label: 'MIS Report', icon: 'assessment', href: '/mis-report', gate: 'misAccess' },
    { label: 'Team Work Logs', icon: 'monitoring', href: '/work-log/team', gate: 'manager' },
    { label: 'Plan My Week', icon: 'calendar_view_week', href: '/tasks/plan-week' },
    { label: 'Tasks', icon: 'task_alt', href: '/tasks', badge: openTaskCount },
    { label: 'Projects', icon: 'folder_open', href: '/projects' },
    { divider: true },
    { label: 'Calendar', icon: 'calendar_month', href: '/calendar' },
    { label: 'Meetings', icon: 'video_call', href: '/meetings' },
    { label: 'Notes', icon: 'checklist_rtl', href: '/notes' },
    { label: 'Forms', icon: 'description', href: '/forms', gate: 'manager' },
    { divider: true },
    { label: 'Leaves', icon: 'event_available', href: '/leaves', badge: pendingLeaveCount },
    { divider: true },
    { label: 'Team Members', icon: 'table_rows', href: '/team-members', badge: pendingTeamMgmtCount, gate: 'manager' },
    { label: 'Organisation', icon: 'corporate_fare', href: '/organisation', badge: pendingTeamMgmtCount, gate: 'manager' },
    { label: 'Directory', icon: 'contacts', href: '/directory' },
    { label: 'Org Chart', icon: 'account_tree', href: '/org-chart' },
    { divider: true },
  ], [openTaskCount, pendingLeaveCount, pendingTeamMgmtCount]);

  // Longest-prefix match so exactly one nav item is active (e.g. /leaves/approvals
  // beats /leaves). Computed over every reachable item regardless of manager/misAccess
  // gating (unchanged from before the flatten/reorder) -- a gated-out href just never
  // matches; dividers carry no href and are skipped.
  const activeHref = useMemo(() => {
    let best = '';
    for (const entry of groups) {
      if ('divider' in entry) continue;
      if (pathname === entry.href || pathname.startsWith(entry.href + '/')) {
        if (entry.href.length > best.length) best = entry.href;
      }
    }
    return best;
  }, [groups, pathname]);

  const pageHeader = usePageHeaderSlot();
  const { resolvedTheme, setTheme } = useTheme();

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
    // NOTE: deliberately `max-md:hidden`, NOT the bare Tailwind `hidden` utility.
    // globals.css has a blanket `.hidden { display: none !important; }` override
    // (see its "HIDDEN UTILITY" section) that would make a paired `hidden md:flex`
    // permanently hidden at every breakpoint — the unprefixed `.hidden` always
    // wins over a non-`!important` `md:flex` companion class regardless of
    // viewport. `max-md:hidden` is a distinct selector that override doesn't
    // touch, and (as a responsive variant) it's emitted after `.nav-item` in the
    // compiled stylesheet, so it correctly wins the display tie only below md.
    const mobileHidden = MOBILE_HIDDEN_LABELS.has(it.label);
    return (
      <Link
        key={it.href}
        href={it.href}
        className={`nav-item${active ? ' active' : ''}${mobileHidden ? ' max-md:hidden' : ''}`}
        title={collapsed ? it.label : undefined}
      >
        <span className="nav-icon"><Icon name={it.icon} size={20} /></span>
        <span className="sb-label" style={{ flex: 1 }}>{it.label}</span>
        {!!it.badge && it.badge > 0 && <span className="nav-badge sb-label">{it.badge}</span>}
      </Link>
    );
  };

  return (
    <div>
      <AuthRefreshPing />
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
          className="flex max-md:hidden"
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 12px', color: 'var(--text)', flexShrink: 0 }}>
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
            background: 'var(--import-btn-bg)', color: 'var(--import-btn-text)', fontWeight: 500, fontSize: 13,
          }}
        >
          <Icon name="upload_file" size={17} style={{ color: 'var(--import-btn-icon)' }} />
          <span className="sb-label">Import Tasks</span>
        </button>

        {/* 4. .sb-scroll — the only scrollable child. */}
        <div className="sb-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {groups.map((entry, i) => {
            if ('divider' in entry) return <div key={`div-${i}`} className="nav-divider" />;
            if (entry.gate === 'manager' && !manager) return null;
            if (entry.gate === 'misAccess' && !user.hasMisAccess) return null;
            return renderItem(entry);
          })}

          <div className="nav-sec sb-label">Chats</div>
          <button
            onClick={() => toast('Google Chat integration is not available yet', 'info')}
            className="sb-label"
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: 'var(--p)', background: 'var(--surface)', cursor: 'pointer', margin: '4px 8px', width: 'calc(100% - 16px)' }}
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
                  onClick={() => pickPresence(k)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--p3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className={`pres-dot ${PRES[k].cls}`} /> {PRES[k].label}
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
              <div
                onClick={() => { setPresOpen(false); setProfileOpen(true); }}
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
            <div className="sb-label" style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 10, color: 'var(--p-fg)', background: 'var(--hover-tint)' }}>{user.role}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation(); // critical -- the parent chip's onClick opens the presence picker;
                                      // without this, toggling the theme would also pop that open.
                setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
              }}
              aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="sb-label"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24,
                borderRadius: '50%', background: 'var(--hover-tint)', border: 'none', color: 'var(--p-fg)',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <Icon name={resolvedTheme === 'dark' ? 'light_mode' : 'dark_mode'} size={14} />
            </button>
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
          gap: 16, padding: '0 16px', color: '#fff', transition: 'left 0.15s ease',
        }}
      >
        <button
          onClick={() => setMobNavOpen(true)}
          aria-label="Open menu"
          title="Open menu"
          className="flex md:hidden"
          style={{
            alignItems: 'center', justifyContent: 'center', width: 40, height: 40,
            background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: 12,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Icon name="menu" size={20} />
        </button>

        {/* PNAV-HEADER-RELOCATE: the current page's title/subtitle (and, on Tasks/
            Projects, the My/Team/All ScopeTabs) now render here instead of in the page
            body. (This moved the page *title* into the header; it did not remove the
            mobile hamburger above, which still opens the sidebar drawer separately.) */}
        {pageHeader && (
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div className="hdr-page-title">{pageHeader.title}</div>
            {pageHeader.subtitle && <div className="hdr-page-sub">{pageHeader.subtitle}</div>}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {pageHeader?.tabs}

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

      {/* My Profile — slide-over with profile-update + change-password forms. */}
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}

export default DashboardShell;
