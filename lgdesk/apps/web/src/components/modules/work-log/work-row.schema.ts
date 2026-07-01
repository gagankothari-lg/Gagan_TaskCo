// Zod schema for the "true form fields" of a single Work Log day-row.
// Mirrors apps/api/src/work-log/dto/create-work-log.dto.ts / update-work-log.dto.ts
// (date comes from the row's `date` prop, not a form field; attendance/purpose/
// leaveRequested/work1stHalf/work2ndHalf/extraHours/remark are everyone's; status/
// comments are manager-only and stripped server-side for non-managers).
//
// NOTE: the chip lists (h1/h2), the "Worked" off-day checkbox, and the quick-entry
// hours box are UI-transient mechanics with no validation rule of their own — they stay
// as plain useState in work-row.tsx (see that file's comments) so the 500ms debounced
// auto-save contract used across the whole Work Log grid isn't put at risk by this
// migration.
import { z } from 'zod';

export const workRowSchema = z.object({
  attendance: z.string().optional(),
  internText: z.string().optional(),
  extraHours: z.coerce.number().min(0, 'Extra hours cannot be negative.').max(12, 'Extra hours must be 12 or fewer.'),
  remark: z.string().optional(),
  status: z.string().optional(),
  comments: z.string().optional(),
});

export type WorkRowFormValues = z.infer<typeof workRowSchema>;
