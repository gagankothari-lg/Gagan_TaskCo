'use client';

import { useAuth } from '../../../hooks/use-auth';
import type { Project, User } from '../../../lib/types';

function priorityColor(p: string): string {
  return p === 'Critical' ? 'var(--danger)' : p === 'High' ? 'var(--warn)' : p === 'Medium' ? 'var(--p)' : 'var(--muted)';
}

function initials(empId: string, employees: User[]): string {
  const u = employees.find((e) => e.empId === empId);
  return u ? `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase() : empId.slice(-2).toUpperCase();
}

export function ProjectCard({ project, onClick }: { project: Project; onClick?: () => void }) {
  const { employees } = useAuth();
  const owners = project.ownerIds.slice(0, 3);

  return (
    <button
      type="button"
      onClick={onClick}
      className="proj-card flex w-full flex-col gap-3 text-left transition-colors hover:border-[var(--p)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-[var(--muted)]">{project.projId}</p>
          <p className="mt-0.5 truncate text-sm font-medium text-[var(--text)]">{project.name}</p>
        </div>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: priorityColor(project.priority) }} title={project.priority} />
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded-[9999px] border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 text-xs text-[var(--muted)]">{project.status}</span>
        {project.deadline && (
          <span className="rounded-[9999px] bg-[var(--p3)] px-2 py-0.5 text-xs text-[var(--muted)]">
            Due {new Date(project.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {owners.length > 0 && (
        <div className="flex items-center -space-x-1.5">
          {owners.map((id) => (
            <div key={id} title={id} className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--surface)] bg-[var(--p)] text-[10px] font-semibold text-white">
              {initials(id, employees)}
            </div>
          ))}
          {project.ownerIds.length > owners.length && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--surface)] bg-[var(--p3)] text-[10px] text-[var(--text)]">
              +{project.ownerIds.length - owners.length}
            </div>
          )}
        </div>
      )}
    </button>
  );
}

export default ProjectCard;
