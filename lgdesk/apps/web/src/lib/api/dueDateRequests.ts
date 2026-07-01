'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { DueDateRequest } from '../types';
import { invalidateTasks } from './tasks';

export function useCreateDdr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entityType, entityId, newDueDate, reason }: { entityType: 'Task' | 'Project' | 'Function'; entityId: string; newDueDate: string; reason: string }) =>
      apiFetch<DueDateRequest>('/ddr', { method: 'POST', body: { entityType, entityId, newDueDate, reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ddr'] }),
  });
}

// GET /ddr?status=… returns DueDateRequest[] scoped server-side to the caller
// (admins see all; managers see DDRs for entities they assigned + their own).
export function useDdrs(status?: string) {
  return useQuery({
    queryKey: ['ddr', status ?? 'all'],
    queryFn: () => apiFetch<DueDateRequest[]>('/ddr', { params: status ? { status } : undefined }),
    staleTime: 15_000,
  });
}

function invalidateDdr(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['ddr'] });
  invalidateTasks(qc);
  qc.invalidateQueries({ queryKey: ['projects'] });
}

export function useApproveDdr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ddrId: string) => apiFetch<DueDateRequest>(`/ddr/${ddrId}/approve`, { method: 'PATCH' }),
    onSuccess: () => invalidateDdr(qc),
  });
}

export function useRejectDdr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ddrId, notes }: { ddrId: string; notes?: string }) =>
      apiFetch<DueDateRequest>(`/ddr/${ddrId}/reject`, { method: 'PATCH', body: { notes } }),
    onSuccess: () => invalidateDdr(qc),
  });
}
