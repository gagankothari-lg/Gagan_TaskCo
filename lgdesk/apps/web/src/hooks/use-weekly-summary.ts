'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const data = <T>(res: { data: { data: T } }): T => res.data.data;

export interface WeeklySummaryData {
  found: boolean;
  weekStart: string;
  bullets: string[];
  isEdited?: boolean;
  generatedAt?: string | null;
  editedAt?: string | null;
}

export function useWeeklySummary(weekStart: string, enabled: boolean) {
  return useQuery({
    queryKey: ['weekly-summary', weekStart],
    queryFn: async () => data<WeeklySummaryData>(await api.get('/weekly-summary', { params: { weekStart } })),
    enabled: enabled && !!weekStart,
    staleTime: 30_000,
  });
}

export function useSaveWeeklySummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ weekStart, bullets }: { weekStart: string; bullets: string[] }) => api.post('/weekly-summary', { weekStart, bullets }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['weekly-summary', v.weekStart] }),
  });
}

export function useGenerateWeeklySummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weekStart: string) => api.post('/weekly-summary/generate', { weekStart }),
    onSuccess: (_d, weekStart) => qc.invalidateQueries({ queryKey: ['weekly-summary', weekStart] }),
  });
}
