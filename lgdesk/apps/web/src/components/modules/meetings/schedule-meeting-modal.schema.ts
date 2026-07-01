// Zod schema for the "Schedule Meeting" form.
// Mirrors apps/api/src/meetings/dto/create-meeting.dto.ts: title required non-empty,
// description optional, durationMins one of the fixed Part 37 Meetings Checklist
// options (15/30/45/60/90/120, default 30), meetType is one of the three Master
// Reference Part 21 templates (company/team/custom). attendeeIds/teams only apply to
// 'custom' (people + team pickers) — company auto-invites everyone, team auto-invites
// the organizer's own team, both server-enforced (meetings.service.ts).
import { z } from 'zod';

export const MEET_TYPES = ['company', 'team', 'custom'] as const;
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

export const scheduleMeetingSchema = z
  .object({
    title: z.string().trim().min(1, 'Meeting title is required'),
    description: z.string().optional(),
    date: z.string(),
    time: z.string(),
    durationMins: z.number().int(),
    meetType: z.enum(MEET_TYPES),
    attendeeIds: z.array(z.string()).optional(),
    teams: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.date || !data.time) {
      ctx.addIssue({ code: 'custom', path: ['date'], message: 'Date and time are required' });
    }
  });

export type ScheduleMeetingFormValues = z.infer<typeof scheduleMeetingSchema>;
