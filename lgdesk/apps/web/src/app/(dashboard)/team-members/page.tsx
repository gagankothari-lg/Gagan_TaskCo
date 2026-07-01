'use client';

import { useAuth } from '../../../hooks/use-auth';
import { isManager } from '../../../lib/auth';
import { MembersView } from '../../../components/modules/users/members-view';
import { Icon } from '../../../components/ui/icon';

export default function TeamMembersPage() {
  const { currentUser } = useAuth();
  if (!currentUser) return null;
  if (!isManager(currentUser.role)) {
    return (
      <div className="empty-state">
        <Icon name="lock" size={40} className="ei" />
        <p>You don&apos;t have access to this page.</p>
      </div>
    );
  }
  return <MembersView title="Team Members" subtitle="Members in your team" scope="team" />;
}
