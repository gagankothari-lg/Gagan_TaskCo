'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// PMERGE-LEAVES-PAGES: Leave Approvals is no longer a standalone route -- it's a section
// on the single /leaves page now, shown only to managers. Same client-side redirect
// pattern already used elsewhere in this app (profile-requests/registrations pages,
// Round5 add'l-1; tasks/team, tasks/all, projects/team, projects/all, PCONSOLIDATE-
// TASKS-PROJECTS-NAV).
export default function LeaveApprovalsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/leaves');
  }, [router]);
  return null;
}
