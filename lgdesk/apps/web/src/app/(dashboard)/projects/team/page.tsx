'use client';

import { useAuth } from '../../../../hooks/use-auth';
import { isManager } from '../../../../lib/auth';
import { ProjectGridView } from '../../../../components/modules/projects/project-grid-view';

export default function TeamProjectsPage() {
  const { currentUser } = useAuth();
  if (!currentUser) return null;
  if (!isManager(currentUser.role)) {
    return (
      <div className="p-6">
        <div className="rounded-[8px] border border-border bg-surface p-6 text-sm text-muted">You don&apos;t have access to this page.</div>
      </div>
    );
  }
  return <ProjectGridView scope="team" title="Team Projects" subtitle="All active projects across the team" showTeamTabs showSearch />;
}
