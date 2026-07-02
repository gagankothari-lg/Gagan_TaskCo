'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../../../hooks/use-auth';
import { isAdmin, isManager } from '../../../../lib/auth';
import { useTeamWorkLogs, useTeamOverview } from '../../../../lib/api/workLog';
import { useHolidays } from '../../../../lib/api/leaves';
import { toast } from '../../../../lib/toast';
import { MemberLogModal } from '../../../../components/modules/work-log/member-log-modal';
import { DayMemberCard } from '../../../../components/modules/work-log/team/day-member-card';
import { WeekMemberCard } from '../../../../components/modules/work-log/team/week-member-card';
import { MonthMemberCard } from '../../../../components/modules/work-log/team/month-member-card';
import { Icon } from '../../../../components/ui/icon';
import { Spinner } from '../../../../components/ui/spinner';
import type { TeamOverviewRow, WorkLogEntry } from '../../../../lib/types';

type Period = 'day' | 'week' | 'month' | 'custom';
type ViewMode = 'member' | 'date';

// ─── Date helpers (local-time safe ISO) ───────────────────────────
function iso(d: Date): string {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const fmtShort = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtMonth = (d: Date) => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

interface MemberInfo {
  empId: string;
  name: string;
  team: string;
}

export default function TeamWorkLogPage() {
  const { currentUser, employees } = useAuth();
  const [period, setPeriod] = useState<Period>('day');
  const [view, setView] = useState<ViewMode>('member');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(null);
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('');

  // ── Resolve the active [start,end] range from period + anchor / custom ──
  const range = useMemo<{ start: Date; end: Date; label: string }>(() => {
    if (period === 'day') return { start: anchor, end: anchor, label: fmtDay(anchor) };
    if (period === 'week') {
      const s = mondayOf(anchor);
      const e = addDays(s, 6);
      return { start: s, end: e, label: `${fmtShort(s)} – ${fmtShort(e)}, ${e.getFullYear()}` };
    }
    if (period === 'month') {
      const s = startOfMonth(anchor);
      const e = endOfMonth(anchor);
      return { start: s, end: e, label: fmtMonth(anchor) };
    }
    // custom
    if (applied) {
      const s = new Date(`${applied.from}T00:00:00`);
      const e = new Date(`${applied.to}T00:00:00`);
      return { start: s, end: e, label: `${fmtShort(s)} – ${fmtShort(e)}, ${e.getFullYear()}` };
    }
    return { start: anchor, end: anchor, label: 'Select a date range' };
  }, [period, anchor, applied]);

  const monthKey = useMemo(() => iso(range.start).slice(0, 7), [range.start]);
  const useOverview = period === 'month';
  const periodDays = useMemo(() => daysBetween(range.start, range.end) + 1, [range.start, range.end]);

  const { data: teamData, isLoading: logsLoading, refetch: refetchLogs } = useTeamWorkLogs(
    useOverview ? undefined : iso(range.start),
    useOverview ? undefined : iso(range.end),
  );
  const { data: overview, isLoading: ovLoading, refetch: refetchOverview } = useTeamOverview(useOverview ? monthKey : '');
  const { data: holidays } = useHolidays();
  const holidaySet = useMemo(() => new Set((holidays ?? []).map((h) => h.date.slice(0, 10))), [holidays]);

  const logs = useMemo(() => teamData?.logs ?? [], [teamData]);

  // ── Member roster (everyone we know about), with team + display name ──
  const roster = useMemo<MemberInfo[]>(() => {
    const map = new Map<string, MemberInfo>();
    employees.forEach((e) => {
      const name = e.displayName || `${e.firstName} ${e.lastName}`.trim() || e.empId;
      map.set(e.empId, { empId: e.empId, name, team: e.team || 'Unassigned' });
    });
    // Fold in any empId present in the data but missing from the roster.
    logs.forEach((l) => {
      if (!map.has(l.empId)) map.set(l.empId, { empId: l.empId, name: l.empId, team: 'Unassigned' });
    });
    (overview ?? []).forEach((r) => {
      if (!map.has(r.empId)) map.set(r.empId, { empId: r.empId, name: r.name, team: 'Unassigned' });
      else if (map.get(r.empId)!.name === r.empId) map.get(r.empId)!.name = r.name;
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, logs, overview]);

  const teamName = useMemo(() => {
    const m = new Map<string, string>();
    roster.forEach((r) => m.set(r.empId, r.team));
    return m;
  }, [roster]);

  // ── Active-member count for the subtitle ──
  const activeCount = useMemo(() => {
    if (useOverview) {
      return (overview ?? []).filter((r) => r.P + r.LF + r.LH + r.H + r.W + r.AW + r.EF + r.EH > 0).length;
    }
    return new Set(logs.filter((l) => l.attendance).map((l) => l.empId)).size;
  }, [useOverview, overview, logs]);

  const isLoading = useOverview ? ovLoading : logsLoading;

  // ── BY MEMBER: each member's logs keyed by date ──
  const logsByMember = useMemo(() => {
    const byMember = new Map<string, Map<string, WorkLogEntry>>();
    logs.forEach((l) => {
      const d = l.date.slice(0, 10);
      let m = byMember.get(l.empId);
      if (!m) {
        m = new Map<string, WorkLogEntry>();
        byMember.set(l.empId, m);
      }
      m.set(d, l);
    });
    return byMember;
  }, [logs]);

  // Custom mode has no server-side "overview" endpoint (that's month-keyed only), so the
  // Month/Custom card's P/LF/LH/H/W/AW/EF/EH + OT aggregate is built client-side here from
  // the already-fetched range logs — same classification + OT formula as the backend's
  // getTeamWorkLogOverview (Master Reference Part 17 Change #46).
  const customOverview = useMemo<TeamOverviewRow[]>(() => {
    if (period !== 'custom') return [];
    return roster.map((m) => {
      const c: TeamOverviewRow = { empId: m.empId, name: m.name, P: 0, LF: 0, LH: 0, H: 0, W: 0, AW: 0, EF: 0, EH: 0, otHours: 0 };
      let otSum = 0;
      Array.from(logsByMember.get(m.empId)?.values() ?? []).forEach((l) => {
        const a = (l.attendance ?? '').toLowerCase();
        if (a.includes('extra') && a.includes('full')) c.EF++;
        else if (a.includes('extra') && a.includes('half')) c.EH++;
        else if (a.includes('alt') && a.includes('week')) c.AW++;
        else if (a.includes('week') && a.includes('off')) c.W++;
        else if (a.includes('holiday')) c.H++;
        else if (a.includes('half')) c.LH++;
        else if (a.includes('leave') || a.includes('absent')) c.LF++;
        else if (a) c.P++;
        otSum += l.extraHours ?? 0;
      });
      c.otHours = Math.round((otSum + c.EF * 9 + c.EH * 4) * 10) / 10;
      return c;
    });
  }, [period, roster, logsByMember]);

  // ── BY DATE: group entries by date (newest first), optional member filter ──
  const byDateGroups = useMemo(() => {
    const byDate = new Map<string, WorkLogEntry[]>();
    logs
      .filter((l) => !dateFilter || l.empId === dateFilter)
      .forEach((l) => {
        const d = l.date.slice(0, 10);
        const list = byDate.get(d) ?? [];
        list.push(l);
        byDate.set(d, list);
      });
    return Array.from(byDate.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, entries]) => ({ date, entries: entries.sort((a, b) => a.empId.localeCompare(b.empId)) }));
  }, [logs, dateFilter]);
  const byDateEntryCount = useMemo(() => byDateGroups.reduce((sum, g) => sum + g.entries.length, 0), [byDateGroups]);

  if (!currentUser) return null;
  if (!isManager(currentUser.role)) {
    return (
      <div style={{ padding: 24 }}>
        <div className="empty-state">
          <Icon name="lock" className="ei" />
          <p>You don&apos;t have access to this page.</p>
        </div>
      </div>
    );
  }

  const admin = isAdmin(currentUser.role);

  // Custom-range validation fires as a toast on Apply click (Part 37 checklist exact
  // wording), rather than silently disabling the button.
  const applyCustom = () => {
    if (!customFrom || !customTo) { toast('Please select both a start and end date.', 'warn'); return; }
    const f = new Date(`${customFrom}T00:00:00`);
    const t = new Date(`${customTo}T00:00:00`);
    if (f > t) { toast('Start date must be before end date.', 'warn'); return; }
    if (daysBetween(f, t) > 90) { toast('Custom range cannot exceed 90 days.', 'warn'); return; }
    setApplied({ from: customFrom, to: customTo });
  };

  const refresh = () => {
    if (useOverview) void refetchOverview();
    else void refetchLogs();
  };

  const navLabel =
    period === 'day' ? 'Today' : period === 'week' ? 'This week' : period === 'month' ? 'This month' : '';
  const stepAnchor = (dir: -1 | 1) => {
    if (period === 'day') setAnchor((a) => addDays(a, dir));
    else if (period === 'week') setAnchor((a) => addDays(a, dir * 7));
    else if (period === 'month') setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
  };

  const openMember = (m: MemberInfo) => setMember(m);

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div className="ph">
        <div className="ph-left">
          <div className="ph-title">Team Work Logs</div>
          <div className="ph-sub">
            {view === 'date'
              ? `${range.label} — ${byDateEntryCount} entr${byDateEntryCount === 1 ? 'y' : 'ies'} across ${byDateGroups.length} day${byDateGroups.length === 1 ? '' : 's'}`
              : `${range.label} — ${activeCount}/${roster.length} members active`}
          </div>
        </div>
      </div>

      {/* Period tabs + nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="tl-tabs">
          {(['day', 'week', 'month', 'custom'] as Period[]).map((p) => (
            <button key={p} className={`tl-tab${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>
              {p === 'day' ? 'Day' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Custom'}
            </button>
          ))}
        </div>

        {period !== 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="btn btn-ghost btn-sm" aria-label="Previous" onClick={() => stepAnchor(-1)}><Icon name="chevron_left" size={16} /></button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAnchor(new Date())}>{navLabel}</button>
            <button className="btn btn-ghost btn-sm" aria-label="Next" onClick={() => stepAnchor(1)}><Icon name="chevron_right" size={16} /></button>
          </div>
        )}

        {/* View tabs + refresh (right-aligned) */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="tl-tabs">
            <button className={`tl-tab${view === 'member' ? ' active' : ''}`} onClick={() => setView('member')}>
              <Icon name="person" size={14} style={{ marginRight: 4 }} /> By Member
            </button>
            <button className={`tl-tab${view === 'date' ? ' active' : ''}`} onClick={() => setView('date')}>
              <Icon name="calendar_month" size={14} style={{ marginRight: 4 }} /> By Date
            </button>
          </div>
          <button className="btn btn-ghost btn-sm" aria-label="Refresh" onClick={refresh}><Icon name="refresh" size={16} /></button>
        </div>
      </div>

      {/* Custom range bar */}
      {period === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)' }}>
            From
            <input type="date" className="fc" style={{ width: 170 }} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)' }}>
            To
            <input type="date" className="fc" style={{ width: 170 }} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </label>
          <button className="btn btn-primary btn-sm" onClick={applyCustom}>Apply</button>
        </div>
      )}

      {/* By Date member filter */}
      {view === 'date' && (
        <div style={{ marginBottom: 12 }}>
          <select className="fc" style={{ width: 240 }} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option value="">All members</option>
            {roster.map((m) => <option key={m.empId} value={m.empId}>{m.name}</option>)}
          </select>
        </div>
      )}

      {/* Body */}
      {period === 'custom' && !applied ? (
        <div className="empty-state">
          <Icon name="date_range" className="ei" />
          <p>Pick a date range and press Apply.</p>
        </div>
      ) : isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}><Spinner size={16} /> Loading…</div>
      ) : view === 'member' ? (
        useOverview ? (
          <MemberGrid
            admin={admin}
            members={(overview ?? []).map((r) => ({ empId: r.empId, name: r.name, team: teamName.get(r.empId) ?? 'Unassigned' }))}
            renderCard={(m) => {
              const row = (overview ?? []).find((r) => r.empId === m.empId);
              if (!row) return null;
              return <MonthMemberCard key={m.empId} row={row} team={m.team} periodDays={periodDays} onClick={() => openMember(m)} />;
            }}
          />
        ) : period === 'custom' ? (
          <MemberGrid
            admin={admin}
            members={roster}
            renderCard={(m) => {
              const row = customOverview.find((r) => r.empId === m.empId);
              if (!row) return null;
              return <MonthMemberCard key={m.empId} row={row} team={m.team} periodDays={periodDays} onClick={() => openMember(m)} />;
            }}
          />
        ) : period === 'week' ? (
          <MemberGrid
            admin={admin}
            members={roster}
            renderCard={(m) => (
              <WeekMemberCard
                key={m.empId}
                empId={m.empId}
                name={m.name}
                team={m.team}
                week={weekEntries(range.start, logsByMember.get(m.empId))}
                weekDates={Array.from({ length: 7 }, (_, i) => addDays(range.start, i))}
                holidays={holidaySet}
                onClick={() => openMember(m)}
              />
            )}
          />
        ) : (
          <MemberGrid
            admin={admin}
            members={roster}
            renderCard={(m) => (
              <DayMemberCard
                key={m.empId}
                empId={m.empId}
                name={m.name}
                team={m.team}
                entry={logsByMember.get(m.empId)?.get(iso(range.start))}
                onClick={() => openMember(m)}
              />
            )}
          />
        )
      ) : byDateGroups.length === 0 ? (
        <div className="empty-state">
          <Icon name="event_busy" className="ei" />
          <p>No work logs in this period.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {byDateGroups.map(({ date, entries }) => (
            <div key={date}>
              <div className="team-log-day" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                <span style={{ color: 'var(--muted)', fontWeight: 600, marginLeft: 6 }}>— {entries.length} submission{entries.length === 1 ? '' : 's'}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {entries.map((e) => {
                  const info = roster.find((r) => r.empId === e.empId) ?? { empId: e.empId, name: e.empId, team: 'Unassigned' };
                  // By-Date is read-only (Part 37) — no onClick, so it never opens the member modal.
                  return (
                    <DayMemberCard key={`${date}:${e.empId}`} empId={info.empId} name={info.name} team={info.team} entry={e} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {member && (
        <MemberLogModal
          empId={member.empId}
          empName={member.name}
          onClose={() => setMember(null)}
          teamPeriod={period}
          teamAnchor={anchor}
          teamRangeStart={range.start}
          teamRangeEnd={range.end}
        />
      )}
    </div>
  );
}

// ─── Card grid; groups under team headers for Super Admin / Admin ──────────
function MemberGrid({
  admin,
  members,
  renderCard,
}: {
  admin: boolean;
  members: MemberInfo[];
  renderCard: (m: MemberInfo) => React.ReactNode;
}) {
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 };

  if (members.length === 0) {
    return (
      <div className="empty-state">
        <Icon name="groups" className="ei" />
        <p>No team members to show.</p>
      </div>
    );
  }

  if (!admin) {
    return <div style={gridStyle}>{members.map((m) => renderCard(m))}</div>;
  }

  // SA/Admin: section per team.
  const teams = new Map<string, MemberInfo[]>();
  members.forEach((m) => {
    const list = teams.get(m.team) ?? [];
    list.push(m);
    teams.set(m.team, list);
  });
  const sections = Array.from(teams.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sections.map(([team, list]) => (
        <div key={team}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 8 }}>
            {team} <span style={{ color: 'var(--muted2)' }}>· {list.length}</span>
          </div>
          <div style={gridStyle}>{list.map((m) => renderCard(m))}</div>
        </div>
      ))}
    </div>
  );
}

// 7 entries (Mon→Sun) for a member, given the week's Monday and their date-map.
function weekEntries(weekStart: Date, byDate: Map<string, WorkLogEntry> | undefined): (WorkLogEntry | undefined)[] {
  return Array.from({ length: 7 }, (_, i) => byDate?.get(iso(addDays(weekStart, i))));
}
