'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// PCONSOLIDATE-TASKS-PROJECTS-NAV: Team Projects is no longer a standalone route -- it's
// the Team tab on the single /projects page now. Same client-side redirect pattern
// already used elsewhere in this app (profile-requests/registrations pages, Round5 add'l-1).
export default function TeamProjectsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/projects');
  }, [router]);
  return null;
}
