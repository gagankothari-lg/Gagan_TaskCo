'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Leave, Holiday } from '../types';

export interface LeaveInput {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export function useMyLeaves() {
  return useQuery({ queryKey: ['leaves', 'mine'], queryFn: () => apiFetch<Leave[]>('/leaves/mine') });
}

export function usePendingLeaves() {
  return useQuery({ queryKey: ['leaves', 'pending'], queryFn: () => apiFetch<Leave[]>('/leaves/pending') });
}

export function useHolidays() {
  return useQuery({ queryKey: ['holidays'], queryFn: () => apiFetch<Holiday[]>('/holidays'), staleTime: 60_000 });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['leaves'] });
  qc.invalidateQueries({ queryKey: ['calendar'] });
}

export function useSubmitLeave() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (dto: LeaveInput) => apiFetch<Leave>('/leaves', { method: 'POST', body: dto }), onSuccess: () => invalidate(qc) });
}

export function useReviewLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leaveId, status, notes }: { leaveId: string; status: 'Approved' | 'Rejected'; notes?: string }) =>
      apiFetch<Leave>(`/leaves/${leaveId}/review`, { method: 'PATCH', body: { status, notes } }),
    onSuccess: () => invalidate(qc),
  });
}

export function useAddHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; date: string }) => apiFetch<Holiday>('/holidays', { method: 'POST', body: dto }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/holidays/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays'] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}
