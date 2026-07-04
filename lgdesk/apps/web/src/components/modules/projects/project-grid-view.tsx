'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../../ui/icon';
import { Progress } from '../../ui/progress';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../ui/dropdown-menu';
import { useAuth } from '../../../hooks/use-auth';
import { useProjects, useDeleteProject, type ProjectScope } from '../../../lib/api/projects';
import { canCreateProject, canEditProject, canDeleteProject } from '../../../lib/rbac';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { Spinner } from '../../ui/spinner';
import { statusPillStyle, priorityDisplay, statusDot } from '../../../lib/status-styles';
import { ProjectCard } from './project-card';
import { CreateProjectModal } from './create-project-modal';
import { ProjectDetailModal } from './project-detail-modal';
import { PROJECT_STATUSES } from './create-project-modal.schema';
import type { Project, User } from '../../../lib/types';

type OwnershipTab = 'All' | 'To Me' | 'By Me';
type TeamTab = 'All' | 'To Team' | 'By Team';

function nameFor(empId: string, employees: User[]): string {
  const u = employees.find((e) => e.empId === empId);
  return u ? `${u.firstName} ${u.lastName}`.trim() : empId;
}

interface ProjectGridViewProps {
  scope?: ProjectScope;
  title: string;
  subtitle?: string;
  // Team Projects (Master Reference Part 24): "All"/"To Team"/"By Team" tabs
  // instead of My Projects'/All Projects' "All"/"To Me"/"By Me".
  showTeamTabs?: boolean;
  // Team/All Projects header difference vs My Projects: a live search box
  // filtering by Name OR Description.
  showSearch?: boolean;
  // My Projects (reference view-my-projects) has no status-filter control at
  // all — defaults to true so Team/All Projects keep their existing chip row.
  showStatusFilter?: boolean;
}

