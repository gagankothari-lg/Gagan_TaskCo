// Zod schema for the "Schedule Meeting" form.
// Mirrors apps/api/src/meetings/dto/create-meeting.dto.ts: title required non-empty,
// description optional, durationMins required integer >= 1, meetType/attendeeIds/
// attendeeTeams optional. The DTO's single ISO `startTime` is modelled here as separate
// `date` + `time` fields (matching the UI's two native inputs) and combined into
// `startTime` on submit exactly as before this migration — see the component's
// onSubmit. meetType is constrained to the two values this UI actually offers
// ('personal' | 'custom'); Company/Team meeting templates from Master Reference Part 21
// are not implemented in this form (pre-existing gap, not introduced here).
import { z } from 'zod';

export const MEET_TYPES = ['personal', 'custom'] as const;

export const scheduleMeetingSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.'),
  description: z.string().optional(),
  date: z
    .string()
    .min(1, 'Date is required.')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date.'),
  time: z.string().trim().min(1, 'Time is required.'),
  durationMins: z.number().int('Duration must be a whole number.').min(1, 'Duration must be at least 1 minute.'),
  meetType: z.enum(MEET_TYPES),
  attendeeIds: z.array(z.string()).optional(),
  teams: z.array(z.string()).optional(),
});

export type ScheduleMeetingFormValues = z.infer<typeof scheduleMeetingSchema>;
