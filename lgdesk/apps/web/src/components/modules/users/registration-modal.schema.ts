// Shared team/sub-department taxonomy -- NOT registration-specific despite the filename
// (kept here rather than moved, per P19: org-chart/page.tsx and profile-modal.schema.ts
// both import TEAM_HIERARCHY/DIVISIONS from this exact path, so renaming/moving it is a
// bigger, riskier change than this phase's actual scope). The registration form's own Zod
// schema (registrationSchema/RegistrationFormValues) was removed in P19 along with
// registration-modal.tsx, its only consumer -- registration now lives in Portal.
//
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

export function subDepartmentsFor(team: string): string[] {
  return TEAM_HIERARCHY[team] ?? [];
}

export function subDepartmentRequired(team: string): boolean {
  return subDepartmentsFor(team).length > 0;
}
