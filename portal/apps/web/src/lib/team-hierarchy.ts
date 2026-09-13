// Same taxonomy as LGDesk's registration-modal.schema.ts TEAM_HIERARCHY -- duplicated
// deliberately, not imported: Portal and LGDesk are separate frontend codebases with no
// shared package (per the architecture doc, each pillar is its own top-level monorepo).
// P27: pulled out of register/page.tsx into its own file so profile/page.tsx (team/
// sub-department editing) can reuse the same single copy instead of a third duplicate.
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
