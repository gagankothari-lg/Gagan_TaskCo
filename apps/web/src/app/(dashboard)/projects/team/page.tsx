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
        <div className="rounded-[6px] border border-[#30363D] bg-[#21262D] p-6 text-sm text-[#8B949E]">You don&apos;t have access to this page.</div>
      </div>
    );
  }
  return <ProjectGridView scope="team" title="Team Projects" subtitle="Projects across your team" />;
}
