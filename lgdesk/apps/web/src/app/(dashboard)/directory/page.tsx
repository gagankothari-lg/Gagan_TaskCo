'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { useTeamDirectory, useCompanyDirectory, type DirectoryUser } from '../../../hooks/use-directory';
import { Icon } from '../../../components/ui/icon';
import { avatarColor, initials, rolePillClass } from '../../../lib/utils';

type Tab = 'team' | 'company';

function DirCard({ u, isYou }: { u: DirectoryUser; isYou: boolean }) {
  const name = `${u.firstName} ${u.lastName}`;
  const openChat = () => { if (u.chatSpaceLink) window.open(u.chatSpaceLink, '_blank'); };
  return (
    <div className="dir-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: avatarColor(u.empId), color: '#fff', fontWeight: 700, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(name)}</div>
          <span className="pres-dot pres-online" style={{ position: 'absolute', bottom: 2, right: 2 }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{name} {isYou && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>(You)</span>}</div>
          <span className={rolePillClass(u.role)}>{u.role}</span>
        </div>
      </div>
      {u.designation && <div style={{ fontSize: 12, color: '#424242' }}>{u.designation}</div>}
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.team}{u.subDepartment ? ` · ${u.subDepartment}` : ''}</div>
      <div style={{ fontSize: 11, color: '#1565c0' }}>{u.email}</div>
      {u.managerName && <div style={{ fontSize: 11, color: '#9e9e9e' }}>Reports to: {u.managerName}</div>}
      {!isYou && (
        <div className="dir-card-actions">
          <a className="btn btn-sm" href={`mailto:${u.email}`} style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}><Icon name="mail" size={15} /> Email</a>
          <button className="btn btn-sm" onClick={openChat} style={{ background: 'transparent', color: 'var(--p)', border: '1px solid var(--p)' }}><Icon name="chat" size={15} /> Chat</button>
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
    list.forEach((u) => {
      const k = u.team ?? 'Unassigned';
      const arr = m.get(k);
      if (arr) arr.push(u);
      else m.set(k, [u]);
    });
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
        <div className="empty-state"><Icon name="hourglass_empty" size={40} className="ei" /><p>Loading…</p></div>
      ) : list.length === 0 ? (
        <div className="empty-state"><Icon name="contacts" size={40} className="ei" /><p>No people found</p></div>
      ) : grouped ? (
        grouped.map(([teamName, members]) => (
          <div key={teamName} className="dir-team-section" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f5f5', padding: '10px 16px', borderRadius: 6, marginBottom: 16 }}>
              <Icon name="groups" size={18} style={{ color: 'var(--p)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text)' }}>{teamName}</span>
              <span className="pill pill-Admin" style={{ marginLeft: 'auto' }}>{members.length} members</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {members.map((u) => <DirCard key={u.empId} u={u} isYou={u.empId === currentUser?.empId} />)}
            </div>
          </div>
        ))
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {list.map((u) => <DirCard key={u.empId} u={u} isYou={u.empId === currentUser?.empId} />)}
        </div>
      )}
    </div>
  );
}
