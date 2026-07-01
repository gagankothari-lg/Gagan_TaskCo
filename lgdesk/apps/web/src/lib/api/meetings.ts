'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Meeting } from '../types';

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
  return useQuery({ queryKey: ['meetings'], queryFn: () => apiFetch<Meeting[]>('/meetings') });
}

export function useUpcomingMeetings() {
  return useQuery({ queryKey: ['meetings', 'upcoming'], queryFn: () => apiFetch<Meeting[]>('/meetings/upcoming') });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['meetings'] });
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (dto: CreateMeetingInput) => apiFetch<Meeting>('/meetings', { method: 'POST', body: dto }), onSuccess: () => invalidate(qc) });
}

export function useCancelMeeting() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (meetingId: string) => apiFetch<void>(`/meetings/${meetingId}`, { method: 'DELETE' }), onSuccess: () => invalidate(qc) });
}
