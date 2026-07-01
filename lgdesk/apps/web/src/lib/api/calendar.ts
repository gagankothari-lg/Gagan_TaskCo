'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Leave, Holiday } from '../types';

export function useCalendar() {
  return useQuery({
    queryKey: ['calendar'],
    queryFn: () => apiFetch<{ leaves: Leave[]; holidays: Holiday[]; meetings: unknown[] }>('/calendar'),
  });
}
