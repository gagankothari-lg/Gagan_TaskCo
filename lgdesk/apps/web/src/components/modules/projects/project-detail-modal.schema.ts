// Zod schema for the Project detail/edit form.
// Field set/format mirrors apps/api/src/projects/dto/update-project.dto.ts (all fields
// optional there — name is still required client-side so a user can't blank it out).
// ownerIds exists on the DTO but this UI never edits it, so it's intentionally absent here.
import { z } from 'zod';
import { PROJECT_STATUSES } from './create-project-modal';
import { TASK_PRIORITIES } from '../tasks/create-task-modal.schema';

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  description: z.string().optional(),
  status: z.enum(PROJECT_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  deadline: z.string().optional(),
  assigneeIds: z.array(z.string()).default([]),
});

export type UpdateProjectFormValues = z.infer<typeof updateProjectSchema>;
