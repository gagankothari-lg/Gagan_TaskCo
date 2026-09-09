'use client';

// Shared by Tasks and Projects pages: the outer My/Team/All scope tab bar that replaced
// the old separate /tasks, /tasks/team, /tasks/all (and /projects/* equivalent) routes.
// Deliberately styled as a bolder segmented control (.scope-tabs/.scope-tab, globals.css)
// rather than reusing .tl-tabs -- that class already renders a DIFFERENT, pre-existing
// concept inside TaskListView/ProjectGridView itself (showOwnershipTabs' "All/To Me/By Me"
// and showTeamTabs' "All/To Team/By Team" ownership filters), and the two must stay
// visually distinguishable when both appear stacked on the Team tab.
export type Scope = 'mine' | 'team' | 'all';

const SCOPE_LABELS: Record<Scope, string> = { mine: 'My', team: 'Team', all: 'All' };

export function ScopeTabs({ tabs, active, onChange }: { tabs: Scope[]; active: Scope; onChange: (scope: Scope) => void }) {
  return (
    <div className="scope-tabs" role="tablist">
      {tabs.map((scope) => (
        <button
          key={scope}
          type="button"
          role="tab"
          aria-selected={active === scope}
          className={`scope-tab${active === scope ? ' active' : ''}`}
          onClick={() => onChange(scope)}
        >
          {SCOPE_LABELS[scope]}
        </button>
      ))}
    </div>
  );
}

export default ScopeTabs;
