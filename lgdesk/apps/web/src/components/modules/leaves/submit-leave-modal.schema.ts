// Zod schema for the "Request Leave" form.
// Field set mirrors apps/api/src/leaves/dto/create-leave.dto.ts: leaveType must be one
// of LEAVE_TYPES (apps/web/src/lib/types.ts — kept in lockstep with the backend's
// @IsIn([...LEAVE_TYPES]) constraint sourced from apps/api/src/common/constants.ts),
// startDate/endDate required valid dates, reason optional.
//
// Part 37 My Leaves Checklist message wording is asserted literally, so every
// superRefine issue below uses the exact checklist string:
//   - no type    -> "Please select a leave type."
//   - no start   -> "Please enter a start date."
//   - end<start  -> "End date must be on or after start date."
// Cross-field rule (Master Reference Part 23 "Submit Flow" + Business Rule #7): Half
// Day leave requires startDate === endDate. The UI already keeps them in sync via the
// onStart/onType handlers (endDate is disabled while Half Day is selected), but this
// superRefine makes the invariant a real validation rule rather than only a UI nicety.
import { z } from 'zod';
import { LEAVE_TYPES } from '../../../lib/types';

export const submitLeaveSchema = z
  .object({
    // '' is the unselected "— Select Type —" placeholder state.
    leaveType: z.union([z.enum(LEAVE_TYPES), z.literal('')]),
    startDate: z.string(),
    endDate: z.string(),
    reason: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.leaveType) {
      ctx.addIssue({ code: 'custom', path: ['leaveType'], message: 'Please select a leave type.' });
    }
    if (!data.startDate) {
      ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Please enter a start date.' });
    }
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be on or after start date.' });
    }
    if (data.leaveType === 'Half Day' && data.startDate && data.endDate && data.startDate !== data.endDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Half Day leave requires the start and end date to match.' });
    }
  });

export type SubmitLeaveFormValues = z.infer<typeof submitLeaveSchema>;
