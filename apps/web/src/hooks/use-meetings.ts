'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Meeting } from '../lib/types';

const data = <T>(res: { data: { data: T } }): T => res.data.data;

export interface CreateMeetingInput {
  title: string;
  description?: string;
  startTime: string;
  durationMins: number;
  meetType?: string;
  attendeeIds?: string[];
  attendeeTeams?: string[];
}

export function useMeetings() {
  return useQuery({ queryKey: ['meetings'], queryFn: async () => data<Meeting[]>(await api.get('/meetings')) });
}

export function useUpcomingMeetings() {
  return useQuery({ queryKey: ['meetings', 'upcoming'], queryFn: async () => data<Meeting[]>(await api.get('/meetings/upcoming')) });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['meetings'] });
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (dto: CreateMeetingInput) => api.post('/meetings', dto), onSuccess: () => invalidate(qc) });
}

export function useCancelMeeting() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (meetingId: string) => api.delete(`/meetings/${meetingId}`), onSuccess: () => invalidate(qc) });
}
