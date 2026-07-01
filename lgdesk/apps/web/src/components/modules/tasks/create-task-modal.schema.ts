// Zod schema for the "New Task" form.
// Field set/format mirrors apps/api/src/tasks/dto/create-task.dto.ts (title required;
// everything else optional) — Master Reference Part 13 (Task Management) documents the
// RBAC/data-model rules (task always a leaf; standalone tasks allowed with no
// project/function) but leaves exact per-field input formats to the DTO, which is the
// authoritative shape for what the API will accept.
import { z } from 'zod';

// Single source of truth for these two enums — re-exported (unchanged) from
// create-task-modal.tsx so existing importers (task-detail-modal, create-function-modal,
// function-detail-modal, project-detail-modal, schedule-meeting-modal) keep working.
// Values (the string set) match apps/api/src/common/constants.ts TASK_STATUSES/
// TASK_PRIORITIES exactly — z.enum()/IsIn() validation is order-independent, so
// TASK_PRIORITIES is ordered Critical→Low here to match Part 37's checklist for the
// priority filter/dropdowns ("Critical/High/Medium/Low") without touching the backend.
export const TASK_STATUSES = ['Backlog', 'Not Started', 'WIP - 25%', 'WIP - 50%', 'WIP - 75%', 'Under Review', 'Done', 'Cancelled'] as const;
export const TASK_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;

// Exported for reuse by task-detail-modal.schema.ts (edit-task estimatedHours + the
// add-progress-update form's hoursLogged use the same numeric-string shape).
export const optionalNonNegativeNumberString = z
  .string()
  .optional()
  .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Enter a number 0 or greater.');

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  description: z.string().optional(),
  projId: z.string().optional(),
  functionId: z.string().optional(),
  subFnId: z.string().optional(),
  assigneeIds: z.array(z.string()).default([]),
  team: z.string().optional(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: z.string().optional(),
  estimatedHours: optionalNonNegativeNumberString,
});

export type CreateTaskFormValues = z.infer<typeof createTaskSchema>;
