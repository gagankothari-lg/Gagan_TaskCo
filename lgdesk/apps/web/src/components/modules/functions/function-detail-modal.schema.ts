// Zod schema for the Function detail/edit form.
// Field set/format mirrors apps/api/src/functions/dto/update-function.dto.ts (all fields
// optional there — name is still required client-side so a user can't blank it out).
// `links` models the UI's single multiline textarea as one optional string; the
// split('\n')-into-string[] transform happens in the submit handler exactly as before
// this migration, so no URL-format validation is added here (none existed previously).
import { z } from 'zod';
import { PROJECT_STATUSES } from '../projects/create-project-modal';
import { TASK_PRIORITIES } from '../tasks/create-task-modal.schema';

export const updateFunctionSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  description: z.string().optional(),
  status: z.enum(PROJECT_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  deadline: z.string().optional(),
  links: z.string().optional(),
  assigneeIds: z.array(z.string()).default([]),
});

export type UpdateFunctionFormValues = z.infer<typeof updateFunctionSchema>;