export function ProjectGridView({ scope, title, subtitle, showTeamTabs, showSearch, showStatusFilter = true }: ProjectGridViewProps) {
  const { currentUser, employees } = useAuth();
  const { data: projects, isLoading, error } = useProjects(scope);
  const [tab, setTab] = useState<OwnershipTab>('All');
  const [teamTab, setTeamTab] = useState<TeamTab>('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [scopeTeam, setScopeTeam] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // All Projects (reference view-all-projects) has no ownership/team tab row and no
  // status-filter chip row at all — it's org-wide, scoped instead by the "Scope:"
  // team dropdown below.
  const isAllScope = scope === 'all';

  const teamOf = (empId?: string | null) => (empId ? employees.find((e) => e.empId === empId)?.team : undefined);

  // Part 37: "Tabs All / To Me / By Me toggle the grid" — mirrors My Tasks' ownership
  // tabs (assignee-or-owner vs. assigner), applied on top of the scope already
  // returned by the server (`_applyAsgnProjFilter`). Team Projects instead uses the
  // "All / To Team / By Team" set (showTeamTabs).
  const byOwnership = useMemo(() => {
    const list = projects ?? [];
    if (!currentUser) return list;
    if (showTeamTabs) {
      const myTeam = currentUser.team;
      if (!myTeam) return list;
      if (teamTab === 'To Team') {
        return list.filter(
          (p) =>
            p.assignedTeams.includes(myTeam) ||
            p.ownerIds.some((o) => teamOf(o) === myTeam) ||
            p.assigneeIds.some((a) => teamOf(a) === myTeam),
        );
      }
      if (teamTab === 'By Team') return list.filter((p) => teamOf(p.assignerId) === myTeam);
      return list;
    }
    if (tab === 'To Me') return list.filter((p) => p.assigneeIds.includes(currentUser.empId) || p.ownerIds.includes(currentUser.empId));
    if (tab === 'By Me') return list.filter((p) => p.assignerId === currentUser.empId);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, tab, showTeamTabs, teamTab, currentUser, employees]);

  // All Projects' "Scope: [team ▾]" dropdown (reference: .scope-filter-wrap +
  // #scope-all-prj) — a client-side narrowing of the already org-scoped 'all' list
  // down to one team, reusing the same teamOf-based matching as the "To Team"/"By
  // Team" tabs above.
  const teams = useMemo(() => Array.from(new Set(employees.map((e) => e.team).filter(Boolean))) as string[], [employees]);
  const byScope = useMemo(() => {
    if (!isAllScope || !scopeTeam) return byOwnership;
    return byOwnership.filter(
      (p) =>
        p.assignedTeams.includes(scopeTeam) ||
        p.ownerIds.some((o) => teamOf(o) === scopeTeam) ||
        p.assigneeIds.some((a) => teamOf(a) === scopeTeam) ||
        teamOf(p.assignerId) === scopeTeam,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byOwnership, isAllScope, scopeTeam, employees]);

  const bySearch = useMemo(() => {
    if (!showSearch || !search.trim()) return byScope;
    const q = search.trim().toLowerCase();
    return byScope.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q));
  }, [byScope, showSearch, search]);

  const statuses = useMemo(() => ['All', ...Array.from(new Set(bySearch.map((p) => p.status)))], [bySearch]);
  const filtered = bySearch.filter((p) => statusFilter === 'All' || p.status === statusFilter);
  const canCreate = canCreateProject(currentUser);

  // Group standalone projects vs. parent+sub-project blocks (Part 37: "_projGroupBlock
  // header + sub-project mini-cards grid"). A project with no parent AND no children
  // in the filtered set renders as a normal standalone card.
  const topLevel = filtered.filter((p) => !p.parentProjId);
  const subProjectsOf = (projId: string) => filtered.filter((p) => p.parentProjId === projId);

  return (
    <div className="p-6">
      {isAllScope ? (
        // All Projects (reference view-all-projects): title only (no ph-sub, no tabs,
        // no status filter) — just the org-wide "Scope: [team ▾]" dropdown next to
        // New Project.
        <div className="ph">
          <div className="ph-left">
            <div className="ph-title">{title}</div>
          </div>
          <div className="ph-actions">
            <div className="flex items-center gap-2 rounded-[var(--r)] bg-bg px-2.5 py-1">
              <span className="whitespace-nowrap text-xs font-semibold text-muted">Scope:</span>
              <select
                id="scope-all-prj"
                value={scopeTeam}
                onChange={(e) => setScopeTeam(e.target.value)}
                className="cursor-pointer rounded-[4px] border-none bg-transparent px-1 py-0.5 text-xs font-semibold text-p outline-none"
              >
                <option value="">Organization (All Teams)</option>
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {canCreate && (
              <button onClick={() => setCreateOpen(true)} className="btn btn-primary">
                <Icon name="add" size={15} /> New Project
              </button>
            )}
          </div>
        </div>
      ) : showTeamTabs ? (
        // Team Projects (reference view-team-projects): title/subtitle on the left, and
        // ownership tabs + search + status select + New Project button grouped together
        // in a single .ph-actions row on the right, matching the GAS reference layout.
        <div className="ph">
          <div className="ph-left">
            <div className="ph-title">{title}</div>
            {subtitle && <div className="ph-sub">{subtitle}</div>}
          </div>
          <div className="ph-actions">
            <div className="tl-tabs">
              {(['All', 'To Team', 'By Team'] as TeamTab[]).map((t) => (
                <button key={t} className={`tl-tab${teamTab === t ? ' active' : ''}`} onClick={() => setTeamTab(t)}>{t}</button>
              ))}
            </div>
            {showSearch && (
              <div className="relative">
                <Icon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  id="tp-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects…"
                  className="fc"
                  style={{ paddingLeft: 30, width: 200 }}
                />
              </div>
            )}
            <select id="tp-status" className="fc" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 'auto' }}>
              <option value="All">All Statuses</option>
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {canCreate && (
              <button onClick={() => setCreateOpen(true)} className="btn btn-primary">
                <Icon name="add" size={15} /> New Project
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Reference view-my-projects (ph-left = title only, no ph-sub) keeps the
              ownership tabs + New Project button together in one ph-actions row
              alongside the title — mirrors the showTeamTabs branch above. */}
          <div className="ph">
            <div className="ph-left">
              <div className="ph-title">{title}</div>
              {subtitle && <div className="ph-sub">{subtitle}</div>}
            </div>
            <div className="ph-actions">
              <div className="tl-tabs">
                {(['All', 'To Me', 'By Me'] as OwnershipTab[]).map((t) => (
                  <button key={t} className={`tl-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
                ))}
              </div>
              {showSearch && (
                <div className="relative">
                  <Icon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    id="tp-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search projects…"
                    className="fc"
                    style={{ paddingLeft: 30, width: 200 }}
                  />
                </div>
              )}
              {canCreate && (
                <button onClick={() => setCreateOpen(true)} className="btn btn-primary">
                  <Icon name="add" size={15} /> New Project
                </button>
              )}
            </div>
          </div>

          {showStatusFilter && (
            <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1">
              {statuses.map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)} className={['shrink-0 rounded-[9999px] border px-3 py-1 text-xs', statusFilter === s ? 'border-p bg-p3 text-p' : 'border-border text-muted hover:text-text'].join(' ')}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted"><Spinner size={16} /> Loading…</div>
      ) : error ? (
        <div className="text-sm text-danger">{apiErrorMessage(error, 'Failed to load projects')}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[8px] border border-border bg-surface py-12 text-center">
          <Icon name="folder" size={28} className="text-muted" />
          <p className="text-sm text-muted">No projects</p>
        </div>
      ) : (
        // Reference `.cards-grid` (grid-template-columns:repeat(auto-fill,minmax(300px,1fr)))
        // flows every card into one continuous auto-fill grid instead of one
        // grid-per-card stacked vertically. Grouped parent/sub-project blocks span
        // the full row (like reference's full-width group divider) while standalone
        // cards pack together as normal grid items alongside each other.
        <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
          {topLevel.map((p) => {
            const subs = subProjectsOf(p.projId);
            if (subs.length === 0) {
              return <ProjectCard key={p.projId} project={p} onEdit={() => setEditId(p.projId)} />;
            }
            return (
              <div key={p.projId} className="col-span-full">
                <ProjectGroupBlock parent={p} subProjects={subs} onEdit={setEditId} />
              </div>
            );
          })}
        </div>
      )}

      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <ProjectDetailModal projId={editId} onClose={() => setEditId(null)} />
    </div>
  );
}

/**
 * Parent project with sub-projects (reference: .proj-group / .proj-group-hd /
 * .proj-sub-card). Gradient header (var(--p3) → var(--surface)) with a group-level
 * progress bar aggregating the parent + all its sub-projects' tasks, followed by a
 * compact mini-card grid (minmax(180px,1fr)) for the sub-projects themselves.
 */
function ProjectGroupBlock({ parent, subProjects, onEdit }: { parent: Project; subProjects: Project[]; onEdit: (projId: string) => void }) {
  const { tasks } = useAuth();
  const groupTasks = useMemo(() => {
    const ids = new Set([parent.projId, ...subProjects.map((sp) => sp.projId)]);
    return tasks.filter((t) => t.projId && ids.has(t.projId));
  }, [tasks, parent.projId, subProjects]);
  const openTasks = groupTasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled').length;
  const doneTasks = groupTasks.filter((t) => t.status === 'Done' || t.status === 'Completed').length;
  const completion = groupTasks.length > 0 ? Math.round((doneTasks / groupTasks.length) * 100) : 0;
  const barColor = statusDot(parent.status);

  return (
    <div>
      <div
        className="mb-2.5 flex items-start gap-2.5 rounded-[8px] border border-border p-3"
        style={{ background: 'linear-gradient(to right, var(--p3) 0%, var(--surface) 60%)', borderLeft: '4px solid var(--p2)' }}
      >
        <Icon name="folder_open" size={20} className="mt-0.5 shrink-0 text-p2" />
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[15px] font-bold text-p">{parent.name}</span>
            <span className="rounded-[9999px] bg-p3 px-2 py-0.5 text-[10px] font-semibold text-p">{subProjects.length} sub-project{subProjects.length === 1 ? '' : 's'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-muted">
            <span>{openTasks} open / {groupTasks.length} task{groupTasks.length === 1 ? '' : 's'}</span>
          </div>
          <div className="mt-[7px] h-[3px] max-w-[180px] overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${completion}%`, background: barColor }} />
          </div>
        </div>
        <button type="button" onClick={() => onEdit(parent.projId)} className="flex shrink-0 items-center gap-1 rounded-[6px] px-2 py-1 text-xs text-muted hover:bg-surface hover:text-p">
          <Icon name="edit" size={13} /> Edit parent
        </button>
      </div>
      <div
        className="grid gap-2 border-l-2 border-border pb-1 pl-5"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginLeft: 12 }}
      >
        {subProjects.map((sp) => <ProjectSubCard key={sp.projId} project={sp} onEdit={() => onEdit(sp.projId)} />)}
      </div>
    </div>
  );
}

/** Compact mini-card for a sub-project inside a ProjectGroupBlock (reference: .proj-sub-card). */
function ProjectSubCard({ project, onEdit }: { project: Project; onEdit: () => void }) {
  const { currentUser, employees, tasks } = useAuth();
  const del = useDeleteProject();

  const linkedTasks = useMemo(() => tasks.filter((t) => t.projId === project.projId), [tasks, project.projId]);
  const doneTasks = linkedTasks.filter((t) => t.status === 'Done' || t.status === 'Completed').length;
  const completion = linkedTasks.length > 0 ? Math.round((doneTasks / linkedTasks.length) * 100) : 0;

  const pill = statusPillStyle(project.status);
  const pr = priorityDisplay(project.priority);
  const barColor = statusDot(project.status);

  const canEdit = canEditProject(currentUser, project);
  const canDelete = canDeleteProject(currentUser, project);
  const assignees = project.assigneeIds.length > 0 ? project.assigneeIds : project.ownerIds;

  async function remove() {
    if (!confirm(`Delete ${project.name}? Its tasks will also be removed.`)) return;
    try {
      await del.mutateAsync(project.projId);
      toast('Project deleted', 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to delete project'), 'error');
    }
  }

  return (
    <div className="proj-sub-card flex flex-col gap-1.5 rounded-[6px] border border-border p-2.5 transition-colors hover:border-p2" style={{ borderTop: '2px solid var(--p2)' }}>
      <div className="flex items-center gap-1.5">
        <span className="rounded-[9999px] px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: pill.bg, color: pill.color }}>{project.status}</span>
        <span className="ml-auto shrink-0 text-[10px] font-semibold" style={{ color: pr.color }}>{pr.label}</span>
      </div>
      <p className="truncate text-[12px] font-bold text-text">{project.name}</p>
      <div className="flex items-center gap-1.5">
        <Progress value={completion} className="h-1 flex-1" indicatorStyle={{ background: barColor }} />
        <span className="text-[10px] font-semibold text-muted">{completion}%</span>
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="min-w-0 truncate text-[10px] text-muted">{assignees.length > 0 ? assignees.map((id) => nameFor(id, employees)).join(', ') : 'Unassigned'}</span>
        {(canEdit || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="shrink-0 rounded-[6px] p-0.5 text-muted2 hover:bg-bg hover:text-p" title="More actions" aria-label="More actions">
                <Icon name="more_vert" size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {canEdit && (
                <DropdownMenuItem onSelect={onEdit}>
                  <Icon name="edit" size={14} /> Edit
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem destructive onSelect={remove}>
                  <Icon name="delete" size={14} /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

export default ProjectGridView;
