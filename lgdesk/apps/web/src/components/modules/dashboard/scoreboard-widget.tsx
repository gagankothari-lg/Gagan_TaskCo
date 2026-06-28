'use client';

import { Icon } from '../../ui/icon';
import type { ScoreboardRow } from '../../../lib/types';

const RANK_COLOR = ['#E3B341', '#C0C0C0', '#CD7F32']; // gold, silver, bronze

export function ScoreboardWidget({ rows }: { rows: ScoreboardRow[] }) {
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
      <h3 className="mb-3 text-sm font-medium text-[var(--text)]">Scoreboard</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No data.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const initials = r.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
            const color = RANK_COLOR[r.rank - 1];
            return (
              <div key={r.empId} className="flex items-center gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] p-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={color ? { backgroundColor: `${color}30`, color } : { color: 'var(--muted)' }}>
                  {r.rank}
                </span>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--p)] text-[10px] font-semibold text-white">{initials}</div>
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">{r.name}</span>
                <div className="flex items-center gap-2.5 text-xs text-[var(--muted)]">
                  <span className="inline-flex items-center gap-0.5"><Icon name="check" size={11} className="text-[var(--ok)]" />{r.done}</span>
                  <span className="inline-flex items-center gap-0.5"><Icon name="refresh" size={11} className="text-[var(--p)]" />{r.inProg}</span>
                  <span className="inline-flex items-center gap-0.5"><Icon name="warning" size={11} className="text-[var(--danger)]" />{r.overdue}</span>
                </div>
                <span className="w-10 shrink-0 text-right text-lg font-semibold text-[var(--p)]">{r.score}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ScoreboardWidget;
