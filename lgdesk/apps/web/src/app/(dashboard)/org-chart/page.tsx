'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { useOrgChart, type DirectoryUser } from '../../../lib/api/directory';
import { TEAM_HIERARCHY, DIVISIONS } from '../../../components/modules/users/registration-modal.schema';
import { Icon } from '../../../components/ui/icon';
import { initials } from '../../../lib/utils';

// Exact `_OC_TEAM_COLORS` from LGDesk_Master_Reference.md Part 22.
const TEAM_COLORS: Record<string, string> = {
  "1. Founder's Office": '#1565c0',
  '2. Student Success': '#6a1b9a',
  '3. Knowledge': '#00695c',
  '4. Growth (Marketing)': '#e65100',
  '5. Tech': '#37474f',
  '6. Consulting': '#4e342e',
  '7. Operations - PP & Admin': '#2e7d32',
  '8. Operations - FP&A': '#6a4c93',
};
const teamColor = (t?: string | null) => (t && TEAM_COLORS[t]) || '#455a64';

// `_OC_ROLE_PRIORITY`: Super Admin(0) -> Admin(1) -> Team Captain(2) -> Team
// Facilitator(3) -> Team Member(4) -> Intern(5). Lower number = picked as head.
const ROLE_PRIORITY: Record<string, number> = {
  'Super Admin': 0,
  Admin: 1,
  'Team Captain': 2,
  'Team Facilitator': 3,
  'Team Member': 4,
  Intern: 5,
};
const rolePriority = (role: string) => ROLE_PRIORITY[role] ?? 6;

const UNASSIGNED = 'Unassigned';

interface SubDeptGroup {
  name: string;
  members: DirectoryUser[];
}

interface TeamGroup {
  name: string;
  color: string;
  members: DirectoryUser[]; // every employee in this team, any sub-dept or none
  head: DirectoryUser | null;
  subDepts: SubDeptGroup[]; // canonical sub-depts (+ a synthetic "Unassigned" bucket if needed) — [] for flat teams
}

