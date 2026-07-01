// Zod schema for the "Add Holiday" form.
// Mirrors apps/api/src/leaves/dto/create-holiday.dto.ts: name required non-empty,
// date required valid date.
import { z } from 'zod';

export const holidaySchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  date: z
    .string()
    .min(1, 'Date is required.')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date.'),
});

export type HolidayFormValues = z.infer<typeof holidaySchema>;
