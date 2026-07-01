// Frontend mirrors of the backend's per-entity edit/delete predicates, so the UI can
// show/hide Edit/Delete affordances instead of relying on a server-side 403 after the
// fact (Master Reference Part 13/14/15 permission matrices). Kept in exact lockstep
// with the authoritative logic in:
//   apps/api/src/tasks/tasks.service.ts       (canModifyTask / canDeleteTask)
//   apps/api/src/projects/projects.service.ts (canModify / canDelete)
//   apps/api/src/functions/functions.service.ts (canModify / canDelete)
//
// One intentional gap: the backend's manager-scope check for tasks/functions also
// treats "any assignee is one of my subordinates" as modify-authorized. The frontend
// doesn't have the org-chart subordinate list on hand for every caller, so that one
// extra case isn't replicated here — it only widens who the *server* would allow, so
// omitting it client-side can under-show (never over-show) an Edit affordance. Worst
// case: a manager who legitimately could edit via that sub-case doesn't see the
// button here and has to use Team Tasks instead; it never lets someone edit/delete
// something the server would reject.
import type { AuthUser } from './auth';
import { isAdmin, isManager } from './auth';
import type { Task, Project, WorkFunction } from './types';

type Caller = Pick<AuthUser, 'empId' | 'role' | 'team'> | null | undefined;

// ─── Tasks (Part 13 §"Task CRUD RBAC" + PFIX RBAC correction) ──────────────────
export function canEditTask(user: Caller, task: Task): boolean {
  if (!user) return false;
  if (user.role === 'Intern') return false; // Interns are blocked from updating tasks, even their own.
  if (isAdmin(user.role)) return true;
  if (task.assignerId === user.empId) return true;
  if (task.assigneeIds.includes(user.empId)) return true;
  if (isManager(user.role) && user.team && task.assignedTeams.includes(user.team)) return true;
  return false;
}

// Progress-logging is gated by the backend's base canModifyTask check (assigner /
// assignee / manager-team) WITHOUT the Intern-wide update block — Interns may log
// progress on their own tasks even though they can't edit task fields directly
// (tasks.service.ts `submitProgressUpdate` calls `canModifyTask`, not the Intern-gated
// `updateTask` path).
export function canLogTaskProgress(user: Caller, task: Task): boolean {
  if (!user) return false;
  if (isAdmin(user.role)) return true;
  if (task.assignerId === user.empId) return true;
  if (task.assigneeIds.includes(user.empId)) return true;
  if (isManager(user.role) && user.team && task.assignedTeams.includes(user.team)) return true;
  return false;
}

export function canDeleteTask(user: Caller, task: Task): boolean {
  if (!user) return false;
  if (isAdmin(user.role)) return true;
  if (isManager(user.role) && user.team && task.assignedTeams.includes(user.team)) return true;
  if (user.role === 'Team Member' && task.assignerId === user.empId) return true;
  return false;
}

// ─── Projects (Part 15 §RBAC) ──────────────────────────────────────────────────
export function canCreateProject(user: Caller): boolean {
  return !!user && isManager(user.role);
}

export function canEditProject(user: Caller, project: Project): boolean {
  if (!user) return false;
  if (isAdmin(user.role)) return true;
  if (project.ownerIds.includes(user.empId)) return true;
  if (isManager(user.role) && user.team && project.assignedTeams.includes(user.team)) return true;
  // TM own-assignee, TC/TF any assignee — anyone but an Intern qualifies via assignee match.
  if (user.role !== 'Intern' && project.assigneeIds.includes(user.empId)) return true;
  return false;
}

export function canDeleteProject(user: Caller, project: Project): boolean {
  if (!user) return false;
  if (isAdmin(user.role)) return true;
  if (isManager(user.role) && user.team && project.assignedTeams.includes(user.team)) return true;
  return false;
}

// ─── Functions & Sub-Functions (Part 14 §RBAC) ─────────────────────────────────
export function canCreateFunction(user: Caller): boolean {
  return !!user; // Managers always; TM/Intern allowed too — gated to self-assign-only at submit time.
}

export function canEditFunction(user: Caller, fn: WorkFunction): boolean {
  if (!user) return false;
  if (isAdmin(user.role)) return true;
  if (fn.assignerId === user.empId) return true; // assignerId === createdById at creation; never changes.
  if (fn.assigneeIds.includes(user.empId)) return true;
  if (isManager(user.role) && user.team && fn.assignedTeams.includes(user.team)) return true;
  return false;
}

export function canDeleteFunction(user: Caller, fn: WorkFunction): boolean {
  if (!user) return false;
  if (isAdmin(user.role)) return true;
  if (isManager(user.role) && user.team && fn.assignedTeams.includes(user.team)) return true;
  return false;
}
