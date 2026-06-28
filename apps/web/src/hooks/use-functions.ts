'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { WorkFunction } from '../lib/types';

const data = <T>(res: { data: { data: T } }): T => res.data.data;

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
    queryFn: async () => data<WorkFunction[]>(await api.get('/functions', { params: projId ? { projId } : {} })),
    staleTime: 15_000,
  });
}

export function useFunction(functionId: string | null) {
  return useQuery({
    queryKey: ['function', functionId],
    queryFn: async () => data<FunctionDetail>(await api.get(`/functions/${functionId}`)),
    enabled: !!functionId,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['functions'] });
}

export function useCreateFunction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateFunctionInput) => data<WorkFunction>(await api.post('/functions', dto)),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateFunction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ functionId, dto }: { functionId: string; dto: UpdateFunctionInput }) =>
      data<WorkFunction>(await api.patch(`/functions/${functionId}`, dto)),
    onSuccess: (_d, vars) => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: ['function', vars.functionId] });
    },
  });
}

export function useDeleteFunction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (functionId: string) => api.delete(`/functions/${functionId}`),
    onSuccess: () => invalidate(qc),
  });
}
