export const ALL_ROLES     = ['Super Admin','Admin','Team Captain','Team Facilitator','Team Member','Intern'] as const;
export const ADMIN_ROLES   = ['Super Admin','Admin'] as const;
export const MANAGER_ROLES = ['Super Admin','Admin','Team Captain','Team Facilitator'] as const;

export const isAdmin   = (r: string) => (ADMIN_ROLES as readonly string[]).includes(r);
export const isManager = (r: string) => (MANAGER_ROLES as readonly string[]).includes(r);

export const TASK_STATUSES = [
  'Backlog','Not Started','WIP - 25%','WIP - 50%','WIP - 75%','Done','Cancelled','Under Review'
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

export const LEAVE_TYPES = ['Annual','Sick','Casual','Maternity','Paternity','Unpaid','Emergency','Half Day'] as const;

export const ATTENDANCE_TYPES = [
  'Present','Leave Full Day','Leave Half Day','Alternate Week Off','Week Off','Holiday','Extra Full Day','Extra Half Day'
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
