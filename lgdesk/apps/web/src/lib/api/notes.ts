'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Todo, Note, Idea } from '../types';

// Part 28 "Module — Personal Productivity" — Todos/Notes/Ideas are per-user
// scratchpad data, empId-scoped server-side. No role gating on any of these.

// ─────────────────────────────────────────────── todos
export interface TodoInput {
  title: string;
}
export interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
}

export function useTodos() {
  return useQuery({ queryKey: ['todos'], queryFn: () => apiFetch<Todo[]>('/todos') });
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: TodoInput) => apiFetch<Todo>('/todos', { method: 'POST', body: dto }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
  });
}

export function useUpdateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTodoInput }) =>
      apiFetch<Todo>(`/todos/${id}`, { method: 'PATCH', body: dto }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/todos/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
  });
}

// ─────────────────────────────────────────────── notes
export interface NoteInput {
  title?: string;
  content?: string;
  pinned?: boolean;
  color?: string;
}

export function useNotes() {
  return useQuery({ queryKey: ['notes'], queryFn: () => apiFetch<Note[]>('/notes') });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: NoteInput) => apiFetch<Note>('/notes', { method: 'POST', body: dto }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: NoteInput }) =>
      apiFetch<Note>(`/notes/${id}`, { method: 'PATCH', body: dto }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/notes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  });
}

// ─────────────────────────────────────────────── ideas
export interface IdeaInput {
  title?: string;
  content?: string;
  status?: string;
}

export function useIdeas() {
  return useQuery({ queryKey: ['ideas'], queryFn: () => apiFetch<Idea[]>('/ideas') });
}

export function useCreateIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: IdeaInput) => apiFetch<Idea>('/ideas', { method: 'POST', body: dto }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  });
}

export function useUpdateIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: IdeaInput }) =>
      apiFetch<Idea>(`/ideas/${id}`, { method: 'PATCH', body: dto }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  });
}

export function useDeleteIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/ideas/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ideas'] }),
  });
}
