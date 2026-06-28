'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { useTeamDirectory, useCompanyDirectory, type DirectoryUser } from '../../../hooks/use-directory';
import { Icon } from '../../../components/ui/icon';
import { avatarColor, initials, rolePillClass } from '../../../lib/utils';

type Tab = 'team' | 'company';

function DirCard({ u, isYou }: { u: DirectoryUser; isYou: boolean }) {
  const name = `${u.firstName} ${u.lastName}`;
  return (
    <div className="dir-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: avatarColor(u.empId), color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(name)}</div>
          <span className="pres-dot pres-offline" style={{ position: 'absolute', bottom: 0, right: 0 }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="dir-card-name">{name} {isYou && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>(You)</span>}</div>
          <span className={rolePillClass(u.role)}>{u.role}</span>
        </div>
      </div>
      {u.designation && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.designation}</div>}
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.team}{u.subDepartment ? ` · ${u.subDepartment}` : ''}</div>
      <div className="dir-card-email">{u.email}</div>
      {u.managerName && <div className="dir-card-mgr">Reports to: {u.managerName}</div>}
      {!isYou && (
        <div className="dir-card-actions">
          <a className="btn btn-ghost btn-sm" href={`mailto:${u.email}`}><Icon name="mail" size={15} /> Email</a>
          <button className="btn btn-ghost btn-sm" onClick={() => u.chatSpaceLink ? window.open(u.chatSpaceLink, '_blank') : undefined}><Icon name="chat" size={15} /> Chat</button>
        </div>
      )}
    </div>
  );
}

export default function DirectoryPage() {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('team');
  const [q, setQ] = useState('');
  const team = useTeamDirectory();
  const company = useCompanyDirectory();

  const active = tab === 'team' ? team : company;
  const matches = (u: DirectoryUser) =>
    `${u.firstName} ${u.lastName} ${u.role} ${u.team ?? ''} ${u.subDepartment ?? ''} ${u.designation ?? ''}`.toLowerCase().includes(q.trim().toLowerCase());

  const list = useMemo(() => (active.data ?? []).filter(matches), [active.data, q]);

  // Company tab groups by team.
  const grouped = useMemo(() => {
    if (tab !== 'company') return null;
    const m = new Map<string, DirectoryUser[]>();
    for (const u of list) { const k = u.team ?? 'Unassigned'; (m.get(k) ?? m.set(k, []).get(k)!).push(u); }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [list, tab]);

  return (
    <div>
      <div className="ph">
        <div className="ph-left"><div className="ph-title">Directory</div><div className="ph-sub">Find people across Leveraged Growth</div></div>
        <div className="ph-actions">
          <div className="tl-tabs">
            <button className={`tl-tab${tab === 'team' ? ' active' : ''}`} onClick={() => setTab('team')}>Team Directory</button>
            <button className={`tl-tab${tab === 'company' ? ' active' : ''}`} onClick={() => setTab('company')}>Company Directory</button>
          </div>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={16} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted2)' }} />
            <input className="fc" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 30, width: 220 }} />
          </div>
        </div>
      </div>

      {active.isLoading ? (
        <div className="empty-state"><span className="ei material-symbols-outlined">hourglass_empty</span><p>Loading…</p></div>
      ) : list.length === 0 ? (
        <div className="empty-state"><span className="ei material-symbols-outlined">contacts</span><p>No people found</p></div>
      ) : grouped ? (
        grouped.map(([teamName, members]) => (
          <div key={teamName} className="dir-team-section" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--p)', marginBottom: 10 }}>{teamName} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({members.length})</span></h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {members.map((u) => <DirCard key={u.empId} u={u} isYou={u.empId === currentUser?.empId} />)}
            </div>
          </div>
        ))
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {list.map((u) => <DirCard key={u.empId} u={u} isYou={u.empId === currentUser?.empId} />)}
        </div>
      )}
    </div>
  );
}
