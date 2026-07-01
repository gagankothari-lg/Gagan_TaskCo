'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { WorkLogEntry, WorkLogInput, TeamOverviewRow, Holiday } from '../types';

export const ATTENDANCE_TYPES = [
  'Present',
  'Leave Full Day',
  'Leave Half Day',
  'Alternate Week Off',
  'Week Off',
  'Holiday',
  'Extra Full Day',
  'Extra Half Day',
];

export function useMyWorkLogs(start?: string, end?: string) {
  return useQuery({
    queryKey: ['work-logs', 'mine', start, end],
    queryFn: () => apiFetch<WorkLogEntry[]>('/work-logs/mine', { params: { start, end } }),
  });
}

export function useTeamWorkLogs(start?: string, end?: string) {
  return useQuery({
    queryKey: ['work-logs', 'team', start, end],
    queryFn: () => apiFetch<{ logs: WorkLogEntry[]; holidays: Holiday[] }>('/work-logs/team', { params: { start, end } }),
  });
}

export function useTeamOverview(month: string) {
  return useQuery({
    queryKey: ['work-logs', 'team-overview', month],
    queryFn: () => apiFetch<TeamOverviewRow[]>('/work-logs/team/overview', { params: { month } }),
  });
}

export function useMemberWorkLogs(empId: string | null, start?: string, end?: string) {
  return useQuery({
    queryKey: ['work-logs', 'member', empId, start, end],
    queryFn: () => apiFetch<WorkLogEntry[]>(`/work-logs/member/${empId}`, { params: { start, end } }),
    enabled: !!empId,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['work-logs'] });
}

export function useSubmitWorkLog() {
  const qc = useQueryClient();
  return useMutation({
    // Strip the `intern` discriminator from the body — it only picks the endpoint.
    // (The API runs ValidationPipe with forbidNonWhitelisted, which rejects unknown fields.)
    mutationFn: ({ intern, ...body }: WorkLogInput & { intern?: boolean }) =>
      apiFetch<WorkLogEntry>(intern ? '/work-logs/intern' : '/work-logs', { method: 'POST', body }),
    onSuccess: () => invalidate(qc),
  });
}

export function useAdminSubmitWorkLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: WorkLogInput & { targetEmpId: string }) => apiFetch<WorkLogEntry>('/work-logs/admin', { method: 'POST', body: dto }),
    onSuccess: () => invalidate(qc),
  });
}

export function useSetWorkLogStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ empId, date, status }: { empId: string; date: string; status: string }) =>
      apiFetch<WorkLogEntry>(`/work-logs/${empId}/${date}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: () => invalidate(qc),
  });
}

export function useSetWorkLogComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ empId, date, comment }: { empId: string; date: string; comment: string }) =>
      apiFetch<WorkLogEntry>(`/work-logs/${empId}/${date}/comment`, { method: 'PATCH', body: { comment } }),
    onSuccess: () => invalidate(qc),
  });
}
