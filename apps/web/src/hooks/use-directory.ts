'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

const data = <T>(res: { data: { data: T } }): T => res.data.data;

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
  return useQuery({ queryKey: ['directory', 'team'], queryFn: async () => data<DirectoryUser[]>(await api.get('/directory/team')), staleTime: 60_000 });
}
export function useCompanyDirectory() {
  return useQuery({ queryKey: ['directory', 'company'], queryFn: async () => data<DirectoryUser[]>(await api.get('/directory/company')), staleTime: 60_000 });
}
export function useOrgChart() {
  return useQuery({ queryKey: ['directory', 'org-chart'], queryFn: async () => data<DirectoryUser[]>(await api.get('/directory/org-chart')), staleTime: 5 * 60_000 });
}
