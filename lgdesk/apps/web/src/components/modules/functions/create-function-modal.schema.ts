// Zod schema for the "New Function" form.
// Field set/format mirrors apps/api/src/functions/dto/create-function.dto.ts (name
// required; everything else optional). assigneeIds is intentionally NOT validated here:
// the field is only rendered for managers (see create-function-modal.tsx) — for
// non-managers the submit handler silently forces assigneeIds to [currentUser.empId],
// so adding a required/non-empty rule here would incorrectly block a role that never
// sees the control.
import { z } from 'zod';
import { TASK_PRIORITIES } from '../tasks/create-task-modal.schema';

// Round4 F5: Functions have their own reference-ground-truth status vocabulary
// (setupSheets.gs VALIDATIONS.Functions.Status), distinct from Projects' PROJECT_STATUSES
// (they share only 'Done'/'Cancelled'/'Planning') -- mirrors apps/api/src/common/
// constants.ts's FUNCTION_STATUSES exactly. Defined here (not re-derived elsewhere) so
// create-function-modal.tsx and function-detail-modal(.schema).ts share one source.
export const FUNCTION_STATUSES = [
  'Yet to Start', 'Planning', 'WIP (0%-25%)', 'WIP (25%-50%)', 'WIP (50%-75%)', 'WIP (75%-100%)', 'Review', 'On Hold', 'Cancelled', 'Done',
] as const;

// Round4 F35: Function's own recurring-cadence vocabulary -- wider than Task's 5-value
// list (setupSheets.gs:13,104; cross-checked against the live `#fe-recurring` select,
// app.js.html:11695-11775). Mirrors apps/api/src/common/constants.ts
// FUNCTION_RECURRENCE_PATTERNS exactly.
export const FUNCTION_RECURRENCE_PATTERNS = [
  'One Time', 'Daily', 'Weekly', 'Alternate Week', 'Bi Weekly', 'Monthly', 'Bi Monthly', 'Quarterly', 'Bi Yearly', 'Yearly',
] as const;

export const createFunctionSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  description: z.string().optional(),
  projId: z.string().optional(),
  parentFnId: z.string().optional(),
  assigneeIds: z.array(z.string()).default([]),
  status: z.enum(FUNCTION_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  startDate: z.string().optional(),
  deadline: z.string().optional(),
  recurringPattern: z.enum(FUNCTION_RECURRENCE_PATTERNS),
});

export type CreateFunctionFormValues = z.infer<typeof createFunctionSchema>;
