// Zod schema for the "Change Role" form. Backend DTO (apps/api/src/users/dto/
// change-role.dto.ts) just requires `newRole` to be a non-empty string in
// ALL_ROLES — the actual actor/target matrix is enforced by
// UsersService.changeRole and mirrored client-side via lib/rbac.ts
// `allowedNewRoles` (which options even render into the <select>).
import { z } from 'zod';

export const changeRoleSchema = z.object({
  newRole: z.string().min(1, 'Select a role.'),
});

export type ChangeRoleFormValues = z.infer<typeof changeRoleSchema>;
