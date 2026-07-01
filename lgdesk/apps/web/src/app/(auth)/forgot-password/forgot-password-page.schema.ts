// Zod schemas for the two-step /forgot-password page (request code, confirm code + new
// password).
//
// NOTE (flag, not a fix): this route appears orphaned — nothing in apps/web/src links or
// navigates to it (login/page.tsx implements its own inline forgot-password flow instead).
// Converted anyway per the forms-audit scope.
import { z } from 'zod';

const emailField = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .email('Enter a valid email address.');

export const requestOtpSchema = z.object({
  email: emailField,
});
export type RequestOtpFormValues = z.infer<typeof requestOtpSchema>;

// newPassword kept at min-8 (NOT min-6 like the registration form) because this page's own
// backend endpoint, apps/api/src/auth/dto/reset-password-confirm.dto.ts, enforces
// @MinLength(8) — dropping to 6 client-side would let the form accept a password the
// server then 400s on. See migration report: Master Reference Part 11 says password
// resets should be minimum-6, but this DTO (and change-password.dto.ts) actually enforce
// 8 — a pre-existing backend/spec inconsistency, not fixed here.
export const confirmResetSchema = z
  .object({
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Enter the 6-digit code.'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
    }
  });
export type ConfirmResetFormValues = z.infer<typeof confirmResetSchema>;
