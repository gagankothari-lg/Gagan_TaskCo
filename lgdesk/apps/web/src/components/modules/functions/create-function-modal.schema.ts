// Zod schema for the "New Function" form.
// Field set/format mirrors apps/api/src/functions/dto/create-function.dto.ts (name
// required; everything else optional). assigneeIds is intentionally NOT validated here:
// the field is only rendered for managers (see create-function-modal.tsx) — for
// non-managers the submit handler silently forces assigneeIds to [currentUser.empId],
// so adding a required/non-empty rule here would incorrectly block a role that never
// sees the control.
import { z } from 'zod';
import { PROJECT_STATUSES } from '../projects/create-project-modal';
import { TASK_PRIORITIES } from '../tasks/create-task-modal.schema';

export const createFunctionSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  description: z.string().optional(),
  projId: z.string().optional(),
  parentFnId: z.string().optional(),
  assigneeIds: z.array(z.string()).default([]),
  status: z.enum(PROJECT_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  deadline: z.string().optional(),
});

export type CreateFunctionFormValues = z.infer<typeof createFunctionSchema>;
