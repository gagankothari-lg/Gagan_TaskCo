# LGDesk Verification Audit — Fix Report

Date: 2026-07-02
Scope: Prioritized confirmed bugs from the verification audit (Groups 1–3).
Build status after all fixes:
- `npm run build --workspace=apps/api` — **PASS**
- `npm run build --workspace=apps/web` — **PASS**
- `apps/api` `npx tsc --noEmit` — **PASS** (exit 0)
- `apps/web` `npx tsc --noEmit` — **PASS** (exit 0)
- `npx prisma generate` (schema-only, no `db push`) — **PASS**

> No `prisma db push` / migration was run — schema + generated client only. The DB-level
> change (dropping the `RegistrationRequest.email` unique constraint) must be applied to the
> live database separately by someone with DB access.

## Group 1 — Security / RBAC (apps/api)

| Module | Item | Status | Note |
|---|---|---|---|
| Users / RBAC | 1. Admin can edit another Admin's role | FIXED | `users.service.ts:376-378` — Admin branch now blocks `isAdmin(target.role)` (both `Admin` and `Super Admin`) instead of only `Super Admin`. Super Admin's path is untouched (the guard is `caller.role === 'Admin'`-gated), so SA can still edit Admins. |
| Users / RBAC | 2. No guard against changing your own role | FIXED | `users.service.ts:369-371` — early `if (callerEmpId === targetEmpId) throw new ForbiddenException('You cannot change your own role.')`, placed before any role-specific branch, so it applies to every role including Super Admin. |
| Tasks / RBAC | 3. Tasks module had zero self-assign enforcement (Rule 22) | FIXED | Ported the `FunctionsService` pattern: added `TasksService.isTmSelfAssign()` (`tasks.service.ts:39-42`), and enforced it in `createTask` (`:104-111`) and the reassign block of `updateTask` (`:178-185`). For non-managers the assignees must be empty or exactly `[self]` **and** no team may be set (`assignedTeams` blocked, since tasks resolve teams into the assignee set). Managers (Admin/SA/TC/TF) are unaffected. |
| Work Log / RBAC | 4. Status/comment-update routes missing team clamp | FIXED | `work-log.service.ts:127-135` (`setWorkLogStatus`) and `:137-149` (`setWorkLogComment`) now capture the caller from `requireManager`, look up the target's team, and apply the same clamp as `getMemberWorkLogs`/`adminSubmitWorkLog`: `if (!isAdmin(caller.role) && target.team !== caller.team) throw`. Admin/SA unclamped. |
| Prisma schema | 5. `Task.subFnId` had no FK relation | FIXED | `schema.prisma` — added `subFunction WorkFunction? @relation("SubFunctionTasks", fields: [subFnId], references: [functionId], onDelete: SetNull)` on `Task` (~line 97) and the back-relation `subFnTasks Task[] @relation("SubFunctionTasks")` on `WorkFunction` (~line 158). Distinct relation name from the existing `SubFunctions` self-relation and `FunctionTasks`. `prisma generate` run; no `db push`. |

## Group 2 — Registration bug (apps/api)

| Module | Item | Status | Note |
|---|---|---|---|
| Users / Registration | 6. Rejected applicants can never re-register | FIXED | App-level: `users.service.ts:140` — duplicate check now `findFirst({ where: { email …, status: 'Pending' } })`, so only a still-pending request blocks a new submission. DB-level: dropped the blanket `@unique` on `RegistrationRequest.email` in `schema.prisma` (~line 448); a comment documents that duplicate *pending* requests are prevented at the app layer. **Choice rationale:** this project has no `prisma/migrations` directory and no raw-SQL migration pattern (schema is applied via `db push`), so a partial/conditional unique index via raw SQL was not an available established pattern. Per the brief's guidance, took the simpler route (drop the blanket unique + rely on the app-level Pending-only check), which maps most directly to the business rule "one pending request per email; re-registration allowed after rejection." |

## Group 3 — Frontend bugs (apps/web)

