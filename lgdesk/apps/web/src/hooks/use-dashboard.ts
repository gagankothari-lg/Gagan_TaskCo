'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { DashboardData, Announcement } from '../lib/types';

const data = <T>(res: { data: { data: T } }): T => res.data.data;

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => data<DashboardData>(await api.get('/dashboard')),
    staleTime: 30_000,
  });
}

export function useAnnouncements() {
  return useQuery({ queryKey: ['announcements'], queryFn: async () => data<Announcement[]>(await api.get('/announcements')) });
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
    mutationFn: (dto: AnnouncementInput) => api.post('/announcements', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
