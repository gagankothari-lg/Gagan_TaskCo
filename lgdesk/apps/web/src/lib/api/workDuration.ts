'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { ClockStatus, TeamClockRow } from '../types';

export function useWorkDurationStatus() {
  return useQuery({
    queryKey: ['work-duration', 'status'],
    queryFn: () => apiFetch<ClockStatus>('/work-duration/status'),
    refetchInterval: (q) => {
      const status = (q.state.data as ClockStatus | undefined)?.status;
      return status === 'ACTIVE' || status === 'ON_BREAK' ? 30_000 : false;
    },
  });
}

// Daily check-in popup (Feature 1). isWorking === null means today hasn't been answered
// yet -- the frontend uses that to decide whether to show the modal on load.
export interface DailyStatus {
  isWorking: boolean | null;
  workMode: string | null;
}

export function useDailyStatus(enabled = true) {
  return useQuery({
    queryKey: ['work-duration', 'daily-status'],
    queryFn: () => apiFetch<DailyStatus>('/work-duration/daily-status'),
    enabled,
  });
}

export function useSetDailyStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { isWorking: boolean; workMode?: 'WFO' | 'WFH' }) =>
      apiFetch<ClockStatus>('/work-duration/daily-status', { method: 'POST', body: dto }),
    onSuccess: () => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: ['work-duration', 'daily-status'] });
    },
  });
}

export function useTeamClockStatus() {
  return useQuery({
    queryKey: ['work-duration', 'team-status'],
    queryFn: () => apiFetch<TeamClockRow[]>('/work-duration/team-status'),
    refetchInterval: 30_000,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['work-duration'] });
  qc.invalidateQueries({ queryKey: ['work-logs'] });
}

// The clock-action endpoints all return the same ClockStatus envelope as GET /status
// (each backend method ends with `return this.getStatus(empId)`), so callers can read
// e.g. the just-closed session's netMinutes straight off the mutation result.
export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => apiFetch<ClockStatus>('/work-duration/clock-in', { method: 'POST' }), onSuccess: () => invalidate(qc) });
}
export function useStartBreak() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => apiFetch<ClockStatus>('/work-duration/break/start', { method: 'POST' }), onSuccess: () => invalidate(qc) });
}
export function useEndBreak() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => apiFetch<ClockStatus>('/work-duration/break/end', { method: 'POST' }), onSuccess: () => invalidate(qc) });
}
export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto?: { customTime?: string; reason?: string }) => apiFetch<ClockStatus>('/work-duration/clock-out', { method: 'POST', body: dto ?? {} }),
    onSuccess: () => invalidate(qc),
  });
}
export function useEditTime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { startTime: string; endTime?: string; breakMins?: number; reason: string }) =>
      apiFetch<void>('/work-duration/edit-time', { method: 'PATCH', body: dto }),
    onSuccess: () => invalidate(qc),
  });
}
export function useEditBreak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { breakMins: number }) => apiFetch<void>('/work-duration/edit-break', { method: 'PATCH', body: dto }),
    onSuccess: () => invalidate(qc),
  });
}

// HH:MM:SS for an elapsed millisecond count.
export function hmsFromMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function hmsFromMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

// AUDIT_REPORT.md A3 item 6: clock-in/out instants must be displayed as IST wall-clock time
// (the value the user actually typed/saw), not the browser's local time or raw UTC digits —
// `.toISOString().slice(11, 16)` shows UTC and is wrong for IST users. Single source of truth
// for this conversion so every "Edit today's times" prefill stays in lockstep.
export function istHHMM(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Round5 #15: client-side mirror of work-duration.service.ts's private `applyTime` — builds
// the instant `hhmm` resolves to when anchored to `anchorIso`'s IST calendar day (optionally
// shifted by `dayOffset` whole days first). Kept in lockstep with the backend's exact
// semantics so the ambiguity check below matches what the server will actually do, without
// a round-trip.
export function applyTimeIst(anchorIso: string, hhmm: string, dayOffset = 0): Date {
  const [hh, mm] = hhmm.split(':').map(Number);
  const anchor = new Date(anchorIso);
  const shifted = dayOffset ? new Date(anchor.getTime() + dayOffset * 86400000) : anchor;
  const dateStr = shifted.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return new Date(`${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+05:30`);
}

// Round5 #15: returns the resulting shift length in hours for the next-day interpretation
// ONLY when the same-day reading of `hhmm` would land at-or-before `afterIso` — the exact
// ambiguity work-duration.service.ts's applyTime resolver silently retries on server-side
// (a bare HH:MM plus a clock-in instant can't distinguish a typo from a genuine overnight
// shift). Returns null for an unambiguous entry — no confirmation needed, most entries.
export function crossMidnightHours(afterIso: string, hhmm: string): number | null {
  const after = new Date(afterIso);
  const sameDay = applyTimeIst(afterIso, hhmm, 0);
  if (sameDay > after) return null;
  const nextDay = applyTimeIst(afterIso, hhmm, 1);
  return Math.round(((nextDay.getTime() - after.getTime()) / 3600000) * 10) / 10;
}
