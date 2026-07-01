// Zod schemas for the two independent forms in profile-modal.tsx: the profile-fields
// update form and the change-password form.
// Field set mirrors apps/api/src/users/dto/update-profile.dto.ts (firstName/lastName/
// designation/team are exposed by this UI; subDepartment/dob are not — not added here,
// that would be new scope) and apps/api/src/auth/dto/change-password.dto.ts
// (@MinLength(8) on newPassword).
import { z } from 'zod';

export const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  designation: z.string().optional(),
  // Free-text input today, not a TEAM_HIERARCHY dropdown — left as-is (forcing it into an
  // enum would be new feature scope, out of bounds for this migration).
  team: z.string().optional(),
});
export type ProfileUpdateFormValues = z.infer<typeof profileUpdateSchema>;

// newPassword kept at min-8 to match this file's pre-existing guard and
// apps/api/src/auth/dto/change-password.dto.ts's @MinLength(8) — this is NOT the
// registration form (min-6); do not change.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
    }
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
