'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  User,
  OrgNode,
  RegistrationRequest,
  ProfileUpdateRequest,
  ProfileUpdateInput,
} from '../lib/types';

// Backend wraps every success as { ok:true, data }.
const data = <T>(res: { data: { data: T } }): T => res.data.data;

// ─── Queries ────────────────────────────────────────
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => data<User[]>(await api.get('/users')),
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
    queryFn: async () => data<MeResponse>(await api.get('/users/me')),
    enabled,
    staleTime: 30_000,
  });
}

export function useOrgTree() {
  return useQuery({
    queryKey: ['org-tree'],
    queryFn: async () => data<OrgNode[]>(await api.get('/users/org-tree')),
    staleTime: 30_000,
  });
}

export function useRegistrations() {
  return useQuery({
    queryKey: ['registrations'],
    queryFn: async () => data<RegistrationRequest[]>(await api.get('/users/registrations')),
  });
}

export function useProfileRequests() {
  return useQuery({
    queryKey: ['profile-requests'],
    queryFn: async () => data<ProfileUpdateRequest[]>(await api.get('/users/profile-requests')),
  });
}

// ─── Mutations ──────────────────────────────────────
export function useApproveRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reqId: string) => api.patch(`/users/registrations/${reqId}/approve`),
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
      api.patch(`/users/registrations/${reqId}/reject`, { notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registrations'] }),
  });
}

export function useSubmitProfileUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: ProfileUpdateInput) =>
      data<{ immediate: boolean; reqId?: string }>(await api.patch('/users/me/profile', dto)),
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
    mutationFn: (reqId: string) => api.patch(`/users/profile-requests/${reqId}/approve`),
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
      api.patch(`/users/profile-requests/${reqId}/reject`, { notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-requests'] }),
  });
}

export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ empId, newRole }: { empId: string; newRole: string }) =>
      api.patch(`/users/${empId}/role`, { newRole }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['org-tree'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      api.post('/auth/change-password', { currentPassword, newPassword }),
  });
}
