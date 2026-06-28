// ─── USER ──────────────────────────────────────────
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
  // computed:
  displayName?: string;
}

// ─── TASK ──────────────────────────────────────────
export interface Task {
  id: string;
  taskId: string;
  projId?: string;
  functionId?: string;
  title: string;
  description?: string;
  assigneeIds: string[];       // always array in API, comma-sep in DB
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

export interface AssignmentEntry {
  date: string;
  by: string;
  assignees: string[];
  teams: string[];
}

// ─── PROJECT ───────────────────────────────────────
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
  subProjects?: Project[];
}

// ─── WORK FUNCTION ─────────────────────────────────
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
  children?: WorkFunction[];
}

// ─── WORK LOG ──────────────────────────────────────
export interface WorkLog {
  id: string;
  logId: string;
  empId: string;
  date: string;
  attendanceType: string;
  tasksWorkedOn?: string;
  accomplishments?: string;
  blockers?: string;
  overtimeHours: number;
  overtimeReason?: string;
  createdAt: string;
}

export interface InternWorkLog {
  id: string;
  logId: string;
  empId: string;
  date: string;
  attendanceType: string;
  tasksDone?: string;
  learnings?: string;
  challenges?: string;
  nextDayPlan?: string;
  createdAt: string;
}

// ─── WORK DURATION (Clock) ─────────────────────────
export interface WorkDuration {
  id: string;
  sessionId: string;
  empId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  totalBreakMins: number;
  grossMinutes: number;
  netMinutes: number;
  status: 'IDLE' | 'ACTIVE' | 'ON_BREAK' | 'COMPLETED';
  autoClocked: boolean;
  breaks: WorkBreak[];
}

export interface WorkBreak {
  id: string;
  sessionId: string;
  breakStart: string;
  breakEnd?: string;
  durationMins: number;
}

// ─── LEAVE ─────────────────────────────────────────
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
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

// ─── MEETING ───────────────────────────────────────
export interface Meeting {
  id: string;
  meetingId: string;
  title: string;
  description?: string;
  organizerId: string;
  attendeeIds: string[];
  startTime: string;
  endTime: string;
  meetLink?: string;
  calEventId?: string;
  status: string;
  createdAt: string;
}

// ─── ANNOUNCEMENT ──────────────────────────────────
export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  visibility: string;
  expiresAt?: string;
  isPinned: boolean;
  createdAt: string;
}

// ─── NOTES (personal) ──────────────────────────────
export interface Todo {
  id: string;
  empId: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export interface Note {
  id: string;
  empId: string;
  title?: string;
  content?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Idea {
  id: string;
  empId: string;
  title?: string;
  content?: string;
  createdAt: string;
}

// ─── ATTACHMENT ────────────────────────────────────
export interface Attachment {
  id: string;
  attachmentId: string;
  taskId?: string;
  projId?: string;
  driveFileId: string;
  fileName: string;
  mimeType?: string;
  webViewLink?: string;
  uploadedBy: string;
  isDeleted: boolean;
  createdAt: string;
}

// ─── DUE DATE REQUEST ──────────────────────────────
export interface DueDateRequest {
  id: string;
  ddrId: string;
  entityType: 'Task' | 'Project' | 'Function';
  entityId: string;
  newDueDate: string;
  reason: string;
  requestedBy: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewedBy?: string;
  notes?: string;
  createdAt: string;
}

// ─── WEEKLY SUMMARY ────────────────────────────────
export interface WeeklySummary {
  id: string;
  empId: string;
  weekStart: string;
  content?: string;
  isEdited: boolean;
  generatedAt?: string;
  createdAt: string;
}

// ─── AUTH ──────────────────────────────────────────
export interface AuthUser {
  empId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  team?: string;
}

export interface LoginUser {
  empId: string;
  firstName: string;
  lastName: string;
  name: string;          // displayName = firstName + ' ' + lastName
  email: string;
  role: string;
  team?: string;
  hasMisAccess: boolean;
}

export interface LoginResponse {
  token: string;
  user: LoginUser;
}

// ─── INITIAL PAYLOAD (GET /auth/me bootstrap) ──────
export interface InitialPayloadUser {
  empId: string;
  email: string;
  name: string;          // displayName = firstName + ' ' + lastName
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
  attCounts: Record<string, number>;   // { [taskId]: count }
  hasMisAccess: boolean;
}

// ─── API RESPONSE ──────────────────────────────────
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiError = { ok: false; error: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── DASHBOARD ─────────────────────────────────────
export interface DashboardNotice {
  id: string;
  type: 'ddr_pending' | 'registration' | 'profile_request' | 'leave_review' | 'overdue_task';
  message: string;
  entityId?: string;
  entityType?: string;
  createdAt: string;
}

export interface ScoreboardEntry {
  empId: string;
  displayName: string;
  team?: string;
  score: number;
  done: number;
  inProgress: number;
  overdue: number;
}
