'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Task, ProgressUpdate, CreateTaskInput, UpdateTaskInput } from '../lib/types';

const data = <T>(res: { data: { data: T } }): T => res.data.data;
export type TaskScope = 'mine' | 'team' | 'all';

const scopePath = (scope?: TaskScope) =>
  scope === 'mine' ? '/tasks/mine' : scope === 'team' ? '/tasks/team' : scope === 'all' ? '/tasks/all' : '/tasks';

export function useTasks(scope?: TaskScope) {
  return useQuery({
    queryKey: ['tasks', scope ?? 'default'],
    queryFn: async () => data<Task[]>(await api.get(scopePath(scope))),
    staleTime: 15_000,
  });
}

export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => data<Task>(await api.get(`/tasks/${taskId}`)),
    enabled: !!taskId,
  });
}

export function usePlanWeek(weekStart: string) {
  return useQuery({
    queryKey: ['plan-week', weekStart],
    queryFn: async () =>
      data<Record<string, Task[]>>(await api.get('/tasks/plan-week', { params: { weekStart } })),
  });
}

export function useProgressUpdates(taskId: string | null) {
  return useQuery({
    queryKey: ['task-progress', taskId],
    queryFn: async () => data<ProgressUpdate[]>(await api.get(`/tasks/${taskId}/progress`)),
    enabled: !!taskId,
  });
}

function invalidateTasks(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['tasks'] });
  qc.invalidateQueries({ queryKey: ['plan-week'] });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateTaskInput) => data<Task>(await api.post('/tasks', dto)),
    onSuccess: () => invalidateTasks(qc),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, dto }: { taskId: string; dto: UpdateTaskInput }) =>
      data<Task>(await api.patch(`/tasks/${taskId}`, dto)),
    onSuccess: (_d, vars) => {
      invalidateTasks(qc);
      qc.invalidateQueries({ queryKey: ['task', vars.taskId] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => api.delete(`/tasks/${taskId}`),
    onSuccess: () => invalidateTasks(qc),
  });
}

export function useAddProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, description, hoursLogged, blockers }: { taskId: string; description: string; hoursLogged?: number; blockers?: string }) =>
      api.post(`/tasks/${taskId}/progress`, { description, hoursLogged, blockers }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['task-progress', vars.taskId] });
      qc.invalidateQueries({ queryKey: ['task', vars.taskId] });
      invalidateTasks(qc);
    },
  });
}

export function useCreateDdr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entityType, entityId, newDueDate, reason }: { entityType: 'Task' | 'Project' | 'Function'; entityId: string; newDueDate: string; reason: string }) =>
      api.post('/ddr', { entityType, entityId, newDueDate, reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ddr'] }),
  });
}
