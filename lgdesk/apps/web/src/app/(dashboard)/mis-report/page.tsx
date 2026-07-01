'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useMisSummaries } from '../../../lib/api/weeklySummary';
import { apiErrorMessage, ApiError } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { Spinner } from '../../../components/ui/spinner';
import { Badge } from '../../../components/ui/badge';

function mondayOf(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const iso = (d: Date) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };

// Master Reference Part 19 "MIS Report" — access gated by hasMisAccess (MIS_Access
// table), independent of role. #nav-mis-report visibility is already handled in
// layout-client.tsx; this page additionally handles a direct-URL visit by a
// not-in-MIS_Access caller (backend 403 -> friendly message, not a crash).
export default function MisReportPage() {
  const [anchor, setAnchor] = useState(() => new Date());
  const weekStart = iso(mondayOf(anchor));
  const weekEnd = addDays(mondayOf(anchor), 6);

  const { data, isLoading, isError, error } = useMisSummaries(weekStart);

  const forbidden = isError && error instanceof ApiError && error.status === 403;

  const summary = useMemo(() => {
    if (!data) return null;
    return { submitted: data.submitted, total: data.total, pct: data.total ? Math.round((data.submitted / data.total) * 100) : 0 };
  }, [data]);

  function exportCsv() {
    if (!data) return;
    const header = ['Emp ID', 'Name', 'Team', 'Role', 'Status', 'Summary'];
    const lines = [header.join(',')];
    for (const r of data.rows) {
      const cell = (s: string) => `"${s.replace(/"/g, '""')}"`;
      lines.push([
        cell(r.empId),
        cell(r.name),
        cell(r.team ?? ''),
        cell(r.role),
        cell(r.found ? 'Submitted' : 'Missing'),
        cell(r.bullets.join(' | ')),
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mis-report_${weekStart}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('MIS report exported', 'success');
  }

  if (forbidden) {
    return (
      <div className="p-6">
        <div className="empty-state">
          <Icon name="lock" size={40} className="ei" />
          <p>You don&apos;t have access to the MIS Report.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="ph">
        <div className="ph-left">
          <div className="ph-title">MIS Report</div>
          <div className="ph-sub">Weekly summaries across the organisation</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" disabled={!data} onClick={exportCsv}>
            <Icon name="download" size={15} /> Export
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setAnchor((a) => addDays(a, -7))} aria-label="Previous week" className="rounded-[8px] border border-border p-1.5 text-muted hover:bg-p3"><Icon name="chevron_left" size={16} /></button>
          <button onClick={() => setAnchor(new Date())} className="rounded-[8px] border border-border px-3 py-1.5 text-sm text-text hover:bg-p3">This week</button>
          <button onClick={() => setAnchor((a) => addDays(a, 7))} aria-label="Next week" className="rounded-[8px] border border-border p-1.5 text-muted hover:bg-p3"><Icon name="chevron_right" size={16} /></button>
        </div>
        <div className="text-sm font-semibold text-text">
          {mondayOf(anchor).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        {summary && (
          <span className="ml-auto text-xs text-muted">{summary.submitted}/{summary.total} submitted ({summary.pct}%)</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted"><Spinner size={16} /> Loading…</div>
      ) : isError ? (
        <div className="empty-state">
          <Icon name="error" size={40} className="ei" />
          <p>{apiErrorMessage(error, 'Unable to load MIS summaries')}</p>
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="empty-state">
          <Icon name="assessment" size={40} className="ei" />
          <p>No employees found for this week.</p>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Team</th>
                <th>Role</th>
                <th>Status</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.empId}>
                  <td className="font-medium text-text">{r.name}</td>
                  <td className="text-muted">{r.team ?? '—'}</td>
                  <td className="text-muted">{r.role}</td>
                  <td>
                    <Badge variant={r.found ? 'success' : 'warning'}>{r.found ? 'Submitted' : 'Missing'}</Badge>
                    {r.isEdited && <span className="ml-1.5 text-[10px] text-muted2">edited</span>}
                  </td>
                  <td className="max-w-[420px] text-muted">
                    {r.bullets.length === 0 ? '—' : (
                      <ul className="list-disc space-y-0.5 pl-4">
                        {r.bullets.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
