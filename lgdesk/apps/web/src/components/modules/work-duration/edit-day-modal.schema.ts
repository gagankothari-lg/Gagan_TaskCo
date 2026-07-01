// Zod schema for the "Edit work day" form.
// Mirrors apps/api/src/work-duration/dto/edit-time.dto.ts: startTime required 'HH:MM',
// endTime optional 'HH:MM', breakMins optional non-negative integer, reason required.
import { z } from 'zod';

export const editDaySchema = z.object({
  startTime: z.string().trim().min(1, 'Start time is required.'),
  endTime: z.string().optional(),
  breakMins: z.number().int().min(0, 'Break minutes must be 0 or greater.').optional(),
  reason: z.string().trim().min(1, 'Reason is required.'),
});

export type EditDayFormValues = z.infer<typeof editDaySchema>;
