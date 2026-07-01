// Zod schema for the public Registration form.
// Rules sourced from LGDesk_Master_Reference.md Part 11 (Module — Authentication &
// Session Management, line 649) and Part 4 (Users, Roles & Permission Matrix).
//
// NOTE (backend gap — do not "fix" here): apps/api/src/auth/dto/register-request.dto.ts
// only accepts firstName/lastName/email/password/team/subDepartment/designation
// (ValidationPipe has forbidNonWhitelisted:true, so role/dob/managerEmail/message would
// 400 if sent). role/dob/managerEmail are still validated client-side below for parity
// with the legacy GAS form and so the UI matches Master Reference exactly; the submit
// handler continues to send only the API-whitelisted subset, same as before this
// migration.
import { z } from 'zod';

export const ROLES = [
  'Super Admin',
  'Admin',
  'Team Captain',
  'Team Facilitator',
  'Team Member',
  'Intern',
] as const;

// Division -> sub-department list. Divisions with an empty array (Founder's Office,
// Knowledge, Consulting) have no sub-departments and skip the conditional-required rule.
// Kept identical to the pre-migration constant in this file's component (single existing
// source of truth in this codebase) — Master Reference's change-log entries (Change #22,
// verification checklist line 2740) describe differently-labelled sub-departments for a
// couple of divisions (e.g. "5a. Product", "7a. People & Performance (HR)"); that is a
// pre-existing data-fidelity gap between the doc and the implemented org structure, not a
// form-validation bug, so it is left untouched here (flagged in the migration report).
export const TEAM_HIERARCHY: Record<string, string[]> = {
  "1. Founder's Office": [],
  '2. Student Success': ['CFA L1', 'CFA L2', 'CFA L3', 'FRM', 'CA', 'CMA', 'CFA Scholarships', 'CUET'],
  '3. Knowledge': [],
  '4. Growth (Marketing)': ['Digital Marketing', 'Brand & Design', 'Social Media', 'Content', 'Events', 'Partnerships'],
  '5. Tech': ['Product', 'Development', 'Maintenance'],
  '6. Consulting': [],
  '7. Operations - PP & Admin': ['HR', 'Finance', 'Admin', 'IT Infrastructure'],
  '8. Operations - FP&A': ['FP&A', 'MIS', 'Procurement'],
};
export const DIVISIONS = Object.keys(TEAM_HIERARCHY);

// Roles that type their reporting manager manually. Per the Master Reference
// verification checklist ("Registration — manager resolution"): Super Admin's manager
// field is optional ("Reports-to Email (optional)"); Admin/Team Captain must enter one
// manually ("Reports-to Email", required); Team Facilitator/Team Member/Intern are meant
// to have the field auto-resolved server-side from the team's Team Captain (readOnly,
// required, submit disabled if unresolved) — that live auto-resolve call does not exist
// in this NestJS port yet (getTeamCaptainByTeam has no equivalent endpoint here, and the
// field isn't even part of RegisterRequestDto), so the field stays a plain editable input
// for those roles but keeps the same "required" semantics documented for it.
export const MANUAL_MANAGER_ROLES = ['Super Admin', 'Admin', 'Team Captain'] as const;

export function subDepartmentsFor(team: string): string[] {
  return TEAM_HIERARCHY[team] ?? [];
}

export function subDepartmentRequired(team: string): boolean {
  return subDepartmentsFor(team).length > 0;
}

const emailField = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .email('Enter a valid email address.');

export const registrationSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required.'),
    lastName: z.string().trim().min(1, 'Last name is required.'),
    email: emailField,
    password: z.string().min(6, 'Password must be at least 6 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your password.'),
    role: z.enum(ROLES, { message: 'Select a role.' }),
    dob: z
      .string()
      .min(1, 'Date of birth is required.')
      .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date.'),
    team: z.string().min(1, 'Team division is required.').refine((v) => DIVISIONS.includes(v), 'Select a valid division.'),
    subDepartment: z.string().optional(),
    designation: z.string().max(100, 'Designation must be 100 characters or fewer.').optional(),
    managerEmail: z.string().optional(),
    message: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
    }

    if (subDepartmentRequired(data.team) && !data.subDepartment?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['subDepartment'], message: 'Select a sub-department for this division.' });
    }

    const managerManual = data.role !== 'Super Admin'; // required for everyone except Super Admin
    if (managerManual) {
      const email = data.managerEmail?.trim();
      if (!email) {
        ctx.addIssue({ code: 'custom', path: ['managerEmail'], message: "Manager's email is required." });
      } else if (!z.string().email().safeParse(email).success) {
        ctx.addIssue({ code: 'custom', path: ['managerEmail'], message: 'Enter a valid email address.' });
      }
    } else if (data.managerEmail?.trim() && !z.string().email().safeParse(data.managerEmail.trim()).success) {
      ctx.addIssue({ code: 'custom', path: ['managerEmail'], message: 'Enter a valid email address.' });
    }
  });

export type RegistrationFormValues = z.infer<typeof registrationSchema>;
