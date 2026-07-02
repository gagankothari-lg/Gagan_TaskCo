'use client';

import { useAuth } from '../../../../hooks/use-auth';
import { isManager } from '../../../../lib/auth';
import { TaskListView } from '../../../../components/modules/tasks/task-list-view';

// Gated by isManager (not isAdmin): TC/TF can reach "All Tasks" too (nav shows
// it to every manager) — TasksService team-scopes the 'all' branch for them
// server-side, so Admin/SA still get the org-wide view here.
export default function AllTasksPage() {
  const { currentUser } = useAuth();
  if (!currentUser) return null;
  if (!isManager(currentUser.role)) {
    return (
      <div className="p-6">
        <div className="rounded-[6px] border border-[#30363D] bg-[#21262D] p-6 text-sm text-[#8B949E]">
          You don&apos;t have access to this page.
        </div>
      </div>
    );
  }
  return <TaskListView scope="all" title="All Tasks" subtitle="Company-wide tasks" showTeamSelector />;
}
