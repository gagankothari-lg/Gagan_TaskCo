'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError, getToken, clearToken } from './api';

// P27: extends the field set the old dashboard-only `Me` interface used (firstName/
// lastName/email) with dob/subDepartment -- both already stored on the User row, just
// not previously selected onto this response. A field-selection widening of an
// already-existing, already-proven read endpoint, not new business logic -- no new
// endpoint, no new workflow. managerId/team/designation/role were already returned.
export interface Me {
  empId: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: string;
  team?: string;
  designation?: string;
  dob?: string;
  subDepartment?: string;
  managerEmail?: string;
  managerName?: string;
}

export function useMe() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await apiFetch<Me>('/auth/me');
    setMe(data);
    return data;
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    (async () => {
      try {
        await refresh();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) clearToken();
        router.replace('/');
        return;
      } finally {
        setLoading(false);
      }
    })();
  }, [router, refresh]);

  return { me, loading, refresh };
}
