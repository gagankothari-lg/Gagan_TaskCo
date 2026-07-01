'use client';

import { useMutation } from '@tanstack/react-query';
import { apiFetch } from './client';

export interface ImportRow {
  type: 'Function' | 'Sub-Fn' | 'Task';
  function: string;
  subFunction?: string;
  taskTitle?: string;
  assigner?: string;
  assignees?: string[];
  status?: string;
  priority?: string;
  dueDate?: string;
  selected: boolean;
}

export interface ImportStats {
  functions: number;
  subFunctions: number;
  tasks: number;
  total: number;
}

export interface PreviewResult {
  rows: ImportRow[];
  stats: ImportStats;
}

export interface ExecuteResult {
  created: number;
  errors: string[];
}

export interface PreviewSheetInput {
  sheetUrl: string;
  tabName?: string;
  projectId?: string;
}

export function usePreviewSheet() {
  return useMutation({
    mutationFn: (input: PreviewSheetInput) => apiFetch<PreviewResult>('/import/preview-sheet', { method: 'POST', body: input }),
  });
}

export interface PreviewCsvInput {
  file: File;
  projectId?: string;
}

export function usePreviewCsv() {
  return useMutation({
    mutationFn: ({ file, projectId }: PreviewCsvInput) => {
      const form = new FormData();
      form.append('file', file);
      if (projectId) form.append('projectId', projectId);
      // apiFetch sets the multipart boundary header automatically for FormData bodies.
      return apiFetch<PreviewResult>('/import/preview-csv', { method: 'POST', body: form });
    },
  });
}

export interface ExecuteImportInput {
  rows: ImportRow[];
  projectId?: string;
}

export function useExecuteImport() {
  return useMutation({
    mutationFn: ({ rows, projectId }: ExecuteImportInput) =>
      apiFetch<ExecuteResult>('/import/execute', { method: 'POST', body: { rows, projectId } }),
  });
}
