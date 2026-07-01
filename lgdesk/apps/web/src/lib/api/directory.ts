'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';

export interface DirectoryUser {
  id: string;
  empId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  designation?: string | null;
  managerId?: string | null;
  managerName?: string | null;
  team?: string | null;
  subDepartment?: string | null;
  isActive: boolean;
  chatSpaceLink?: string;
}

export function useTeamDirectory() {
  return useQuery({ queryKey: ['directory', 'team'], queryFn: () => apiFetch<DirectoryUser[]>('/directory/team'), staleTime: 60_000 });
}
export function useCompanyDirectory() {
  return useQuery({ queryKey: ['directory', 'company'], queryFn: () => apiFetch<DirectoryUser[]>('/directory/company'), staleTime: 60_000 });
}
export function useOrgChart() {
  return useQuery({ queryKey: ['directory', 'org-chart'], queryFn: () => apiFetch<DirectoryUser[]>('/directory/org-chart'), staleTime: 5 * 60_000 });
}
