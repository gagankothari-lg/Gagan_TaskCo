'use client';

import { useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { useOrgChart, type DirectoryUser } from '../../../lib/api/directory';
import { Icon } from '../../../components/ui/icon';
import { initials } from '../../../lib/utils';

const TEAM_COLORS: Record<string, string> = {
  "1. Founder's Office": '#6a1b9a',
  '2. Student Success': '#0277bd',
  '3. Knowledge': '#00695c',
  '4. Growth (Marketing)': '#e65100',
  '5. Tech': '#1565c0',
  '6. Consulting': '#880e4f',
  '7. Operations - PP & Admin': '#2e7d32',
  '8. Operations - FP&A': '#6a4c93',
};
const teamColor = (t?: string | null) => (t && TEAM_COLORS[t]) || '#455a64';

// Role priority — higher number wins when picking a team head.
const ROLE_PRIORITY: Record<string, number> = {
  'Super Admin': 5,
  Admin: 4,
  'Team Captain': 3,
  'Team Facilitator': 2,
  'Team Member': 1,
};
const rolePriority = (role: string) => ROLE_PRIORITY[role] ?? 0;

interface TeamGroup {
  name: string;
  color: string;
  members: DirectoryUser[];
  head: DirectoryUser;
  departments: number;
}

function buildTeams(users: DirectoryUser[]): TeamGroup[] {
  const byTeam = new Map<string, DirectoryUser[]>();
  users.forEach((u) => {
    const key = u.team || 'Unassigned';
    const arr = byTeam.get(key);
    if (arr) arr.push(u);
    else byTeam.set(key, [u]);
  });
  const groups: TeamGroup[] = [];
  byTeam.forEach((members, name) => {
    let head = members[0];
    members.forEach((m) => { if (rolePriority(m.role) > rolePriority(head.role)) head = m; });
    const depts = new Set<string>();
    members.forEach((m) => { if (m.subDepartment) depts.add(m.subDepartment); });
    groups.push({ name, color: teamColor(name), members, head, departments: depts.size });
  });
  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

export default function OrgChartPage() {
  const { currentUser } = useAuth();
  const { data: users, isLoading } = useOrgChart();
  const allUsers = useMemo(() => users ?? [], [users]);
  const teamGroups = useMemo(() => buildTeams(allUsers), [allUsers]);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [highlight, setHighlight] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const teams = useMemo(() => teamGroups.map((g) => g.name), [teamGroups]);

  const toggle = (id: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(teamGroups.map((g) => g.name)));
  const stepZoom = (d: number) => setZoom((z) => Math.min(3, Math.max(0.2, +(z + d).toFixed(2))));
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const findMe = () => { if (currentUser) { setHighlight(currentUser.empId); setZoom(1); setPan({ x: 0, y: 0 }); setTimeout(() => setHighlight(null), 2500); } };

  function onDown(e: React.MouseEvent) { drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; }
  function onMove(e: React.MouseEvent) { if (!drag.current) return; setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) }); }
  function onUp() { drag.current = null; }

  // A person card under a team (the team's members).
  const PersonCard = ({ user, color }: { user: DirectoryUser; color: string }) => {
    const isMe = user.empId === currentUser?.empId;
    const isHi = highlight === user.empId;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ background: 'var(--surface)', borderRadius: 8, boxShadow: 'var(--sh)', borderTop: `3px solid ${color}`, padding: '10px 14px', minWidth: 150, textAlign: 'center', outline: isHi ? '3px solid var(--p)' : isMe ? '2px solid var(--accent)' : 'none' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: color, color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>{initials(`${user.firstName} ${user.lastName}`)}</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user.firstName} {user.lastName}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{user.designation || user.role}</div>
        </div>
      </div>
    );
  };

  // A team card sitting between the root company and its people.
  const TeamCard = ({ group }: { group: TeamGroup }) => {
    const isCollapsed = collapsed.has(group.name);
    const headName = `${group.head.firstName} ${group.head.lastName}`;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 160, background: 'var(--surface)', borderRadius: 8, borderLeft: `4px solid ${group.color}`, padding: 12, boxShadow: 'var(--sh)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--p)', marginBottom: 8 }}>{group.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: group.color, color: '#fff', fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials(headName)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{headName}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{group.head.role}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Employees: {group.members.length} employees</div>
          <button onClick={() => toggle(group.name)} style={{ fontSize: 11, color: 'var(--p)', background: 'none', border: 'none', padding: 0, marginTop: 4, cursor: 'pointer' }}>
            {group.departments} departments
          </button>
        </div>
        {!isCollapsed && (
          <>
            <div style={{ width: 2, height: 20, background: 'var(--border)' }} />
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              {group.members.map((m) => <PersonCard key={m.empId} user={m} color={group.color} />)}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="ph">
        <div className="ph-left"><div className="ph-title">Org Chart</div><div className="ph-sub">Reporting structure across teams</div></div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" onClick={expandAll}><Icon name="unfold_more" size={15} /> Expand</button>
          <button className="btn btn-ghost btn-sm" onClick={collapseAll}><Icon name="unfold_less" size={15} /> Collapse</button>
          <button className="btn btn-ghost btn-sm" onClick={reset}><Icon name="fit_screen" size={15} /> Reset</button>
        </div>
      </div>

      {/* Team legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        {teams.map((t) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: teamColor(t) }} /> {t}
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="empty-state"><Icon name="hourglass_empty" size={40} className="ei" /><p>Loading…</p></div>
      ) : (
        <>
          <div
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
            style={{ overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', height: 'calc(100vh - 240px)', cursor: drag.current ? 'grabbing' : 'grab', position: 'relative' }}
          >
            <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', padding: 40, display: 'inline-flex', gap: 40, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* ROOT company card */}
                <div style={{ width: 200, background: 'var(--surface)', borderRadius: 8, border: '2px solid #1a237e', padding: 14, textAlign: 'center', boxShadow: 'var(--sh)' }}>
                  <Icon name="corporate_fare" size={28} style={{ color: 'var(--p)' }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>Leveraged Growth</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Employees: {allUsers.length} employees</div>
                  <div style={{ fontSize: 12, color: 'var(--p)', marginTop: 2 }}>{teamGroups.length} teams</div>
                </div>
                <div style={{ width: 2, height: 20, background: 'var(--border)' }} />
                <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                  {teamGroups.map((g) => <TeamCard key={g.name} group={g} />)}
                </div>
              </div>
            </div>
          </div>

          {/* Floating zoom bar */}
          <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#fff', borderRadius: 20, boxShadow: '0 4px 12px rgba(0,0,0,.15)', padding: '6px 16px', display: 'flex', gap: 12, alignItems: 'center', zIndex: 50 }}>
            <button onClick={findMe} title="Find me" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}><Icon name="my_location" size={18} /></button>
            <button onClick={() => stepZoom(-0.15)} title="Zoom out" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}><Icon name="remove" size={18} /></button>
            <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)} %</span>
            <button onClick={() => stepZoom(0.15)} title="Zoom in" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}><Icon name="add" size={18} /></button>
            <button onClick={reset} title="Fit screen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}><Icon name="fit_screen" size={18} /></button>
          </div>
        </>
      )}
    </div>
  );
}
