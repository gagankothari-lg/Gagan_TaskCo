'use client';

import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

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

const data = <T>(res: { data: { data: T } }): T => res.data.data;

export interface PreviewSheetInput {
  sheetUrl: string;
  tabName?: string;
  projectId?: string;
}

export function usePreviewSheet() {
  return useMutation({
    mutationFn: async (input: PreviewSheetInput) =>
      data<PreviewResult>(await api.post('/import/preview-sheet', input)),
  });
}

export interface PreviewCsvInput {
  file: File;
  projectId?: string;
}

export function usePreviewCsv() {
  return useMutation({
    mutationFn: async ({ file, projectId }: PreviewCsvInput) => {
      const form = new FormData();
      form.append('file', file);
      if (projectId) form.append('projectId', projectId);
      // axios sets the multipart boundary header automatically for FormData.
      return data<PreviewResult>(await api.post('/import/preview-csv', form));
    },
  });
}

export interface ExecuteImportInput {
  rows: ImportRow[];
  projectId?: string;
}

export function useExecuteImport() {
  return useMutation({
    mutationFn: async ({ rows, projectId }: ExecuteImportInput) =>
      data<ExecuteResult>(await api.post('/import/execute', { rows, projectId })),
  });
}
