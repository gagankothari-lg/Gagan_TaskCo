'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
  User,
  OrgNode,
  RegistrationRequest,
  ProfileUpdateRequest,
  ProfileUpdateInput,
} from '../types';

// ─── Queries ────────────────────────────────────────
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<User[]>('/users'),
    staleTime: 30_000,
  });
}

// Current user's own record + any pending profile-update request (for the pending badge).
export interface MeResponse extends User {
  pendingProfileRequest: ProfileUpdateRequest | null;
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeResponse>('/users/me'),
    enabled,
    staleTime: 30_000,
  });
}

export function useOrgTree() {
  return useQuery({
    queryKey: ['org-tree'],
    queryFn: () => apiFetch<OrgNode[]>('/users/org-tree'),
    staleTime: 30_000,
  });
}

export function useRegistrations(enabled = true) {
  return useQuery({
    queryKey: ['registrations'],
    queryFn: () => apiFetch<RegistrationRequest[]>('/users/registrations'),
    enabled,
  });
}

export function useProfileRequests(enabled = true) {
  return useQuery({
    queryKey: ['profile-requests'],
    queryFn: () => apiFetch<ProfileUpdateRequest[]>('/users/profile-requests'),
    enabled,
  });
}

// ─── Mutations ──────────────────────────────────────
export function useApproveRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reqId: string) => apiFetch<void>(`/users/registrations/${reqId}/approve`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrations'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['org-tree'] });
    },
  });
}

export function useRejectRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reqId, notes }: { reqId: string; notes?: string }) =>
      apiFetch<void>(`/users/registrations/${reqId}/reject`, { method: 'PATCH', body: { notes } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registrations'] }),
  });
}

export function useSubmitProfileUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: ProfileUpdateInput) =>
      apiFetch<{ immediate: boolean; reqId?: string }>('/users/me/profile', { method: 'PATCH', body: dto }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['profile-requests'] });
    },
  });
}

export function useApproveProfileUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reqId: string) => apiFetch<void>(`/users/profile-requests/${reqId}/approve`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile-requests'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['org-tree'] });
    },
  });
}

export function useRejectProfileUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reqId, notes }: { reqId: string; notes?: string }) =>
      apiFetch<void>(`/users/profile-requests/${reqId}/reject`, { method: 'PATCH', body: { notes } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-requests'] }),
  });
}

export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ empId, newRole }: { empId: string; newRole: string }) =>
      apiFetch<void>(`/users/${empId}/role`, { method: 'PATCH', body: { newRole } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['org-tree'] });
    },
  });
}
