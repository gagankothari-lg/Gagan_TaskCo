// Zod schema for the "Post Announcement" form.
// Mirrors apps/api/src/dashboard/dto/create-announcement.dto.ts: title required
// non-empty, content optional, startDate/endDate optional valid dates, visibility
// optional and must be one of VISIBILITY_TYPES (apps/api/src/common/constants.ts —
// ['Organisation', 'TCs & TFs', 'TCs Only']), which already matched this file's
// pre-migration local VISIBILITY array; now an `as const` tuple so it's usable by
// z.enum().
import { z } from 'zod';

export const VISIBILITY = ['Organisation', 'TCs & TFs', 'TCs Only'] as const;

const optionalDate = z
  .string()
  .optional()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Enter a valid date.');

export const announcementSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required.'),
    content: z.string().optional(),
    startDate: optionalDate,
    endDate: optionalDate,
    visibility: z.enum(VISIBILITY).optional(),
  })
  // Part 37 checklist: "Set To date earlier than From date -> click Post -> toast 'End
  // date must be after start date.'"
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && Date.parse(data.endDate) < Date.parse(data.startDate)) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be after start date.' });
    }
  });

export type AnnouncementFormValues = z.infer<typeof announcementSchema>;
