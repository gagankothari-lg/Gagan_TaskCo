'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { DashboardData, Announcement } from '../types';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardData>('/dashboard'),
    staleTime: 30_000,
  });
}

export function useAnnouncements() {
  return useQuery({ queryKey: ['announcements'], queryFn: () => apiFetch<Announcement[]>('/announcements') });
}

export interface AnnouncementInput {
  title: string;
  content?: string;
  startDate?: string;
  endDate?: string;
  visibility?: string;
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: AnnouncementInput) => apiFetch<Announcement>('/announcements', { method: 'POST', body: dto }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/announcements/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
