'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Round5 add'l-1: this standalone page was removed — Registrations has no reference nav
// equivalent (Part 10's full nav table has none) and duplicated the embedded
// PendingRegistrationsSection (members-view.tsx, reachable via Team Members/Organisation)
// with inconsistent behavior (F46/F49). Old bookmarks/links land here and are sent on to
// where the queue actually lives now, rather than 404ing outright — same client-side
// redirect pattern already used elsewhere in this app (layout-client.tsx's
// unauthenticated-user redirect).
export default function RegistrationsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/team-members');
  }, [router]);
  return null;
}
