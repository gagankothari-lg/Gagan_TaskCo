'use client';

import { useState } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { isManager } from '../../../lib/auth';
import { ProjectGridView } from '../../../components/modules/projects/project-grid-view';
import { ScopeTabs, type Scope } from '../../../components/modules/scope-tabs';

// PCONSOLIDATE-TASKS-PROJECTS-NAV: mirrors tasks/page.tsx exactly -- see that file for
// the full reasoning. My/Team/All folded into one page + tab bar, replacing the old
// separate /projects, /projects/team, /projects/all routes (now redirects back here).
const TAB_CONFIG: Record<Scope, { title: string; subtitle?: string; showTeamTabs?: boolean; showSearch?: boolean; showStatusFilter?: boolean }> = {
  mine: { title: 'My Projects', showStatusFilter: false },
  team: { title: 'Team Projects', subtitle: 'All active projects across the team', showTeamTabs: true, showSearch: true },
  all: { title: 'All Projects' },
};

export default function ProjectsPage() {
  const { currentUser } = useAuth();
  const manager = !!currentUser && isManager(currentUser.role);
  const [tab, setTab] = useState<Scope>('mine');

  function selectTab(next: Scope) {
    if (next !== 'mine' && !manager) return;
    setTab(next);
  }
  const activeTab: Scope = manager ? tab : 'mine';
  const cfg = TAB_CONFIG[activeTab];

  return (
    <div>
      <ScopeTabs tabs={manager ? ['mine', 'team', 'all'] : ['mine']} active={activeTab} onChange={selectTab} />
      <ProjectGridView scope={activeTab} {...cfg} />
    </div>
  );
}
