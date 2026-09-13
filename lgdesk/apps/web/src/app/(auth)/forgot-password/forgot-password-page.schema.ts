// Zod schemas for the two-step forgot-password flow (request code, confirm code + new
// password). Rules sourced from LGDesk_Master_Reference.md Part 11 (Module —
// Authentication & Session Management, line ~649: "Minimum 6 characters enforced at
// registration and reset"; "OTP reset: 6-digit code").
//
// Phase 7b (Portal cutover): carved out of the former (auth)/login/login-page.schema.ts
// into its own standalone route. LGDesk no longer has its own sign-in form -- Portal is
// the only front door -- but forgot-password stays here as an interim exception (Portal
// has no equivalent flow built yet) since the password being reset lives in the shared
// `users` table LGDesk owns.
import { z } from 'zod';

const emailField = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .email('Enter a valid email address.');

export const forgotPasswordRequestSchema = z.object({
  email: emailField,
});
export type ForgotPasswordRequestFormValues = z.infer<typeof forgotPasswordRequestSchema>;

export const forgotPasswordResetSchema = z
  .object({
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Enter the 6-digit reset code.'),
    newPw: z.string().min(6, 'Password must be at least 6 characters.'),
    confirmPw: z.string().min(1, 'Confirm your new password.'),
  })
  .superRefine((data, ctx) => {
    if (data.newPw !== data.confirmPw) {
      ctx.addIssue({ code: 'custom', path: ['confirmPw'], message: 'Passwords do not match.' });
    }
  });
export type ForgotPasswordResetFormValues = z.infer<typeof forgotPasswordResetSchema>;
