// Zod schema for the "Request date change" (DDR) form.
// No dedicated backend DTO file exists for DDR creation (apps/api/src/ddr/ has only
// ddr.controller.ts / ddr.service.ts / ddr.module.ts, no dto/ subfolder), so this schema
// is based on the pre-migration frontend guards it replaces:
//   if (!newDueDate) return setError('Pick a new due date');
//   if (!reason.trim()) return setError('Reason is required');
import { z } from 'zod';

export const ddrSchema = z.object({
  newDueDate: z
    .string()
    .min(1, 'Pick a new due date.')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date.'),
  reason: z.string().trim().min(1, 'Reason is required.'),
});

export type DdrFormValues = z.infer<typeof ddrSchema>;
