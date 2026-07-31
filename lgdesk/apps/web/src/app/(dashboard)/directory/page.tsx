'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { useTeamDirectory, useCompanyDirectory, type DirectoryUser } from '../../../lib/api/directory';
import { Icon } from '../../../components/ui/icon';
import { avatarColor, initials, rolePillClass } from '../../../lib/utils';

type Tab = 'team' | 'company';

function DirTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      className={`dir-tab${active ? ' active' : ''}`}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid var(--p)' : '2px solid transparent',
        marginBottom: -2,
        padding: '8px 20px',
        fontSize: 13,
        fontWeight: 600,
        color: active ? 'var(--p)' : hover ? 'var(--text)' : 'var(--muted)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'color .15s, border-color .15s',
      }}
    >
      {children}
    </button>
  );
}

function DirCard({ u, isYou }: { u: DirectoryUser; isYou: boolean }) {
  const name = `${u.firstName} ${u.lastName}`;
  const [hover, setHover] = useState(false);
  const openChat = () => { if (u.chatSpaceLink) window.open(u.chatSpaceLink, '_blank'); };
  return (
    <div
      className="dir-card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 5,
        padding: '20px 16px',
        transition: 'box-shadow .15s, transform .1s',
        boxShadow: hover ? '0 4px 14px rgba(0,0,0,.14)' : undefined,
        transform: hover ? 'translateY(-2px)' : undefined,
      }}
    >
      <div style={{ position: 'relative', display: 'inline-flex', marginBottom: 6 }}>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: avatarColor(u.empId), color: '#fff', fontWeight: 700, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(name)}</div>
        <span className="pres-dot pres-online" style={{ position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, border: '2px solid var(--surface)' }} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{name} {isYou && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>(You)</span>}</div>
      <span className={rolePillClass(u.role)}>{u.role}</span>
      {u.designation && <div style={{ fontSize: 12, color: 'var(--text)', fontStyle: 'italic', marginTop: 3 }}>{u.designation}</div>}
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{u.team}{u.subDepartment ? ` · ${u.subDepartment}` : ''}</div>
      <div style={{ fontSize: 11, color: 'var(--p2)', wordBreak: 'break-all', marginTop: 2 }}>{u.email}</div>
      {u.managerName && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Reports to: {u.managerName}</div>}
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

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    const matches = (u: DirectoryUser) =>
      `${u.firstName} ${u.lastName} ${u.role} ${u.team ?? ''} ${u.subDepartment ?? ''} ${u.designation ?? ''}`.toLowerCase().includes(query);
    return (active.data ?? []).filter(matches);
  }, [active.data, q]);

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
        <div className="ph-left">
          <div className="ph-title">Directory</div>
          <div className="ph-sub">{tab === 'team' ? 'Your team colleagues' : 'Everyone across Leveraged Growth'}</div>
        </div>
        <div className="ph-actions">
          <input
            className="fc"
            style={{ width: 220 }}
            id="dir-search"
            placeholder="Search by name, role, team…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 18, gap: 0 }}>
        <DirTab active={tab === 'team'} onClick={() => setTab('team')}>Team Directory</DirTab>
        <DirTab active={tab === 'company'} onClick={() => setTab('company')}>Company Directory</DirTab>
      </div>

      {active.isLoading ? (
        <div className="empty-state"><Icon name="hourglass_empty" size={40} className="ei" /><p>Loading…</p></div>
      ) : list.length === 0 ? (
        <div className="empty-state"><Icon name="contacts" size={40} className="ei" /><p>No people found</p></div>
      ) : grouped ? (
        grouped.map(([teamName, members]) => (
          <div key={teamName} className="dir-team-section" style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0 8px', borderBottom: '2px solid var(--p3)', marginBottom: 14 }}>
              <Icon name="groups" size={18} style={{ color: 'var(--p)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--p)' }}>{teamName}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 500, color: 'var(--muted)', background: 'var(--bg)', border: '1px solid var(--border)', padding: '1px 8px', borderRadius: 10 }}>{members.length} {members.length === 1 ? 'member' : 'members'}</span>
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
