'use client';

import { useState } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { isManager } from '../../../lib/auth';
import { TaskListView } from '../../../components/modules/tasks/task-list-view';
import { ScopeTabs, type Scope } from '../../../components/modules/scope-tabs';

// PCONSOLIDATE-TASKS-PROJECTS-NAV: My/Team/All folded into one page + tab bar, replacing
// the old separate /tasks, /tasks/team, /tasks/all routes (now redirects back here). The
// isManager gate that used to decide "does this route render at all" now decides "does
// this tab button exist" instead -- same access, relocated. Props per tab are exactly
// what each old page passed to TaskListView.
const TAB_CONFIG: Record<Scope, { title: string; subtitle?: string; showOwnershipTabs?: boolean; showTeamSelector?: boolean; showTeamTabs?: boolean }> = {
  mine: { title: 'My Tasks', subtitle: 'Tasks assigned to or created by you', showOwnershipTabs: true },
  team: { title: 'Team Tasks', subtitle: 'Tasks across your team', showTeamSelector: true, showTeamTabs: true },
  all: { title: 'All Tasks', subtitle: 'Company-wide tasks', showTeamSelector: true },
};

export default function TasksPage() {
  const { currentUser } = useAuth();
  const manager = !!currentUser && isManager(currentUser.role);
  const [tab, setTab] = useState<Scope>('mine');

  // Belt-and-suspenders: the Team/All buttons simply don't exist for a non-manager, but
  // guard the setter too (e.g. a role downgrade mid-session shouldn't leave a stale
  // 'team'/'all' tab selected) rather than relying on hidden buttons alone.
  function selectTab(next: Scope) {
    if (next !== 'mine' && !manager) return;
    setTab(next);
  }
  const activeTab: Scope = manager ? tab : 'mine';
  const cfg = TAB_CONFIG[activeTab];

  return (
    <div>
      <ScopeTabs tabs={manager ? ['mine', 'team', 'all'] : ['mine']} active={activeTab} onChange={selectTab} />
      <TaskListView scope={activeTab} {...cfg} />
    </div>
  );
}
