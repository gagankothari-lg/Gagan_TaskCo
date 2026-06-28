'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Leave, Holiday } from '../lib/types';

const data = <T>(res: { data: { data: T } }): T => res.data.data;

export interface LeaveInput {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export function useMyLeaves() {
  return useQuery({ queryKey: ['leaves', 'mine'], queryFn: async () => data<Leave[]>(await api.get('/leaves/mine')) });
}

export function usePendingLeaves() {
  return useQuery({ queryKey: ['leaves', 'pending'], queryFn: async () => data<Leave[]>(await api.get('/leaves/pending')) });
}

export function useHolidays() {
  return useQuery({ queryKey: ['holidays'], queryFn: async () => data<Holiday[]>(await api.get('/holidays')), staleTime: 60_000 });
}

export function useCalendar() {
  return useQuery({
    queryKey: ['calendar'],
    queryFn: async () => data<{ leaves: Leave[]; holidays: Holiday[]; meetings: unknown[] }>(await api.get('/calendar')),
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['leaves'] });
  qc.invalidateQueries({ queryKey: ['calendar'] });
}

export function useSubmitLeave() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (dto: LeaveInput) => api.post('/leaves', dto), onSuccess: () => invalidate(qc) });
}

export function useReviewLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leaveId, status, notes }: { leaveId: string; status: 'Approved' | 'Rejected'; notes?: string }) =>
      api.patch(`/leaves/${leaveId}/review`, { status, notes }),
    onSuccess: () => invalidate(qc),
  });
}

export function useAddHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; date: string }) => api.post('/holidays', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/holidays/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}
