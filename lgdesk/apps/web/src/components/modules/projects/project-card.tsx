'use client';

import { useMemo } from 'react';
import { Icon } from '../../ui/icon';
import { Progress } from '../../ui/progress';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../ui/dropdown-menu';
import { useAuth } from '../../../hooks/use-auth';
import { canDeleteProject, canEditProject } from '../../../lib/rbac';
import { useDeleteProject } from '../../../lib/api/projects';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { statusPillStyle, priorityDisplay, statusDot } from '../../../lib/status-styles';
import { avatarColor, initials, fmtDate } from '../../../lib/utils';
import type { Project, User } from '../../../lib/types';

function nameFor(empId: string, employees: User[]): string {
  const u = employees.find((e) => e.empId === empId);
  return u ? `${u.firstName} ${u.lastName}`.trim() : empId;
}

/**
 * Standalone / sub-project card. Per Part 37 (GAP G5), the card BODY is not
 * clickable — there is no "click card -> open detail" affordance on the My Projects
 * grid; only the explicit Edit action opens the shared <ProjectDetailModal>.
 */
export function ProjectCard({ project, onEdit }: { project: Project; onEdit: () => void }) {
  const { currentUser, employees, projects, tasks, attCounts } = useAuth();
  const del = useDeleteProject();

  const subProjectCount = useMemo(
    () => projects.filter((p) => p.parentProjId === project.projId).length,
    [projects, project.projId],
  );
  const linkedTasks = useMemo(() => tasks.filter((t) => t.projId === project.projId), [tasks, project.projId]);
  const openTasks = linkedTasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled').length;
  const doneTasks = linkedTasks.filter((t) => t.status === 'Done' || t.status === 'Completed').length;
  const completion = linkedTasks.length > 0 ? Math.round((doneTasks / linkedTasks.length) * 100) : 0;

  const pill = statusPillStyle(project.status);
  const pr = priorityDisplay(project.priority);
  const barColor = statusDot(project.status);
  const attCount = attCounts[project.projId] ?? 0;

  const canEdit = canEditProject(currentUser, project);
  const canDelete = canDeleteProject(currentUser, project);

  const assigner = nameFor(project.assignerId, employees);
  const assignees = project.assigneeIds.length > 0 ? project.assigneeIds : project.ownerIds;
  const assigneeNames = assignees.map((id) => nameFor(id, employees));
  const avatarIds = assignees.slice(0, 3);
  const ownerNames = project.ownerIds.map((id) => nameFor(id, employees));

  async function remove() {
    if (!confirm(`Delete ${project.name}? Its tasks, functions and sub-functions will also be removed.`)) return;
    try {
      await del.mutateAsync(project.projId);
      toast('Project deleted', 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to delete project'), 'error');
    }
  }

  return (
    <div className="proj-card flex w-full flex-col gap-2.5 text-left transition-shadow hover:shadow-md">
      {/* Top row: status pill + priority + date */}
      <div className="flex items-center gap-2">
        <span
          className="rounded-[12px] px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: pill.bg, color: pill.color }}
        >
          {project.status}
        </span>
        <span className="text-[11px] font-semibold" style={{ color: pr.color }}>{pr.label}</span>
        <span className="ml-auto text-[11px] text-muted">
          {project.deadline ? fmtDate(project.deadline) : '—'}
        </span>
      </div>

      {/* Title + sub-project count */}
      <div>
        <p className="truncate text-[14px] font-bold text-text">{project.name}</p>
        <p className="text-[11px] text-muted">
          {subProjectCount} sub-project{subProjectCount === 1 ? '' : 's'} · {openTasks}/{linkedTasks.length} task{linkedTasks.length === 1 ? '' : 's'} open
        </p>
      </div>

      {/* Assignee info: assigner → assignees, with a small avatar stack */}
      <div className="flex items-center gap-2">
        <div className="flex -space-x-1.5">
          {avatarIds.map((id) => (
            <div
              key={id}
              title={nameFor(id, employees)}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface text-[9px] font-semibold text-white"
              style={{ background: avatarColor(id) }}
            >
              {initials(nameFor(id, employees))}
            </div>
          ))}
          {assignees.length > avatarIds.length && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-p3 text-[9px] font-semibold text-p">
              +{assignees.length - avatarIds.length}
            </div>
          )}
        </div>
        <p className="min-w-0 truncate text-[12px] text-muted">
          {assigner} → {assigneeNames.length > 0 ? assigneeNames.join(', ') : 'Unassigned'}
        </p>
      </div>
      <p className="truncate text-[11px] text-muted2">Owner: {ownerNames.length > 0 ? ownerNames.join(', ') : '—'}</p>

      {/* Progress bar + completion % */}
      <div className="flex items-center gap-2">
        <Progress value={completion} className="h-1.5 flex-1" indicatorStyle={{ background: barColor }} />
        <span className="text-[11px] font-semibold text-muted">{completion}%</span>
      </div>

      {/* Footer: open-tasks count + action icons */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted">
          {openTasks} open task{openTasks === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-2 text-muted2">
          <button
            type="button"
            onClick={() => toast(attCount > 0 ? `${attCount} attachment(s) — viewer coming soon.` : 'Attachments require Google Drive credentials (coming soon).', 'info')}
            className="flex items-center gap-1 rounded-[6px] p-1 hover:bg-bg hover:text-p"
            title="Attachments"
          >
            <Icon name="attach_file" size={15} />
            {attCount > 0 && <span className="text-[10px] font-semibold">{attCount}</span>}
          </button>
          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="rounded-[6px] p-1 hover:bg-bg hover:text-p" title="More actions" aria-label="More actions">
                  <Icon name="more_vert" size={16} />
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
    </div>
  );
}

export default ProjectCard;
