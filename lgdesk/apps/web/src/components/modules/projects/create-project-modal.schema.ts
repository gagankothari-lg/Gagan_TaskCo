// Zod schema for the "New Project" form.
// Field set/format mirrors apps/api/src/projects/dto/create-project.dto.ts (name required;
// everything else optional).
import { z } from 'zod';
import { TASK_PRIORITIES } from '../tasks/create-task-modal.schema';

// Single source of truth for this enum — re-exported (unchanged) from
// create-project-modal.tsx so existing importers (create-function-modal,
// function-detail-modal, project-detail-modal) keep working.
export const PROJECT_STATUSES = ['Not Started', 'Planning', 'WIP', 'Under Review', 'On Hold', 'Done', 'Cancelled'] as const;

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  description: z.string().optional(),
  assigneeIds: z.array(z.string()).default([]),
  team: z.string().optional(),
  status: z.enum(PROJECT_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  deadline: z.string().optional(),
  parentProjId: z.string().optional(),
});

export type CreateProjectFormValues = z.infer<typeof createProjectSchema>;