| Module | Item | Status | Note |
|---|---|---|---|
| Work Duration | 7. Team Clock Status: on-break members show "—"; break time never subtracted | FIXED | `team-clock-status.tsx:67-73` — `live` now computes for `status === 'ACTIVE' || 'ON_BREAK'`, and elapsed = `now − clockInTs − totalBreakMins*60000`, clamped at 0 with `Math.max(0, …)` (Rule #8). |
| Dashboard shell | 8. "My Profile" menu item was dead (toast) | FIXED | `layout-client.tsx` — imported `ProfileModal` (~line 11), added `profileOpen` state (~line 52), the "My Profile" item now `setProfileOpen(true)` instead of the "coming soon" toast (~line 265), and `<ProfileModal open={profileOpen} onClose={…} />` is rendered near `<ImportModal>` (~line 368). |
| Tasks | 9. Due Date filter leaked tasks with no due date | FIXED | `filter-bar.tsx:110` — guard changed to `if (f.due && (!t.dueDate || new Date(t.dueDate) > end)) return false;` so a task with no due date is excluded when a due-by filter is active. |
| UI primitives | 10. Modal/dropdown/popover entrance-exit animations dead app-wide | FIXED | Rewrote the broken `data-open:`/`data-closed:` variants (which never match — Radix sets `data-state="open"`/`"closed"`) to Tailwind arbitrary-attribute syntax `data-[state=open]:…`/`data-[state=closed]:…` (approach (b), no plugin needed). Files: `dialog.tsx:33,58`, `dropdown-menu.tsx:33`, `popover.tsx:38`. **Extra (same bug, beyond the 3 named files):** `select.tsx:72` had the identical dead `data-open`/`data-closed` variants and was fixed too for app-wide consistency (it already used the working `data-[side=…]` arbitrary syntax alongside the broken ones). `tailwindcss-animate` is installed and supplies `animate-in`/`fade-in-0`/`zoom-in-95`; content globs (`./src/**/*.{js,ts,jsx,tsx,mdx}`) cover all four files; both `tsc` and the production build pass. |

## Accepted Gaps (not fixed this pass)

Documented for the next session — each is either blocked on external credentials, a behavioral/product decision, or a broader consistency pass out of scope for a targeted bug-fix round.

- **Meetings Google Calendar/Meet-link integration is a stub returning null** — `apps/api/src/meetings/google-calendar.service.ts`. Blocked pending Google service-account credentials (same category as the already-known-blocked Phase 7–10 Google integrations); cannot be completed without those credentials.
- **Team Tasks / Team Projects data-scope (visibility) model diverges from the "any team member" spec** — a broader behavioral change to what TC/TF can see (`tasks.service.ts` `visibleToManager` / `managerScopeIds` and the projects equivalent). Deferred pending product sign-off since it changes access scope, not a pure bug fix.
- **Missing toast/confirm feedback across Leave / Registration / Profile-Update / DDR approval flows** — broad multi-file UX consistency gap; deferred as a dedicated follow-up pass rather than rushed here.
- **Stale UI after Change-Role / registration approval** — `MembersView` doesn't invalidate the relevant TanStack Query caches on mutation; deferred pending a query-invalidation architecture review.
- **8 `window.confirm()` call sites** use the native browser dialog instead of the app's toast/dialog pattern — cosmetic/consistency; deferred.
- **`weekly-summary-modal.tsx` still uses legacy `.modal` CSS classes** instead of the shared `Dialog` primitive — cosmetic; deferred.
- **Attachments backend module doesn't exist yet** — the Prisma model exists but there is no controller/service. Blocked pending Google Drive credentials (same category as Phase 7).
- **Batch "Add Tasks" multi-row entry and column-header sort on task tables don't exist** — likely an intentional feature simplification during the rewrite; needs product confirmation before treating as a bug.
- **Organisation page only shows the DDR queue** (Registrations/Profile-Updates live on separate `/registrations` and `/profile-requests` pages) — a real gap but a page-layout/consolidation decision to confirm with product.
- **Status enum divergence** — the app's actual task/project statuses (`common/constants.ts` `TASK_STATUSES`) vs. the Master Reference's literal legacy list. Pre-existing, documented in earlier phases; needs a product decision on which list is canonical.
