// Zod schemas for the Task Detail panel's two independent forms.
//
// (a) editTaskSchema — mirrors apps/api/src/tasks/dto/update-task.dto.ts, where every
// field is optional server-side. This is an edit form that always starts from a loaded
// task though, so `title` is kept required/non-empty client-side (matches Master
// Reference expectations — a task should never be saved with a blank title, even though
// the DTO itself would technically accept omitting the field entirely).
//
// (b) addProgressSchema — mirrors apps/api/src/tasks/dto/create-progress.dto.ts
// (`description` required, `hoursLogged`/`blockers` optional).
import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES, optionalNonNegativeNumberString } from './create-task-modal.schema';

export const editTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  description: z.string().optional(),
  functionId: z.string().optional(),
  subFnId: z.string().optional(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: z.string().optional(),
  estimatedHours: optionalNonNegativeNumberString,
  // Modeled as one multiline string (textarea) — split into string[] in the submit
  // handler exactly as the pre-migration code did. No URL-format validation.
  links: z.string().optional(),
  assigneeIds: z.array(z.string()).default([]),
});

export type EditTaskFormValues = z.infer<typeof editTaskSchema>;

export const addProgressSchema = z.object({
  description: z.string().trim().min(1, 'Description is required.'),
  hoursLogged: optionalNonNegativeNumberString,
  blockers: z.string().optional(),
});

export type AddProgressFormValues = z.infer<typeof addProgressSchema>;
