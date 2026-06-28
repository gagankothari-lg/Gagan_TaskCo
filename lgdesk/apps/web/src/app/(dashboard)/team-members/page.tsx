'use client';

import { useAuth } from '../../../hooks/use-auth';
import { isManager } from '../../../lib/auth';
import { MembersView } from '../../../components/modules/users/members-view';

export default function TeamMembersPage() {
  const { currentUser } = useAuth();
  if (!currentUser) return null;
  if (!isManager(currentUser.role)) {
    return (
      <div className="empty-state">
        <span className="ei material-symbols-outlined">lock</span>
        <p>You don&apos;t have access to this page.</p>
      </div>
    );
  }
  return <MembersView title="Team Members" subtitle="Members in your team" scope="team" />;
}
