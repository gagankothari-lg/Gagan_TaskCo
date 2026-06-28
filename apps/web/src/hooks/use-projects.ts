'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Project } from '../lib/types';

const data = <T>(res: { data: { data: T } }): T => res.data.data;
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
    queryFn: async () => data<Project[]>(await api.get(path(scope))),
    staleTime: 15_000,
  });
}

export function useProject(projId: string | null) {
  return useQuery({
    queryKey: ['project', projId],
    queryFn: async () => data<ProjectDetail>(await api.get(`/projects/${projId}`)),
    enabled: !!projId,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['projects'] });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateProjectInput) => data<Project>(await api.post('/projects', dto)),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projId, dto }: { projId: string; dto: UpdateProjectInput }) =>
      data<Project>(await api.patch(`/projects/${projId}`, dto)),
    onSuccess: (_d, vars) => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: ['project', vars.projId] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projId: string) => api.delete(`/projects/${projId}`),
    onSuccess: () => invalidate(qc),
  });
}
