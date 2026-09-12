'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { User, OrgNode } from '../types';

// ─── Queries ────────────────────────────────────────
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<User[]>('/users'),
    staleTime: 30_000,
  });
}

export function useOrgTree() {
  return useQuery({
    queryKey: ['org-tree'],
    queryFn: () => apiFetch<OrgNode[]>('/users/org-tree'),
    staleTime: 30_000,
  });
}

// ─── Mutations ──────────────────────────────────────
export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ empId, newRole }: { empId: string; newRole: string }) =>
      apiFetch<void>(`/users/${empId}/role`, { method: 'PATCH', body: { newRole } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['org-tree'] });
    },
  });
}
