'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { WorkFunction } from '../types';

export interface FunctionDetail extends WorkFunction {
  children: WorkFunction[];
  taskCount: number;
}

export interface CreateFunctionInput {
  name: string;
  description?: string;
  projId?: string;
  parentFnId?: string;
  assigneeIds?: string[];
  assignedTeams?: string[];
  status?: string;
  priority?: string;
  deadline?: string;
  links?: string[];
}
export type UpdateFunctionInput = Partial<CreateFunctionInput>;

export function useFunctions(projId?: string) {
  return useQuery({
    queryKey: ['functions', projId ?? 'all'],
    queryFn: () => apiFetch<WorkFunction[]>('/functions', { params: projId ? { projId } : undefined }),
    staleTime: 15_000,
  });
}

export function useFunction(functionId: string | null) {
  return useQuery({
    queryKey: ['function', functionId],
    queryFn: () => apiFetch<FunctionDetail>(`/functions/${functionId}`),
    enabled: !!functionId,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['functions'] });
}

export function useCreateFunction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateFunctionInput) => apiFetch<WorkFunction>('/functions', { method: 'POST', body: dto }),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateFunction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ functionId, dto }: { functionId: string; dto: UpdateFunctionInput }) =>
      apiFetch<WorkFunction>(`/functions/${functionId}`, { method: 'PATCH', body: dto }),
    onSuccess: (_d, vars) => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: ['function', vars.functionId] });
    },
  });
}

export function useDeleteFunction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (functionId: string) => apiFetch<void>(`/functions/${functionId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(qc),
  });
}
