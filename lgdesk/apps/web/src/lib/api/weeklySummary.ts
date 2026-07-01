'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';

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
    queryFn: () => apiFetch<WeeklySummaryData>('/weekly-summary', { params: { weekStart } }),
    enabled: enabled && !!weekStart,
    staleTime: 30_000,
  });
}

export function useSaveWeeklySummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ weekStart, bullets }: { weekStart: string; bullets: string[] }) =>
      apiFetch<WeeklySummaryData>('/weekly-summary', { method: 'POST', body: { weekStart, bullets } }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['weekly-summary', v.weekStart] }),
  });
}

export function useGenerateWeeklySummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weekStart: string) => apiFetch<WeeklySummaryData>('/weekly-summary/generate', { method: 'POST', body: { weekStart } }),
    onSuccess: (_d, weekStart) => qc.invalidateQueries({ queryKey: ['weekly-summary', weekStart] }),
  });
}

// ─── MIS Report (Part 19 "MIS Report" — gated by hasMisAccess, not role) ──────
export interface MisSummaryRow {
  empId: string;
  name: string;
  team?: string | null;
  role: string;
  found: boolean;
  bullets: string[];
  isEdited: boolean;
  generatedAt?: string | null;
}

export interface MisSummariesData {
  weekStart: string;
  weekEnd: string;
  total: number;
  submitted: number;
  rows: MisSummaryRow[];
}

export function useMisSummaries(weekStart: string) {
  return useQuery({
    queryKey: ['weekly-summary', 'mis', weekStart],
    queryFn: () => apiFetch<MisSummariesData>('/weekly-summary/mis', { params: { weekStart } }),
    enabled: !!weekStart,
    retry: false,
  });
}
