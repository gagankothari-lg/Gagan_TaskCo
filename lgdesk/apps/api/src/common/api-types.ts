// API response shapes produced by the backend. Mirrors packages/types/src/index.ts
// (the frontend contract). Kept local to apps/api so the build stays self-contained
// — no cross-package source is pulled into the API's TS program / emit tree.

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

export interface EmployeeDto {
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
  employees: EmployeeDto[];
  pendingLeaveCount: number;
  pendingDdrCount: number;
  attCounts: Record<string, number>;
  hasMisAccess: boolean;
}
