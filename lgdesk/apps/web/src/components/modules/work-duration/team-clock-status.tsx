'use client';

import { useEffect, useState } from 'react';
import { useTeamClockStatus, hmsFromMs, hmsFromMin } from '../../../lib/api/workDuration';
import { Spinner } from '../../ui/spinner';
import { avatarColor } from '../../../lib/avatar-colors';
import { initials as initialsOf } from '../../../lib/utils';

function statusBadge(status: string): { label: string; bg: string; color: string } | null {
  switch (status) {
    case 'ACTIVE': return { label: 'Clocked In', bg: '#e8f5e9', color: '#2e7d32' };
    case 'ON_BREAK': return { label: 'On Break', bg: '#fff3e0', color: '#e65100' };
    case 'COMPLETED':
    case 'AUTO_CLOSED': return { label: 'Done', bg: '#f5f5f5', color: '#757575' };
    default: return null;
  }
}

export function TeamClockStatus() {
  const { data: rows, isLoading } = useTeamClockStatus();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}><Spinner size={16} /> Loading…</div>;
  if (!rows || rows.length === 0) return <p style={{ fontSize: 13, color: 'var(--muted)' }}>No team members.</p>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
      {rows.map((r) => {
        const badge = statusBadge(r.status);
        const live = r.status === 'ACTIVE' && r.clockInTs ? hmsFromMs(now - new Date(r.clockInTs).getTime()) : null;
        const completed = (r.status === 'COMPLETED' || r.status === 'AUTO_CLOSED') && r.netWorkMins > 0 ? hmsFromMin(r.netWorkMins) : null;
        const value = live ?? completed ?? '—';
        const active = !!live;
        return (
          <div key={r.empId} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(r.empId), color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initialsOf(r.name)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                {badge && <span style={{ display: 'inline-block', marginTop: 2, fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: badge.bg, color: badge.color }}>{badge.label}</span>}
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--muted2)' }}>Elapsed</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Courier New', monospace", color: active ? 'var(--p)' : 'var(--muted2)' }}>{value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default TeamClockStatus;