// Canonical scaffold (DIVISIONS / TEAM_HIERARCHY) first, so a team or
// sub-department with zero employees still renders (Part 37: "Teams/sub-depts
// with zero employees still render — never dropped").
function buildTeams(users: DirectoryUser[]): TeamGroup[] {
  const byTeam = new Map<string, DirectoryUser[]>();
  users.forEach((u) => {
    const key = u.team || UNASSIGNED;
    const arr = byTeam.get(key);
    if (arr) arr.push(u);
    else byTeam.set(key, [u]);
  });

  const teamNames = new Set<string>([...DIVISIONS, ...Array.from(byTeam.keys())]);
  const groups: TeamGroup[] = [];
  teamNames.forEach((name) => {
    const members = byTeam.get(name) ?? [];
    let head: DirectoryUser | null = null;
    members.forEach((m) => { if (!head || rolePriority(m.role) < rolePriority(head.role)) head = m; });

    const canonical = TEAM_HIERARCHY[name] ?? [];
    const subDepts: SubDeptGroup[] = canonical.map((sd) => ({
      name: sd,
      members: members.filter((m) => m.subDepartment === sd),
    }));
    const accounted = new Set(canonical);
    const leftover = members.filter((m) => !m.subDepartment || !accounted.has(m.subDepartment));
    if (canonical.length > 0 && leftover.length > 0) {
      subDepts.push({ name: UNASSIGNED, members: leftover });
    }

    groups.push({ name, color: teamColor(name), members, head, subDepts });
  });
  // Canonical divisions first (in their declared order), then any legacy/unknown team names A→Z.
  return groups.sort((a, b) => {
    const ai = DIVISIONS.indexOf(a.name);
    const bi = DIVISIONS.indexOf(b.name);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
}

const teamKey = (team: string) => `t:${team}`;
const subKey = (team: string, sub: string) => `s:${team}::${sub}`;

export default function OrgChartPage() {
  const { currentUser } = useAuth();
  const { data: users, isLoading, refetch } = useOrgChart();
  const allUsers = useMemo(() => users ?? [], [users]);
  const teamGroups = useMemo(() => buildTeams(allUsers), [allUsers]);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 20 });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [highlight, setHighlight] = useState<string | null>(null);
  const [centerTarget, setCenterTarget] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const allNodeKeys = useMemo(() => {
    const keys = new Set<string>();
    teamGroups.forEach((g) => {
      keys.add(teamKey(g.name));
      g.subDepts.forEach((sd) => keys.add(subKey(g.name, sd.name)));
    });
    return keys;
  }, [teamGroups]);

  const toggle = (key: string) => setExpanded((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const expandAll = () => setExpanded(new Set(allNodeKeys));
  const collapseAll = () => setExpanded(new Set());

  const stepZoom = (d: number) => setZoom((z) => Math.min(3, Math.max(0.2, +(z + d).toFixed(2))));

  // "Fit screen": scale the whole tree to fit inside the wrapper and centre it —
  // used by both the floating "Reset view" button and after Reset/Find-me.
  const fitScreen = () => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) { setZoom(1); setPan({ x: 40, y: 20 }); return; }
    const wRect = wrapper.getBoundingClientRect();
    // Measure the content at its *current* zoom, then normalise back to a 1x size.
    const naturalW = content.scrollWidth / zoomRef.current;
    const naturalH = content.scrollHeight / zoomRef.current;
    const scale = Math.min(3, Math.max(0.2, Math.min((wRect.width - 40) / naturalW, (wRect.height - 40) / naturalH, 1)));
    setZoom(+scale.toFixed(2));
    setPan({ x: Math.max(20, (wRect.width - naturalW * scale) / 2), y: 20 });
  };

  // Header "Reset": reloads org data AND re-fits the view.
  const reloadAndReset = () => {
    void refetch();
    setExpanded(new Set());
    requestAnimationFrame(fitScreen);
  };

  const centerOnNode = (empId: string) => {
    const wrapper = wrapperRef.current;
    const node = nodeRefs.current.get(empId);
    if (!wrapper || !node) return;
    const wRect = wrapper.getBoundingClientRect();
    const nRect = node.getBoundingClientRect();
    const dx = wRect.left + wRect.width / 2 - (nRect.left + nRect.width / 2);
    const dy = wRect.top + wRect.height / 2 - (nRect.top + nRect.height / 2);
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  };

  useEffect(() => {
    if (!centerTarget) return;
    const raf = requestAnimationFrame(() => { centerOnNode(centerTarget); setCenterTarget(null); });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerTarget, expanded]);

  // "Find me": centres + highlights the current user's team card; falls back to
  // fit if the team is unknown/has no members here.
  const findMe = () => {
    if (!currentUser) { fitScreen(); return; }
    const group = teamGroups.find((g) => g.name === currentUser.team);
    const me = group?.members.find((m) => m.empId === currentUser.empId);
    if (!group || !me) { fitScreen(); return; }
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(teamKey(group.name));
      if (me.subDepartment) next.add(subKey(group.name, me.subDepartment));
      else if (group.subDepts.some((sd) => sd.name === UNASSIGNED)) next.add(subKey(group.name, UNASSIGNED));
      return next;
    });
    setHighlight(currentUser.empId);
    setCenterTarget(currentUser.empId);
    setTimeout(() => setHighlight(null), 2500);
  };

  // ── Pan: mouse drag + 1-finger touch ──
  function onMouseDown(e: React.MouseEvent) { drag.current = { x: e.clientX, y: e.clientY, px: panRef.current.x, py: panRef.current.y }; }
  function onMouseMove(e: React.MouseEvent) { if (!drag.current) return; setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) }); }
  function onMouseUp() { drag.current = null; }
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    drag.current = { x: t.clientX, y: t.clientY, px: panRef.current.x, py: panRef.current.y };
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!drag.current || e.touches.length !== 1) return;
    const t = e.touches[0];
    setPan({ x: drag.current.px + (t.clientX - drag.current.x), y: drag.current.py + (t.clientY - drag.current.y) });
  }
  function onTouchEnd() { drag.current = null; }

  // ── Wheel: Ctrl/Cmd+wheel zooms about the cursor; plain wheel pans ──
  // Attached via a native listener (not React's onWheel) so preventDefault
  // actually stops page scroll — React makes onWheel passive by default.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const z = zoomRef.current;
        const p = panRef.current;
        const newZoom = Math.min(3, Math.max(0.2, +(z - e.deltaY * 0.0015 * z).toFixed(3)));
        const localX = (cx - p.x) / z;
        const localY = (cy - p.y) / z;
        setZoom(newZoom);
        setPan({ x: cx - localX * newZoom, y: cy - localY * newZoom });
      } else {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
    // Re-attach once the wrapper actually mounts (it doesn't exist yet while isLoading).
  }, [isLoading]);

  // A person card at the deepest (member-panel) level. Per `.oc-mav`, member
  // avatars are a uniform indigo pair regardless of team — not the team brand hex.
  const PersonCard = ({ user }: { user: DirectoryUser }) => {
    const isMe = user.empId === currentUser?.empId;
    const isHi = highlight === user.empId;
    return (
      <div
        ref={(el) => { if (el) nodeRefs.current.set(user.empId, el); else nodeRefs.current.delete(user.empId); }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderRadius: 6, padding: '6px 10px', outline: isHi ? '3px solid var(--p)' : isMe ? '2px solid var(--accent)' : 'none' }}
      >
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--p3)', color: 'var(--p2)', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials(`${user.firstName} ${user.lastName}`)}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{user.firstName} {user.lastName}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{user.role}</div>
        </div>
      </div>
    );
  };

  const MemberPanel = ({ members }: { members: DirectoryUser[] }) => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--sh)', padding: 10, minWidth: 200 }}>
      {members.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', padding: 4 }}>No members assigned yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {members.map((m) => <PersonCard key={m.empId} user={m} />)}
        </div>
      )}
    </div>
  );

  // A sub-department card sitting under an expanded team card.
  const SubDeptCard = ({ team, sd, color }: { team: string; sd: SubDeptGroup; color: string }) => {
    const key = subKey(team, sd.name);
    const isOpen = expanded.has(key);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <button
          onClick={() => toggle(key)}
          style={{ width: 150, background: 'var(--surface)', borderRadius: 8, borderLeft: `3px solid ${color}`, padding: '8px 12px', boxShadow: 'var(--sh)', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{sd.name}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            {sd.members.length} member{sd.members.length === 1 ? '' : 's'}
            <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={13} />
          </div>
        </button>
        {isOpen && (
          <>
            <div style={{ width: 2, height: 16, background: 'var(--border)' }} />
            <MemberPanel members={sd.members} />
          </>
        )}
      </div>
    );
  };

  // A team card sitting between the root company and its sub-departments/people.
  // Sizing/border/hover match `.oc-card` (min 200/max 230, hover shadow+border);
  // head avatar matches `.oc-av` (36x36); body preview blocks match `.oc-es`/`.oc-el`/
  // `.oc-ec` (employee count) and `.oc-ds`/`.oc-dr`/`.oc-dav`/`.oc-dn` (sub-dept
  // preview rows, always visible — separate from the expand-gated member list below).
  const TeamCard = ({ group }: { group: TeamGroup }) => {
    const key = teamKey(group.name);
    const isOpen = expanded.has(key);
    const headName = group.head ? `${group.head.firstName} ${group.head.lastName}` : null;
    const hasSubDepts = group.subDepts.length > 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          style={{ minWidth: 200, maxWidth: 230, background: 'var(--surface)', borderRadius: 10, border: '1.5px solid #e2e5ea', borderLeft: `4px solid ${group.color}`, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,.06)', transition: 'box-shadow .15s, border-color .15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,.1)'; e.currentTarget.style.borderColor = '#b8bec8'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'; e.currentTarget.style.borderColor = '#e2e5ea'; }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--p)', marginBottom: 10 }}>{group.name}</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: group.color, color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{headName ? initials(headName) : '—'}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{headName ?? 'No head assigned'}</div>
              {group.head && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{group.head.role}</div>}
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--muted2)', fontWeight: 500, marginBottom: 2 }}>Employees</div>
            <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{group.members.length}</div>
          </div>
          {hasSubDepts && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--muted2)', fontWeight: 500, marginBottom: 5 }}>Sub-departments</div>
              {group.subDepts.map((sd) => (
                <div key={sd.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#f1f3f5', border: '1px solid #e2e5ea', color: '#6b7280', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials(sd.name)}</div>
                  <div style={{ fontSize: 12, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sd.name}</div>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => toggle(key)} style={{ width: '100%', fontSize: 12, fontWeight: 500, color: 'var(--p)', background: 'none', border: 'none', borderTop: '1px solid #f0f0f0', padding: '8px 4px 10px', margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {hasSubDepts ? `${group.subDepts.length} sub-department${group.subDepts.length === 1 ? '' : 's'}` : 'View members'}
            <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={14} />
          </button>
        </div>
        {isOpen && (
          <>
            <div style={{ width: 2, height: 20, background: 'var(--border)' }} />
            {hasSubDepts ? (
              <div className="oc-row">
                {group.subDepts.map((sd) => (
                  <div className="oc-row-item" key={sd.name}>
                    <SubDeptCard team={group.name} sd={sd} color={group.color} />
                  </div>
                ))}
              </div>
            ) : (
              <MemberPanel members={group.members} />
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Sibling-row connectors — reproduces reference's `.oc-flat-row`/`::before`
          spanning horizontal bar + vertical drops (a pure-CSS trick using per-item
          pseudo-elements, so it needs a real <style> block — inline `style` props
          can't express `::before`). Scoped to this page via the oc-row* classes. */}
      <style>{`
        .oc-row{display:flex;justify-content:center;align-items:flex-start;padding:20px 0 0;margin:0;position:relative;min-width:max-content}
        .oc-row::before{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);border-left:2px solid var(--border);height:20px}
        .oc-row>.oc-row-item{display:flex;flex-direction:column;align-items:center;padding:0 12px;position:relative}
        .oc-row>.oc-row-item::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--border)}
        .oc-row>.oc-row-item:first-child::before{left:50%}
        .oc-row>.oc-row-item:last-child::before{right:50%}
        .oc-row>.oc-row-item:only-child::before{display:none}
      `}</style>
      <div className="ph">
        <div className="ph-left"><div className="ph-title">Org Chart</div><div className="ph-sub">Leveraged Growth — Company Structure</div></div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" onClick={reloadAndReset}><Icon name="refresh" size={15} /> Reset</button>
          <button className="btn btn-outline btn-sm" onClick={expandAll}><Icon name="unfold_more" size={15} /> Expand All</button>
          <button className="btn btn-ghost btn-sm" onClick={collapseAll}><Icon name="unfold_less" size={15} /> Collapse</button>
        </div>
      </div>

      {/* Team legend — square dots (.oc-legend-dot: 10x10, radius 3) + #374151 text */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        {teamGroups.map((g) => (
          <span key={g.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: '#374151' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: g.color, flexShrink: 0 }} /> {g.name}
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="empty-state"><Icon name="hourglass_empty" size={40} className="ei" /><p>Loading…</p></div>
      ) : (
        <>
          <div
            ref={wrapperRef}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            style={{ overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', height: 'calc(100vh - 240px)', cursor: drag.current ? 'grabbing' : 'grab', position: 'relative', touchAction: 'none' }}
          >
            <div ref={contentRef} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', padding: 40, display: 'inline-flex', gap: 40, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* ROOT company card — `.oc-root-card` teal accent (border/left-border/bg) */}
                <div style={{ width: 200, background: '#f0fdfc', borderRadius: 8, border: '1.5px solid #b2dfdb', borderLeft: '4px solid #26a69a', padding: 14, textAlign: 'center', boxShadow: 'var(--sh)' }}>
                  <Icon name="corporate_fare" size={28} style={{ color: 'var(--p)' }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>Leveraged Growth</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{allUsers.length} employee{allUsers.length === 1 ? '' : 's'}</div>
                  <div style={{ fontSize: 12, color: 'var(--p)', marginTop: 2 }}>{teamGroups.length} teams</div>
                </div>
                <div className="oc-row">
                  {teamGroups.map((g) => (
                    <div className="oc-row-item" key={g.name}>
                      <TeamCard group={g} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating zoom/action bar — confined inside the chart wrapper
                (`#org-chart-wrap{position:relative}` + `.oc-zoom-bar{position:absolute}`) */}
            <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 2, zIndex: 10, background: '#fff', borderRadius: 10, boxShadow: '0 2px 12px rgba(0,0,0,.12)', padding: '4px 6px' }}>
              <button
                onClick={findMe} title="Center on my team"
                style={{ background: 'none', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              ><Icon name="my_location" size={18} /> Find me</button>
              <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 2px' }} />
              <button
                onClick={() => stepZoom(-0.15)} title="Zoom out"
                style={{ background: 'none', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              ><Icon name="remove" size={18} /></button>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', minWidth: 42, textAlign: 'center' }}>{Math.round(zoom * 100)} %</span>
              <button
                onClick={() => stepZoom(0.15)} title="Zoom in"
                style={{ background: 'none', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              ><Icon name="add" size={18} /></button>
              <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 2px' }} />
              <button
                onClick={fitScreen} title="Reset view"
                style={{ background: 'none', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              ><Icon name="fit_screen" size={18} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
