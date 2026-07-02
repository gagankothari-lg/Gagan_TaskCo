'use client';

import { useAuth } from '../../../hooks/use-auth';
import { isManager } from '../../../lib/auth';
import { MembersView } from '../../../components/modules/users/members-view';
import { Icon } from '../../../components/ui/icon';

// Gated by isManager (not isAdmin): TC/TF can open Organisation too — same
// full-org employee table and pending queues as Admin/SA, just with the
// Change Role capability limited per _allowedNewRoles (see rbac.ts).
export default function OrganisationPage() {
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
  return <MembersView title="Organisation" subtitle="All members across the organisation" scope="all" />;
}
