'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ClockStatus, TeamClockRow } from '../lib/types';

const data = <T>(res: { data: { data: T } }): T => res.data.data;

export function useWorkDurationStatus() {
  return useQuery({
    queryKey: ['work-duration', 'status'],
    queryFn: async () => data<ClockStatus>(await api.get('/work-duration/status')),
    refetchInterval: (q) => {
      const status = (q.state.data as ClockStatus | undefined)?.status;
      return status === 'ACTIVE' || status === 'ON_BREAK' ? 30_000 : false;
    },
  });
}

export function useTeamClockStatus() {
  return useQuery({
    queryKey: ['work-duration', 'team-status'],
    queryFn: async () => data<TeamClockRow[]>(await api.get('/work-duration/team-status')),
    refetchInterval: 30_000,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['work-duration'] });
  qc.invalidateQueries({ queryKey: ['work-logs'] });
}

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.post('/work-duration/clock-in'), onSuccess: () => invalidate(qc) });
}
export function useStartBreak() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.post('/work-duration/break/start'), onSuccess: () => invalidate(qc) });
}
export function useEndBreak() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.post('/work-duration/break/end'), onSuccess: () => invalidate(qc) });
}
export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto?: { customTime?: string; reason?: string }) => api.post('/work-duration/clock-out', dto ?? {}),
    onSuccess: () => invalidate(qc),
  });
}
export function useEditTime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { startTime: string; endTime?: string; breakMins?: number; reason: string }) =>
      api.patch('/work-duration/edit-time', dto),
    onSuccess: () => invalidate(qc),
  });
}
export function useEditBreak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { breakMins: number }) => api.patch('/work-duration/edit-break', dto),
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
