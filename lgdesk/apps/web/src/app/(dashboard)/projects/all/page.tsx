'use client';

import { useAuth } from '../../../../hooks/use-auth';
import { isManager } from '../../../../lib/auth';
import { ProjectGridView } from '../../../../components/modules/projects/project-grid-view';

// Gated by isManager (not isAdmin): TC/TF can reach "All Projects" too (nav
// shows it to every manager) — ProjectsService team-scopes the 'all' branch
// for them server-side, so Admin/SA still get the org-wide view here.
export default function AllProjectsPage() {
  const { currentUser } = useAuth();
  if (!currentUser) return null;
  if (!isManager(currentUser.role)) {
    return (
      <div className="p-6">
        <div className="rounded-[8px] border border-border bg-surface p-6 text-sm text-muted">You don&apos;t have access to this page.</div>
      </div>
    );
  }
  return <ProjectGridView scope="all" title="All Projects" />;
}
