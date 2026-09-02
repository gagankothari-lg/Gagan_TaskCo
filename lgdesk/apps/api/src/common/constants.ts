export const ALL_ROLES     = ['Super Admin','Admin','Team Captain','Team Facilitator','Team Member','Intern'] as const;
export const ADMIN_ROLES   = ['Super Admin','Admin'] as const;
export const MANAGER_ROLES = ['Super Admin','Admin','Team Captain','Team Facilitator'] as const;

// Round4 S4: roles that type their own "reports to" email at registration instead of
// having it auto-resolved via getTeamCaptainByTeam (Team Facilitator/Team Member/Intern
// keep the existing auto-lookup, untouched). Mirrors
// apps/web/.../registration-modal.schema.ts's MANUAL_MANAGER_ROLES exactly.
export const MANUAL_MANAGER_ROLES = ['Super Admin','Admin','Team Captain'] as const;

export const isAdmin   = (r: string) => (ADMIN_ROLES as readonly string[]).includes(r);
export const isManager = (r: string) => (MANAGER_ROLES as readonly string[]).includes(r);

export const TASK_STATUSES = [
  'Backlog','Not Started','WIP - 25%','WIP - 50%','WIP - 75%','Done','Cancelled','Under Review'
] as const;

// Shared by Projects and Functions (PFIX-READY-BATCH-SEQUENTIAL Fix 6) — a distinct vocabulary
// from TASK_STATUSES above; confirmed against the frontend's existing PROJECT_STATUSES
// (apps/web/.../projects/create-project-modal.schema.ts, already reused by both the Project
// and Function modals/schemas there). Do not use TASK_STATUSES for either entity — the two
// lists don't overlap cleanly (e.g. "WIP" here vs "WIP - 25%"/"WIP - 50%"/"WIP - 75%" there).
export const PROJECT_STATUSES = [
  'Not Started','Planning','WIP','Under Review','On Hold','Done','Cancelled'
] as const;

// Round4 F5: Functions were being validated against PROJECT_STATUSES, but the legacy
// reference's VALIDATIONS.Functions.Status (setupSheets.gs:101-104) is a distinct
// 10-value list matching Projects' own reference vocabulary, not the rebuild's
// PROJECT_STATUSES constant (they share only 'Done'/'Cancelled'/'Planning' -- none of
// the WIP-percentage/'Yet to Start'/'Review' values overlapped, so no real Function
// status was ever selectable through the old validator). New Functions default to
// 'Yet to Start' per the reference (auth.gs createFunction).
export const FUNCTION_STATUSES = [
  'Yet to Start','Planning','WIP (0%-25%)','WIP (25%-50%)','WIP (50%-75%)','WIP (75%-100%)','Review','On Hold','Cancelled','Done'
] as const;

export const TASK_CLOSED_STATUSES = ['Done','Cancelled'] as const;

// ─── Task status predicates ────────────────────────────────────
export const isClosed     = (status: string) => (TASK_CLOSED_STATUSES as readonly string[]).includes(status);
export const isDone       = (status: string) => status === 'Done';
export const isInProgress = (status: string) => status.startsWith('WIP'); // WIP - 25/50/75%

// Scoreboard (business rule #5). Logs term = 0; never negative.
export const calcScore = (done: number, inProgress: number, overdue: number): number =>
  Math.max(0, done * 10 + inProgress * 3 - overdue * 5);

// Announcement visibility scopes.
export const VISIBILITY_TYPES = ['Organisation', 'TCs & TFs', 'TCs Only'] as const;

// ─── Array <-> comma-separated string helpers ──────────────────
// DB stores id/team lists as comma-separated strings; the API exposes string[].
export const parseIds = (s?: string | null): string[] => (s ? s.split(',').filter(Boolean) : []);
export const joinIds  = (a?: string[] | null): string => (a ? a.filter(Boolean).join(',') : '');

// Reference ground truth: setupSheets.gs:123 `Leave_Type` validation list — 8 values,
// including "Emergency Leave" (audit finding A4; added here as a pure validation-list
// widening — leaveType is a plain String column, no DB enum, see schema.prisma).
export const LEAVE_TYPES = ['Annual','Sick','Casual','Maternity','Paternity','Unpaid Leave','Half Day','Emergency Leave'] as const;

// Round4 F3: reference ground truth is setupSheets.gs VALIDATIONS.Work_Log.Attendance
// (11 values, WFO/WFH split) — this previously reproduced the ENTIRE pre-migration
// vocabulary that the reference's own one-time migrateAttendanceWfoWfh() function exists
// specifically to eliminate. New Work Log rows default to 'Present-WFO' (the reference's
// own auto-classify-from-hours function, app.js.html:2729, defaults ambiguous/inferred
// "present" cases to -WFO, matching the migration's own bare-Present->'-WFO' mapping).
export const ATTENDANCE_TYPES = [
  'Present-WFO','Present-WFH','Leave Full Day','Leave Half Day','Alternate Week Off','Week Off','Holiday','Extra Full Day-WFO','Extra Full Day-WFH','Extra Half Day-WFO','Extra Half Day-WFH'
] as const;

export const CLOCK_STATES = ['IDLE','ACTIVE','ON_BREAK','COMPLETED'] as const;

export const ID_PREFIXES = {
  task:        'TSK',
  project:     'PRJ',
  function:    'FN',
  employee:    'EMP',
  workLog:     'WL',
  internLog:   'IWL',
  ddr:         'DDR',
  meeting:     'MTG',
  leave:       'LV',
  update:      'UPD',
  attachment:  'ATT',
  registration:'REG',
} as const;
