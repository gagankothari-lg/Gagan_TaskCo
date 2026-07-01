// Frontend mirror of the API response contract (packages/types/src/index.ts).
// Kept local to apps/web for zero build-config risk; packages/types stays canonical.

export interface User {
  id: string;
  empId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  designation?: string;
  managerId?: string;
  team?: string;
  subDepartment?: string;
  isActive: boolean;
  dob?: string;
  createdAt: string;
  updatedAt: string;
  displayName?: string;
}

export interface AssignmentEntry {
  date: string;
  by: string;
  assignees: string[];
  teams: string[];
}

export interface Task {
  id: string;
  taskId: string;
  projId?: string;
  functionId?: string;
  subFnId?: string;
  title: string;
  description?: string;
  assigneeIds: string[];
  assignedTeams: string[];
  assignerId: string;
  status: string;
  priority: string;
  recurring: boolean;
  dueDate?: string;
  estimatedHours?: number;
  actualHours: number;
  fileLink?: string;
  links?: string;
  assignmentHistory: AssignmentEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  projId: string;
  parentProjId?: string;
  name: string;
  description?: string;
  ownerIds: string[];
  assignerId: string;
  assigneeIds: string[];
  assignedTeams: string[];
  status: string;
  priority: string;
  startDate?: string;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkFunction {
  id: string;
  functionId: string;
  parentFnId?: string;
  projId?: string;
  name: string;
  description?: string;
  assignerId: string;
  assigneeIds: string[];
  assignedTeams: string[];
  status: string;
  priority: string;
  startDate?: string;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InitialPayloadUser {
  empId: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  role: string;
  team?: string;
  designation?: string;
  subDepartment?: string;
  hasMisAccess: boolean;
}

export interface InitialPayload {
  ok: true;
  currentUser: InitialPayloadUser;
  tasks: Task[];
  projects: Project[];
  functions: WorkFunction[];
  employees: User[];
  pendingLeaveCount: number;
  pendingDdrCount: number;
  attCounts: Record<string, number>;
  hasMisAccess: boolean;
}

export interface LoginUser {
  empId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  role: string;
  team?: string;
  hasMisAccess: boolean;
}

export interface LoginResponse {
  token: string;
  user: LoginUser;
}

// ─── Users module (P03/P04) ────────────────────────
export interface RegistrationRequest {
  id: string;
  regId: string;
  firstName: string;
  lastName: string;
  email: string;
  designation?: string | null;
  team?: string | null;
  subDepartment?: string | null;
  managerId?: string | null;
  role: string;
  status: string;
  reviewedBy?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileUpdateRequest {
  id: string;
  reqId: string;
  empId: string;
  changes: string; // JSON string of the requested field changes
  status: string;
  reviewedBy?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Org-tree node: a user plus their (recursive) direct reports.
export type OrgNode = User & { reports: OrgNode[] };

// Fields a user may submit for a profile update.
export interface ProfileUpdateInput {
  firstName?: string;
  lastName?: string;
  designation?: string;
  team?: string;
  subDepartment?: string;
  dob?: string;
}

// ─── Tasks / DDR (P05/P06) ─────────────────────────
export interface ProgressUpdate {
  id: string;
  updateId: string;
  taskId: string;
  projId?: string | null;
  authorEmpId: string;
  date: string;
  description: string;
  hoursLogged?: number | null;
  blockers?: string | null;
  createdAt: string;
}

export interface DueDateRequest {
  id: string;
  ddrId: string;
  entityType: 'Task' | 'Project' | 'Function';
  entityId: string;
  newDueDate: string;
  reason: string;
  requestedBy: string;
  status: string;
  reviewedBy?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  projId?: string;
  functionId?: string;
  subFnId?: string;
  assigneeIds?: string[];
  assignedTeams?: string[];
  status?: string;
  priority?: string;
  recurring?: boolean;
  dueDate?: string;
  estimatedHours?: number;
  links?: string[];
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

// ─── Work Log (P10/P11) ────────────────────────────
export interface WorkLogEntry {
  id: string;
  logId: string;
  empId: string;
  date: string;
  month?: string | null;
  dayName?: string | null;
  attendance: string;
  purpose?: string | null;
  leaveRequested?: string | null;
  work1stHalf?: string | null;
  work2ndHalf?: string | null;
  extraHours: number;
  remark?: string | null;
  status?: string | null;
  comments?: string | null;
  workDuration?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkLogInput {
  date: string;
  attendance?: string;
  purpose?: string;
  leaveRequested?: string;
  work1stHalf?: string;
  work2ndHalf?: string;
  extraHours?: number;
  remark?: string;
  status?: string;
  comments?: string;
}

export interface TeamOverviewRow {
  empId: string;
  name: string;
  P: number;
  LF: number;
  LH: number;
  H: number;
  W: number;
  AW: number;
  EF: number;
  EH: number;
  otHours: number;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  createdAt?: string;
}

// ─── Leaves (P14/P15) ──────────────────────────────
export interface Leave {
  id: string;
  leaveId: string;
  empId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const LEAVE_TYPES = ['Annual', 'Sick', 'Casual', 'Maternity', 'Paternity', 'Unpaid', 'Emergency', 'Half Day'] as const;

// ─── Meetings (P16/P17) ────────────────────────────
export interface Meeting {
  id: string;
  meetingId: string;
  title: string;
  description?: string;
  organizerId: string;
  attendeeIds: string[];
  attendeeTeams: string[];
  meetType: string;
  startTime: string;
  endTime: string;
  meetLink?: string;
  calEventId?: string;
  status: string;
  createdAt: string;
}

// ─── Dashboard (P18/P19) ───────────────────────────
export interface ScoreboardRow {
  empId: string;
  name: string;
  score: number;
  done: number;
  inProg: number;
  overdue: number;
  rank: number;
}

export interface DashboardData {
  notices: {
    announcements: { id: string; title: string; content: string; startDate: string | null; expiresAt: string | null }[];
    birthdays: { empId: string; name: string }[];
    onLeave: { empId: string; name: string; leaveType: string }[];
    meetings: { meetingId: string; title: string; startTime: string }[];
    forms: unknown[];
  };
  onLeaveToday: { empId: string; name: string; leaveType: string }[];
  scoreboard: ScoreboardRow[];
  upcomingTasks: {
    overdue: Task[];
    today: Task[];
    tomorrow: Task[];
    thisWeek: Task[];
    nextWeek: Task[];
  };
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  visibility: string;
  startDate?: string | null;
  expiresAt?: string | null;
  isPinned: boolean;
  createdAt: string;
}

// ─── Work Duration / Clock (P12/P13) ───────────────
export interface WorkDurationSession {
  id: string;
  sessionId: string;
  empId: string;
  date: string;
  clockIn?: string | null;
  clockOut?: string | null;
  totalBreakMins: number;
  grossMinutes: number;
  netMinutes: number;
  status: string;
  autoClocked: boolean;
  notes?: string | null;
}

export interface WorkBreakEntry {
  id: string;
  sessionId: string;
  breakStart: string;
  breakEnd?: string | null;
  durationMins: number;
}

export interface ClockStatus {
  status: string;
  session: WorkDurationSession;
  breaks: WorkBreakEntry[];
  totalBreakMins: number;
  history: WorkDurationSession[];
}

export interface TeamClockRow {
  empId: string;
  name: string;
  status: string;
  clockInTs?: string | null;
  totalBreakMins: number;
  netWorkMins: number;
}
