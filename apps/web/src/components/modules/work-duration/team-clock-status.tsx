'use client';

import { useEffect, useState } from 'react';
import { useTeamClockStatus, hmsFromMs, hmsFromMin } from '../../../hooks/use-work-duration';
import { Spinner } from '../../ui/spinner';

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-[#3FB950]/20 text-[#3FB950]',
  ON_BREAK: 'bg-[#E3B341]/20 text-[#E3B341]',
  COMPLETED: 'bg-[#8B949E]/20 text-[#8B949E]',
  AUTO_CLOSED: 'bg-[#8B949E]/20 text-[#8B949E]',
  IDLE: 'bg-[#30363D] text-[#8B949E]',
};

export function TeamClockStatus() {
  const { data: rows, isLoading } = useTeamClockStatus();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (isLoading) return <div className="flex items-center gap-2 text-[#8B949E]"><Spinner size={16} /> Loading…</div>;
  if (!rows || rows.length === 0) return <p className="text-sm text-[#8B949E]">No team members.</p>;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => {
        const initials = r.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
        const live = r.status === 'ACTIVE' && r.clockInTs ? hmsFromMs(now - new Date(r.clockInTs).getTime()) : null;
        return (
          <div key={r.empId} className="flex items-center gap-3 rounded-[6px] border border-[#30363D] bg-[#21262D] p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#58A6FF] text-xs font-semibold text-white">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-[#E6EDF3]">{r.name}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <span className={`rounded-[9999px] px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[r.status] ?? STATUS_STYLE.IDLE}`}>{r.status}</span>
                {r.clockInTs && <span className="text-xs text-[#8B949E]">in {new Date(r.clockInTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
              </div>
            </div>
            <span className="shrink-0 font-mono text-xs text-[#8B949E]">{live ?? hmsFromMin(r.netWorkMins)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default TeamClockStatus;
