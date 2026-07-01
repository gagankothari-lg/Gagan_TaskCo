'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Task, ProgressUpdate, CreateTaskInput, UpdateTaskInput } from '../types';

export type TaskScope = 'mine' | 'team' | 'all';

const scopePath = (scope?: TaskScope) =>
  scope === 'mine' ? '/tasks/mine' : scope === 'team' ? '/tasks/team' : scope === 'all' ? '/tasks/all' : '/tasks';

export function useTasks(scope?: TaskScope) {
  return useQuery({
    queryKey: ['tasks', scope ?? 'default'],
    queryFn: () => apiFetch<Task[]>(scopePath(scope)),
    staleTime: 15_000,
  });
}

export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => apiFetch<Task>(`/tasks/${taskId}`),
    enabled: !!taskId,
  });
}

export function usePlanWeek(weekStart: string) {
  return useQuery({
    queryKey: ['plan-week', weekStart],
    queryFn: () => apiFetch<Record<string, Task[]>>('/tasks/plan-week', { params: { weekStart } }),
  });
}

export function useProgressUpdates(taskId: string | null) {
  return useQuery({
    queryKey: ['task-progress', taskId],
    queryFn: () => apiFetch<ProgressUpdate[]>(`/tasks/${taskId}/progress`),
    enabled: !!taskId,
  });
}

export function invalidateTasks(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['tasks'] });
  qc.invalidateQueries({ queryKey: ['plan-week'] });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTaskInput) => apiFetch<Task>('/tasks', { method: 'POST', body: dto }),
    onSuccess: () => invalidateTasks(qc),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, dto }: { taskId: string; dto: UpdateTaskInput }) =>
      apiFetch<Task>(`/tasks/${taskId}`, { method: 'PATCH', body: dto }),
    onSuccess: (_d, vars) => {
      invalidateTasks(qc);
      qc.invalidateQueries({ queryKey: ['task', vars.taskId] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => apiFetch<void>(`/tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateTasks(qc),
  });
}

export function useAddProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, description, hoursLogged, blockers }: { taskId: string; description: string; hoursLogged?: number; blockers?: string }) =>
      apiFetch<ProgressUpdate>(`/tasks/${taskId}/progress`, { method: 'POST', body: { description, hoursLogged, blockers } }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['task-progress', vars.taskId] });
      qc.invalidateQueries({ queryKey: ['task', vars.taskId] });
      invalidateTasks(qc);
    },
  });
}
