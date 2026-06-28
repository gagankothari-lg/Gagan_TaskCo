'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { WorkLogEntry, WorkLogInput, TeamOverviewRow, Holiday } from '../lib/types';

const data = <T>(res: { data: { data: T } }): T => res.data.data;

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
    queryFn: async () => data<WorkLogEntry[]>(await api.get('/work-logs/mine', { params: { start, end } })),
  });
}

export function useTeamWorkLogs(start?: string, end?: string) {
  return useQuery({
    queryKey: ['work-logs', 'team', start, end],
    queryFn: async () => data<{ logs: WorkLogEntry[]; holidays: Holiday[] }>(await api.get('/work-logs/team', { params: { start, end } })),
  });
}

export function useTeamOverview(month: string) {
  return useQuery({
    queryKey: ['work-logs', 'team-overview', month],
    queryFn: async () => data<TeamOverviewRow[]>(await api.get('/work-logs/team/overview', { params: { month } })),
  });
}

export function useMemberWorkLogs(empId: string | null, start?: string, end?: string) {
  return useQuery({
    queryKey: ['work-logs', 'member', empId, start, end],
    queryFn: async () => data<WorkLogEntry[]>(await api.get(`/work-logs/member/${empId}`, { params: { start, end } })),
    enabled: !!empId,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['work-logs'] });
}

export function useSubmitWorkLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: WorkLogInput & { intern?: boolean }) =>
      api.post(dto.intern ? '/work-logs/intern' : '/work-logs', dto),
    onSuccess: () => invalidate(qc),
  });
}

export function useAdminSubmitWorkLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: WorkLogInput & { targetEmpId: string }) => api.post('/work-logs/admin', dto),
    onSuccess: () => invalidate(qc),
  });
}

export function useSetWorkLogStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ empId, date, status }: { empId: string; date: string; status: string }) =>
      api.patch(`/work-logs/${empId}/${date}/status`, { status }),
    onSuccess: () => invalidate(qc),
  });
}

export function useSetWorkLogComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ empId, date, comment }: { empId: string; date: string; comment: string }) =>
      api.patch(`/work-logs/${empId}/${date}/comment`, { comment }),
    onSuccess: () => invalidate(qc),
  });
}
