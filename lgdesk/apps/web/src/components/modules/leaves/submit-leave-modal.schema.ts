// Zod schema for the "Request Leave" form.
// Field set mirrors apps/api/src/leaves/dto/create-leave.dto.ts: leaveType must be one
// of LEAVE_TYPES (apps/web/src/lib/types.ts — kept in lockstep with the backend's
// @IsIn([...LEAVE_TYPES]) constraint sourced from apps/api/src/common/constants.ts),
// startDate/endDate required valid dates, reason optional.
// Cross-field rule (Master Reference Part 23 "Submit Flow" + Business Rule #7): Half
// Day leave requires startDate === endDate. The UI already keeps them in sync via the
// onStart/onType handlers (endDate is disabled while Half Day is selected), but this
// superRefine makes the invariant a real validation rule rather than only a UI nicety.
import { z } from 'zod';
import { LEAVE_TYPES } from '../../../lib/types';

const requiredDate = (label: string) =>
  z
    .string()
    .min(1, `${label} is required.`)
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date.');

export const submitLeaveSchema = z
  .object({
    leaveType: z.enum(LEAVE_TYPES, { message: 'Select a leave type.' }),
    startDate: requiredDate('Start date'),
    endDate: requiredDate('End date'),
    reason: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.leaveType === 'Half Day' && data.startDate !== data.endDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Half Day leave requires the start and end date to match.' });
    }
  });

export type SubmitLeaveFormValues = z.infer<typeof submitLeaveSchema>;
