'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// PCONSOLIDATE-TASKS-PROJECTS-NAV: Team Tasks is no longer a standalone route -- it's
// the Team tab on the single /tasks page now. Old bookmarks/links land here and are
// sent on rather than 404ing, same client-side redirect pattern already used elsewhere
// in this app (profile-requests/registrations pages, Round5 add'l-1).
export default function TeamTasksRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/tasks');
  }, [router]);
  return null;
}
