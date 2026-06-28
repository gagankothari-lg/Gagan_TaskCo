'use client';

import { useAuth } from '../../../hooks/use-auth';
import { isAdmin } from '../../../lib/auth';
import { MembersView } from '../../../components/modules/users/members-view';

export default function OrganisationPage() {
  const { currentUser } = useAuth();
  if (!currentUser) return null;
  if (!isAdmin(currentUser.role)) {
    return (
      <div className="empty-state">
        <span className="ei material-symbols-outlined">lock</span>
        <p>You don&apos;t have access to this page.</p>
      </div>
    );
  }
  return <MembersView title="Organisation" subtitle="All members across the organisation" scope="all" />;
}
