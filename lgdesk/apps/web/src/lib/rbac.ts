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

// ─── Role change ("Change Role") ────────────────────────────────────────────
// Mirrors apps/api/src/users/users.service.ts `changeRole` exactly:
//   - Super Admin: no restriction — every role, on any target.
//   - Admin: any role except Super Admin, and never on a Super Admin target
//     (also never shown for a peer Admin target — the legacy `_allowedNewRoles`
//     matrix this is ported from never exposes the button between same-tier
//     admins, even though the backend itself only hard-blocks the SA case).
//   - Team Captain: own-team Team Member / Intern targets ONLY, and only into
//     Team Member / Intern / Team Facilitator / Team Captain (never Admin/SA).
//   - Team Facilitator (and everyone else): no capability at all — no branch.
export type RoleName = 'Super Admin' | 'Admin' | 'Team Captain' | 'Team Facilitator' | 'Team Member' | 'Intern';

// Display order used everywhere a role <select> is populated (lowest to highest rank).
export const ROLE_OPTIONS_ORDER: RoleName[] = [
  'Team Member',
  'Intern',
  'Team Facilitator',
  'Team Captain',
  'Admin',
  'Super Admin',
];

/** The set of roles `actorRole` may assign to a target currently holding `targetRole`. Empty = no button. */
export function allowedNewRoles(actorRole: string, targetRole: string): RoleName[] {
  if (actorRole === 'Super Admin') return ROLE_OPTIONS_ORDER;
  if (actorRole === 'Admin') {
    if (targetRole === 'Admin' || targetRole === 'Super Admin') return [];
    return ROLE_OPTIONS_ORDER.filter((r) => r !== 'Super Admin');
  }
  if (actorRole === 'Team Captain') {
    if (targetRole !== 'Team Member' && targetRole !== 'Intern') return [];
    return ROLE_OPTIONS_ORDER.filter((r) => r !== 'Admin' && r !== 'Super Admin');
  }
  return []; // Team Facilitator and non-managers: never.
}

/** Whether the "Change Role" button/action should even be offered for this actor/target pair. */
export function canChangeRole(
  actor: Caller,
  target: { empId: string; role: string; team?: string | null },
): boolean {
  if (!actor) return false;
  if (actor.empId === target.empId) return false; // never on yourself
  if (actor.role === 'Team Captain' && actor.team !== target.team) return false; // TC: own team only
  return allowedNewRoles(actor.role, target.role).length > 0;
}
