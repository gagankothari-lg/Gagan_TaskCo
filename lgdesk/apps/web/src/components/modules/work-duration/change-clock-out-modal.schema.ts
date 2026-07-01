// Zod schema for the "Clock out at a specific time" form.
// Mirrors apps/api/src/work-duration/dto/clock-out.dto.ts (customTime?: 'HH:MM', reason?: string).
// The UI keeps hour/minute as two separate numbers (fed into an analog clock preview) and
// combines them into the DTO's `customTime` string on submit — see change-clock-out-modal.tsx.
import { z } from 'zod';

export const changeClockOutSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  reason: z.string().optional(),
});

export type ChangeClockOutFormValues = z.infer<typeof changeClockOutSchema>;
