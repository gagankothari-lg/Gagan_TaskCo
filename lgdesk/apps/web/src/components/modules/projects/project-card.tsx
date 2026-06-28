'use client';

import { useMemo } from 'react';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { statusPillStyle, priorityDisplay, statusDot } from '../../../lib/status-styles';
import { avatarColor, initials, fmtDate } from '../../../lib/utils';
import type { Project, User } from '../../../lib/types';

function nameFor(empId: string, employees: User[]): string {
  const u = employees.find((e) => e.empId === empId);
  return u ? `${u.firstName} ${u.lastName}`.trim() : empId;
}

export function ProjectCard({ project, onClick }: { project: Project; onClick?: () => void }) {
  const { employees, projects, tasks } = useAuth();

  // Sub-projects + linked tasks are derived from the cached payload (no extra fetch).
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

  const assigner = nameFor(project.assignerId, employees);
  const assignees = project.assigneeIds.length > 0 ? project.assigneeIds : project.ownerIds;
  const assigneeNames = assignees.map((id) => nameFor(id, employees));
  const avatarIds = assignees.slice(0, 3);

  return (
    <button
      type="button"
      onClick={onClick}
      className="proj-card flex w-full flex-col gap-2.5 text-left transition-shadow hover:shadow-md"
    >
      {/* Top row: status pill + priority + date */}
      <div className="flex items-center gap-2">
        <span
          className="rounded-[12px] px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: pill.bg, color: pill.color }}
        >
          {project.status}
        </span>
        <span className="text-[11px] font-semibold" style={{ color: pr.color }}>{pr.label}</span>
        <span className="ml-auto text-[11px] text-[var(--muted)]">
          {project.deadline ? fmtDate(project.deadline) : '—'}
        </span>
      </div>

      {/* Title + sub-project count */}
      <div>
        <p className="truncate text-[14px] font-bold text-[var(--text)]">{project.name}</p>
        <p className="text-[11px] text-[var(--muted)]">
          {subProjectCount} sub-project{subProjectCount === 1 ? '' : 's'}
        </p>
      </div>

      {/* Assignee info: assigner → assignees, with a small avatar stack */}
      <div className="flex items-center gap-2">
        <div className="flex -space-x-1.5">
          {avatarIds.map((id) => (
            <div
              key={id}
              title={nameFor(id, employees)}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--surface)] text-[9px] font-semibold text-white"
              style={{ background: avatarColor(id) }}
            >
              {initials(nameFor(id, employees))}
            </div>
          ))}
          {assignees.length > avatarIds.length && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--p3)] text-[9px] font-semibold text-[var(--p)]">
              +{assignees.length - avatarIds.length}
            </div>
          )}
        </div>
        <p className="min-w-0 truncate text-[12px] text-[var(--muted)]">
          {assigner} → {assigneeNames.length > 0 ? assigneeNames.join(', ') : 'Unassigned'}
        </p>
      </div>

      {/* Progress bar + completion % */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
          <div className="h-full rounded-full" style={{ width: `${completion}%`, background: barColor }} />
        </div>
        <span className="text-[11px] font-semibold text-[var(--muted)]">{completion}%</span>
      </div>

      {/* Footer: open-tasks count + action icons */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--muted)]">
          {openTasks} open task{openTasks === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-2 text-[var(--muted2)]">
          <Icon name="chat_bubble_outline" size={15} title="Comments" />
          <Icon name="attach_file" size={15} title="Attachments" />
          <Icon name="edit" size={15} title="Edit" />
          <Icon name="delete" size={15} title="Delete" />
        </div>
      </div>
    </button>
  );
}

export default ProjectCard;
