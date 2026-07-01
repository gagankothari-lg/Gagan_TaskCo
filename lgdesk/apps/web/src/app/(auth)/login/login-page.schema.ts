// Zod schemas for the three forms on the login page (sign-in, forgot-password step 1
// "request code", forgot-password step 2 "confirm code + new password").
// Rules sourced from LGDesk_Master_Reference.md Part 11 (Module — Authentication &
// Session Management, line ~649: "Minimum 6 characters enforced at registration and
// reset"; "OTP reset: 6-digit code") and apps/api/src/auth/dto/login.dto.ts.
import { z } from 'zod';

const emailField = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .email('Enter a valid email address.');

// NOTE: no minLength on password here on purpose, mirroring the comment in
// apps/api/src/auth/dto/login.dto.ts — login must accept any non-empty password and let
// the credential check reject bad passwords with a 401, rather than blocking client-side
// on length (that DTO explicitly avoids @MinLength for the same reason).
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required.'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const forgotPasswordRequestSchema = z.object({
  email: emailField,
});
export type ForgotPasswordRequestFormValues = z.infer<typeof forgotPasswordRequestSchema>;

// Kept at min-6 (Master Reference Part 11 password-security rule) — this is the ONLY
// forgot-password flow in the app (the previously-orphaned apps/web/src/app/(auth)/
// forgot-password/page.tsx duplicate was removed in the shadcn/ui pass). Still distinct
// from profile-modal's change-password form, which is min-8 per its backend DTO
// (@MinLength(8)); do not unify these, see migration report.
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
