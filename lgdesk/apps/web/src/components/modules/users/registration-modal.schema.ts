// Zod schema for the public Registration form.
// Rules sourced from LGDesk_Master_Reference.md Part 11 (Module — Authentication &
// Session Management, line 649) and Part 4 (Users, Roles & Permission Matrix).
//
// NOTE (backend gap, partially fixed — PFIX-REGISTRATION-ROLE-AND-PASSWORD-TOGGLE):
// apps/api/src/auth/dto/register-request.dto.ts now whitelists role (validated against
// the same ALL_ROLES list as below) in addition to firstName/lastName/email/password/
// team/subDepartment/designation. dob/message are still NOT whitelisted (ValidationPipe
// has forbidNonWhitelisted:true, so sending them would 400) — they're validated
// client-side below purely for parity with the legacy GAS form and so the UI matches
// Master Reference exactly; the submit handler only sends the API-whitelisted subset
// for those two. managerEmail IS now whitelisted and sent (Round4 S4 fix) — but only
// for MANUAL_MANAGER_ROLES; see the submit handler and users.service.ts.
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
//
// PFIX-ORG-STRUCTURE-DATA (2026-07-06): the previous version of this constant was wrong —
// it appears to have been populated with Aswini Bajaj Classes course/product names (CFA
// L1/L2/L3, FRM, CA, CMA, CUET, etc. under Student Success) and other placeholder-looking
// labels, not the actual org structure. Corrected against `reference/setupSheets.gs`'s
// `TEAM_HIERARCHY` (lines 67-76) — the authoritative source, confirmed directly with the
// founder — including the "1a./2a./5a." numeric prefixes, which are REAL stored data (used
// as literal Sub_Department dropdown-validation values in the reference, not just doc
// numbering — see `SUB_DEPARTMENTS`/`fixTeamAndSubDepartmentData()` in the same file).
// `org-chart/page.tsx` imports this same constant, so this one edit fixes both surfaces.
//
// Deliberately NOT reassigned as part of this fix (explicit instruction: no production data
// changes): one existing Team-5 employee has `subDepartment: "Product"` (pre-fix, unprefixed)
// and will now correctly surface under the Org Chart's synthetic "Unassigned" bucket instead
// of silently matching a wrong-but-coincidentally-present dropdown entry; several pending
// Registration Requests reference `team: "Tech"` (doesn't match any canonical division,
// before or after this fix) and unprefixed sub-departments — left untouched for a human to
// reconcile at approval time, not silently corrected here.
export const TEAM_HIERARCHY: Record<string, string[]> = {
  "1. Founder's Office": ['1a. MIS, Data & Strategy', '1b. Innovation (R&D)'],
  '2. Student Success': ['2a. Student Counselling (Sales)', '2b. Student Support (Customer Support)', '2c. Partnerships & Outreach'],
  '3. Knowledge': [],
  '4. Growth (Marketing)': ['4a. Vision & Voice', '4b. Creative Hub'],
  '5. Tech': ['5a. Product', '5b. Development', '5c. Maintenance'],
  '6. Consulting': ['6a. Client Delivery', '6b. Research'],
  '7. Operations - PP & Admin': ['7a. People & Performance (HR)', '7b. Admin'],
  '8. Operations - FP&A': ['8a. Financial Planning & Analysis'],
};
export const DIVISIONS = Object.keys(TEAM_HIERARCHY);

// Roles that type their reporting manager manually. Per reference/auth.gs's
// getTeamCaptainByTeam + app.js.html's _REG_MANUAL_ROLES/_regAutoFillManager: Super
// Admin's manager field is optional ("Reports-to Email (optional)"); Admin/Team Captain
// must enter one manually ("Reports-to Email", required); Team Facilitator/Team
// Member/Intern get it auto-resolved (readOnly, required, submit disabled if
// unresolved) via GET /auth/team-captain (public, no auth — PFIX-REGISTRATION-MANAGER-
// EMAIL, 2026-07-07), wired in registration-modal.tsx via useTeamCaptain(). For these
// three manual roles the typed value IS now sent to the API (Round4 S4 fix — previously
// it was display-only and silently discarded; see RegisterRequestInput in lib/api/auth.ts
// and users.service.ts submitRegistration, which validates it resolves to an active
// employee before honoring it, falling back to getTeamCaptainByTeam if left blank). For
// every other role, the backend still calls getTeamCaptainByTeam independently,
// server-side — the frontend's auto-filled value here remains display-only for them,
// exactly as before, so it can never disagree with what the server actually resolves.
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
