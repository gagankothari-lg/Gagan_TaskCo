'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Leave, Holiday, Meeting } from '../types';

export interface CalendarData {
  leaves: Leave[];
  holidays: Holiday[];
  meetings: Meeting[];
}

export function useCalendar() {
  return useQuery({
    queryKey: ['calendar'],
    queryFn: () => apiFetch<CalendarData>('/calendar'),
  });
}
