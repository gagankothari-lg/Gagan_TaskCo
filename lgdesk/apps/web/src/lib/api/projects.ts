'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Project } from '../types';

export type ProjectScope = 'mine' | 'team' | 'all';

export interface ProjectDetail extends Project {
  taskCount: number;
  subProjectCount: number;
  functionCount: number;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  assigneeIds?: string[];
  assignedTeams?: string[];
  status?: string;
  priority?: string;
  startDate?: string;
  deadline?: string;
  parentProjId?: string;
}
export type UpdateProjectInput = Partial<CreateProjectInput> & { ownerIds?: string[] };

const path = (scope?: ProjectScope) =>
  scope === 'mine' ? '/projects/mine' : scope === 'team' ? '/projects/team' : scope === 'all' ? '/projects/all' : '/projects';

export function useProjects(scope?: ProjectScope) {
  return useQuery({
    queryKey: ['projects', scope ?? 'default'],
    queryFn: () => apiFetch<Project[]>(path(scope)),
    staleTime: 15_000,
  });
}

export function useProject(projId: string | null) {
  return useQuery({
    queryKey: ['project', projId],
    queryFn: () => apiFetch<ProjectDetail>(`/projects/${projId}`),
    enabled: !!projId,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['projects'] });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateProjectInput) => apiFetch<Project>('/projects', { method: 'POST', body: dto }),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projId, dto }: { projId: string; dto: UpdateProjectInput }) =>
      apiFetch<Project>(`/projects/${projId}`, { method: 'PATCH', body: dto }),
    onSuccess: (_d, vars) => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: ['project', vars.projId] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projId: string) => apiFetch<void>(`/projects/${projId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(qc),
  });
}
