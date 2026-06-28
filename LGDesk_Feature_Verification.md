# LG Desk — Feature & UI/UX Verification Guide

*Generated from: `LGDesk_PRD.md`, `PROJECT_CONTEXT.md`, and the actual source tree (`src/index.html`, `src/app.js.html`, `src/*.gs`).*
*Last updated: 2026-06-28*

---

## About this document

This is the **QA source of truth** for LG Desk. Every statement below was verified against the **actual implementation** in `src/`, not the planned behaviour in the PRD. Where the source diverges from the PRD or from this document's original drafting template, the divergence is called out inline with a ⚠ marker. Features that were planned but are **not** in the code are marked **⚠ Planned / Not yet implemented**.

**Conventions used throughout:**
- UI elements are cited by their real HTML element type + `id` or CSS class (e.g. the attendance dropdown is a `<select>` with id `wl-att-{iso}`).
- `{iso}` denotes a per-day key in `YYYY-MM-DD` form; `{empId}` an employee id; `{n}` a row index.
- Each section ends with a `## Verification` checklist of actionable `- [ ]` items in the form *Action → expected result*.
- Roles, in descending permission order: **Super Admin → Admin → Team Captain (TC) → Team Facilitator (TF) → Team Member (TM) → Intern**. Two server predicates gate most access: `_isAdmin` = {Super Admin, Admin}; `_isManager` = {Super Admin, Admin, TC, TF}. TF is equivalent to TC inside `_isManager`; Intern shares Team Member surfaces except for the work-log (separate `Intern_Work_Log`, free-text attendance).

> **Stack at a glance (verified).** Google Apps Script (V8, `Asia/Kolkata`) backend over Google Sheets; vanilla-JS SPA frontend served in a GAS iframe; icons are **Material Symbols Outlined** (not Tabler); body font is **Montserrat**; AI weekly summaries use **Gemini 2.5 Flash** (`gemini-2.5-flash`); auto clock-out is a **daily midnight-UTC (05:30 IST) reset** (not an 18-hour cap).

---

## Table of Contents

1. Design System
2. Application Shell
3. Authentication
4. My Space — Work Log (incl. Weekly Summary)
5. My Space — My Tasks
6. Team — Team Work Logs
7. Team — Leave Approvals
8. Team — Team Members
9. Company — All Tasks / Team Tasks
10. Company — Organisation
11. Directory
12. Cross-Cutting Features
13. Role-Based Access Control Matrix
14. Google Sheets Data Schema
15. GAS Function Reference
16. Known Bugs Fixed (Session History)

---


---

## 1. Design System

All design tokens, typography, icons, and component styles live in a single inline `<style>` block in `src/index.html` (opens at line 10). The `:root` custom-property block sits at lines 12-18. The newer task / work-log UI does NOT use the `:root` tokens for its primary accents — it hard-codes LG navy `#2D3E51` and crimson `#E64D3D` as inline styles inside `src/app.js.html` (29 occurrences).

### 1.1 Brand Colours

Every CSS custom property declared in `:root` (`src/index.html` lines 12-18):

| Token | Hex | Usage |
|---|---|---|
| `--p` | `#1a237e` | Primary indigo — header bg (`#header`), nav active state, primary buttons (`.btn-primary`), stat-card top border + values, table `thead th` background, login gradient start |
| `--p2` | `#3949ab` | Lighter indigo — `.btn`/input focus rings, project-card top border (`.proj-card`), progress-bar fills, sub-function accents |
| `--p3` | `#e8eaf6` | Pale indigo tint — active nav background, hover backgrounds, multi-select chips (`.ms-chip`), assignment-chain backgrounds, login user card |
| `--accent` | `#00897b` | Teal accent — header avatar (`#hd-avatar`), accent buttons (`.btn-accent`), Team-Member role pill, meeting join button |
| `--danger` | `#c62828` | Red — `.btn-danger`, `.badge-critical`, `.pill-Cancelled`/`.pill-Rejected`, error toast, overdue deadlines, nav badge |
| `--warn` | `#e65100` | Orange — `.badge-high`, `.pill-On-Hold`/`.pill-Pending`, warn toast, Review kanban column |
| `--ok` | `#2e7d32` | Green — saved states, Done kanban column, `.pill-Approved`, success toast, low-priority task border |
| `--bg` | `#f0f2f5` | App background (`body`), input fill (`.wl-inp`, `.fdm-list-row`), card insets (`.tdm-card`) |
| `--surface` | `#fff` | Card / panel / modal surface, sidebar background |
| `--border` | `#e0e0e0` | Default 1px borders on cards, tables, inputs, dividers |
| `--text` | `#212121` | Primary body text |
| `--muted` | `#757575` | Secondary/label text, subtitles, placeholders |
| `--muted2` | `#9e9e9e` | Tertiary text — IDs, faint labels, Low-priority bar |
| `--sidebar` | `230px` | Sidebar width (`#sidebar`) and `#main` left margin |
| `--hh` | `56px` | Header height (`#header`); also `#main` top padding |
| `--r` | `8px` | Standard border-radius for cards, buttons, modals, inputs |
| `--sh` | `0 2px 8px rgba(0,0,0,.1)` | Standard card/box shadow (`var(--sh)`) |

> WARNING — `--hover` is referenced by `.wl-row-wknd` (line 421) and `.wl-badge-none` (line 456) but is **never declared in `:root`**. Those rules resolve to an empty/initial value (no weekend tint, transparent badge). Treat as a latent bug, not a token.

**LG navy / crimson (newer task & work-log views):** Not in `:root`. Applied as inline styles in `src/app.js.html`:

| Colour | Hex | Where (app.js.html) |
|---|---|---|
| LG navy | `#2D3E51` | Search/select widget chips & checkboxes (lines ~536, 567-571), inline date input border (line 5276) |
| LG crimson | `#E64D3D` | Clear (×) buttons (line 540), overdue progress-bar fill + dot + text, High-priority bar colour in task timeline (lines 8794, 8808, 8831, 8833) |

The login screen uses a one-off gradient `linear-gradient(135deg,#1a237e 0%,#283593 50%,#1565c0 100%)` (`#login-screen`, line 37); the meeting-reminder popup hard-codes `#1a237e` (line 668).

### 1.2 Typography

- **Font family:** Montserrat, loaded from `fonts.googleapis.com` (`<link>` at `src/index.html` line 8). Weights requested in the URL: `300, 400, 500, 600, 700, 800` plus italic `400` (`ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400`). Applied via `body{font-family:'Montserrat',sans-serif}` (line 21).
- **Base font-size (fluid):** `body{font-size:clamp(13px,0.89vw + 9.6px,15px)}` (line 21) — scales 13px at a 375px viewport up to 15px at 768px+. Comment at line 19 documents this.
- **Representative sizes (selector → size):**

| Selector | Size / weight | Role |
|---|---|---|
| `.ph-left .ph-title` (line 119) | `20px / 700` | Page header title |
| `.modal-hd-title` (line 615) | `16px / 600` | Modal header title |
| `.stat-val` (line 146) | `30px / 700` | Big stat number |
| `.stat-label` (line 145) | `11px / 600`, uppercase, `.5px` tracking | Stat label |
| `.fg label` (line 629) | `11px / 700`, uppercase, `.5px` tracking | Form field label |
| `.nav-sec` (line 88) | `10px / 700`, uppercase, `1px` tracking | Sidebar section header |
| `.nav-item` (line 89) | `13px` | Sidebar nav item |
| `.btn` (line 124) | `13px / 600` | Button text |
| `.pill` (line 530) | `11px / 600` | Status pill |
| `.badge` (line 569) | `10px / 700` | Priority badge |
| `tbody td` (line 406) | `13px` | Table body cell |

### 1.3 Icons

The icon library is **Material Symbols Outlined** — loaded via `<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,300,0,0" rel="stylesheet"/>` at `src/index.html` line 9.

- **Base rule** (`src/index.html` line 93): `.material-symbols-outlined{font-variation-settings:'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 20;font-size:inherit;line-height:1;vertical-align:middle;user-select:none}`.
- **Usage convention:** a `<span>` carrying the class with the glyph name as text content, e.g. `<span class="material-symbols-outlined">inbox</span>` (see `emptyState()` in `src/app.js.html` line 13659, and dashboard placeholders at lines 1980-2008 using `notifications_none`, `groups`, `account_tree`, `leaderboard`). Sidebar nav icons render inside `.nav-icon` (line 92).
- ⚠ The dominant icon library is Material Symbols Outlined (cited above), and the source template's "Tabler Icons ti-*" assumption is **wrong** for the app as a whole. However, there are **~8 stray Tabler `ti ti-*` classes** in `src/app.js.html` (e.g. `ti-clock-hour-4`, `ti-calendar-off`, `ti-alert-triangle`, `ti-chevron-down`, `ti-arrow-right`, `ti-calendar-week`, `ti-sort-descending-2`). **No Tabler font/CDN `<link>` is loaded**, so these render as blank/broken glyphs — a latent bug, not a deliberate second icon set. They are individually flagged in §4, §6, and §12. (Separately, a couple of legacy loading placeholders use literal emoji such as `⏳` — `src/index.html` lines 3579, 3596 — rather than the icon font.)

### 1.4 Component Patterns

All class names below are verified against `src/index.html` unless otherwise noted.

#### Buttons (lines 124-135)
Base class `.btn` (inline-flex, `gap:6px`, `padding:8px 16px`, `radius var(--r)`, `13px/600`, `:hover{filter:brightness(.92)}`). Variants:

| Class | Style |
|---|---|
| `.btn-primary` | indigo `var(--p)` bg, white text |
| `.btn-accent` | teal `var(--accent)` bg, white text |
| `.btn-outline` | transparent bg, `var(--p)` text, `1.5px solid var(--p)` border |
| `.btn-danger` | `var(--danger)` bg, white text |
| `.btn-ghost` | transparent bg, `var(--muted)` text, `1px solid var(--border)` |
| `.btn-sm` | size modifier — `padding:5px 12px;font-size:12px` |
| `.btn-full` | layout modifier — `width:100%;justify-content:center` |

In-button spinners: `.btn-spinner` (white) / `.btn-spinner-dark` (indigo), both `12px`, `animation:spin .7s linear infinite` (`@keyframes spin` line 134).

#### Badges & Pills (lines 529-574)
- **Priority badges** — base `.badge` (`10px/700` pill): `.badge-critical` (red), `.badge-high` (amber), `.badge-medium` (blue `#1565c0`), `.badge-low` (grey). Generated by `badge(s)` in `src/app.js.html` line 13656 → `badge badge-{lowercased status}`.
- **Status pills** — base `.pill` (`11px/600`, `radius:12px`). Task/project statuses: `.pill-Yet-to-Start`, `.pill-Planning`, `.pill-WIP-0-25` / `-25-50` / `-50-75` / `-75-100` (with `.pill-Active-*` aliases), `.pill-Review`, `.pill-On-Hold`, `.pill-Cancelled`, `.pill-Done`/`.pill-Completed`, `.pill-none`. Legacy: `.pill-Implemented`, `.pill-Stuck`, `.pill-Shared`, `.pill-WIP` (lines 547-550).
- **Role pills** (lines 566-568): `.pill-Team-Member` (teal), `.pill-Super-Admin` (magenta), `.pill-Team-Captain`/`.pill-Team-Facilitator` (purple).
- **Leave pills** (lines 744-749): `.pill-Pending`, `.pill-Approved`, `.pill-Rejected`, `.pill-Annual-Leave`/`Sick`/`Casual`, `.pill-Maternity-Leave`/`Paternity`, `.pill-Unpaid-Leave`.
- **Attendance / work-log status badges** (lines 452-465): `.wl-status-badge` base + `.wl-badge-ok` (green), `.wl-badge-warn` (amber), `.wl-badge-danger` (red), `.wl-badge-none` (muted), `.wl-badge-tentative` (dashed indigo), `.wl-ot-badge` (overtime amber pill), `.tlm-tentative-badge`. WARNING — there is no generic `.pill-attendance` family; attendance status uses the `.wl-badge-*` set instead.

#### Cards
| Pattern | Class (line) | Notes |
|---|---|---|
| Stat card | `.stat-card` (144) | surface bg, `var(--sh)`, `border-top:3px solid var(--p)`; label `.stat-label`, value `.stat-val`, sub `.stat-sub` |
| Task card | `.task-card` (151) | left-border priority via `.p-Critical`/`.p-High`/`.p-Medium`/`.p-Low` (153-156); compact row variant `.tc-row` (169); sub-task variant `.task-card.tc-sub` (184) |
| Project card | `.proj-card` (198) | `border-top:3px solid var(--p2)`; sub variant `.proj-card-sub`; hierarchy group `.proj-group` / `.proj-group-hd`; mini sub-cards `.proj-sub-card` (223) |
| Member / team-log work card | `.tlm-card` (611) hover lift; team-log list entry `.tld-entry` (659) with `.tld-emp`/`.tld-team`/`.tld-hours`; registration card `.reg-card` (647) |
| Meeting card | `.meet-card` (796) / action card `.meet-action-card` (756) / template card `.meet-tpl-card` (764) |

#### Modal (lines 576-625)
Overlay `.modal-bg` — `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200` flex-centred with `padding:16px`. Container `.modal` — surface bg, `radius var(--r)`, `max-width:540px;max-height:92vh;overflow-y:auto`, `animation:slideUp .2s ease` (`@keyframes slideUp` line 613). Width modifiers: `.modal.modal-lg` (`max-width:760px`, line 579) and `.modal.modal-xl` (`max-width:96vw;width:96vw`, line 580). WARNING — the brief references `.modal` / `.modal-lg` / `.modal-xl`; these are correct. The internal structure uses `.modal-hd` (sticky header with `.modal-hd-title` + close button `.modal-x`, line 616), `.modal-bd` body (`padding:20px`, line 624), and `.modal-ft` footer (sticky, right-aligned, line 625) — NOT `.modal-header/body/footer`. Icon action buttons in headers use `.modal-icon-btn` (617) / `.modal-icon-btn-danger`.

#### Toast (lines 665-686 + `src/app.js.html` lines 13663-13669)
Container `#toasts` — `position:fixed;bottom:20px;right:20px;z-index:999`, vertical flex stack, `max-width:360px`. Each toast is `.toast` (`#323232` dark bg, white, `radius:8px`, `13px`, `animation:fadeUp .2s ease`). Type modifiers: `.toast.success` (`var(--ok)`), `.toast.error` (`var(--danger)`), `.toast.warn` (`var(--warn)`). `toast(msg, type)` creates the div, appends to `#toasts`, and **auto-removes after 3500 ms** via `setTimeout`. (Note: `toast()`'s type strings per CLAUDE.md are `'ok'`/`'error'`/`'info'`, but the styled CSS classes are `success`/`error`/`warn` — only matching type strings get coloured backgrounds; unmatched values fall back to the dark default.)

#### Loading / Spinner patterns
- **Ring spinners:** `@keyframes spin` (line 134) drives `.btn-spinner` / `.btn-spinner-dark` (132-133) and the login verifying ring (`.login-card.verifying .login-status::before`, line 43).
- **Skeleton loaders:** `.view-skeleton` container with `.sk-row` (44px) and `.sk-card` (90px) shimmer blocks animated by `@keyframes shimmer` (lines 137-140).
- **Inline placeholders:** loading states reuse `.empty-state` with a "Loading…" message (e.g. dashboard panels lines 1984/2008).

#### Empty-state pattern (CSS lines 948-950 + `emptyState()` helper)
`emptyState(title, sub)` in `src/app.js.html` (line 13658) returns:
`<div class="empty-state"><div class="ei material-symbols-outlined">inbox</div><p><strong>{title}</strong><br>{sub}</p></div>`.
CSS: `.empty-state{text-align:center;padding:40px 20px;color:var(--muted)}`, `.empty-state .ei{font-size:40px;color:var(--muted);opacity:.5}`, `.empty-state p{font-size:14px}`. Most call sites pass a different glyph by hand-writing the markup (e.g. `notifications_none`, `groups`, `account_tree`, `leaderboard`); the helper itself always uses the `inbox` glyph.

## Verification — Design System

- [ ] Open `src/index.html` and inspect lines 12-18 -> all 17 tokens (`--p`, `--p2`, `--p3`, `--accent`, `--danger`, `--warn`, `--ok`, `--bg`, `--surface`, `--border`, `--text`, `--muted`, `--muted2`, `--sidebar`, `--hh`, `--r`, `--sh`) are present with the hexes/values in the 1.1 table.
- [ ] Grep the stylesheet for `var(--hover)` -> appears on `.wl-row-wknd` / `.wl-badge-none` but `--hover:` is never declared, confirming the noted latent bug.
- [ ] Grep `src/app.js.html` for `#2D3E51` and `#E64D3D` -> 29 inline matches, none in `index.html`, confirming the navy/crimson accents are JS-inline only.
- [ ] View any page in the app and inspect the header `#header` -> background computes to `#1a237e` (`var(--p)`).
- [ ] Load the app and inspect `body` computed `font-family` -> resolves to Montserrat; resize the window from 375px to 1000px and watch `font-size` interpolate 13px → 15px.
- [ ] Inspect the `<head>` line 9 `<link>` -> requests `Material+Symbols+Outlined` (the dominant library). Grep `src/app.js.html` for `class="ti ti-` -> ~8 matches (stray Tabler classes); confirm NO Tabler font/CDN `<link>` is loaded in `index.html` -> those glyphs render blank (latent bug).
- [ ] Inspect any rendered icon `<span>` -> it carries `class="material-symbols-outlined"` with the glyph name as text content.
- [ ] Render a button with `.btn .btn-primary` -> indigo background, white text; hover -> `filter:brightness(.92)` darkens it.
- [ ] Open any modal -> outer element is `.modal-bg` (dimmed overlay), inner is `.modal` with `.modal-hd` / `.modal-bd` / `.modal-ft`; wide modals add `.modal-lg` or `.modal-xl`.
- [ ] Trigger `toast('Saved','success')` -> a green `.toast` appears bottom-right inside `#toasts` and disappears after ~3.5 s.
- [ ] Navigate to a list view with no data -> the `emptyState()` output renders a centred `.empty-state` block with the 40px `inbox` Material Symbol and the title/sub text.
- [ ] Inspect a status pill -> class is `.pill .pill-{Status}` (e.g. `.pill-Done`); a priority badge -> `.badge .badge-{level}` (e.g. `.badge-critical`).


---

## 2. Application Shell

The shell is rendered once inside `<div id="app">` (hidden until login; `#app.visible{display:block}`). It comprises a fixed top bar (`<header id="header">`), a fixed sidebar (`<nav id="sidebar">`), a mobile backdrop (`<div id="sidebar-overlay">`), and the main content region (`<div id="main">`) that hosts all `.view` panels. Icons are **Material Symbols Outlined** (`<span class="material-symbols-outlined">`), the body/UI font is **Montserrat**, and the core theme is indigo (`--p:#1a237e`) with teal accent (`--accent:#00897b`). The header sits at `--hh:56px`; the sidebar is `--sidebar:230px` wide on desktop.

### 2.1 Top Navigation Bar

`<header id="header">` (`position:fixed;top:0;left:0;right:0;height:var(--hh);background:var(--p)`, z-index 100) holds, left to right:

| Element | HTML type + id/class | Notes |
|---|---|---|
| Mobile menu button | `<button id="mob-menu-btn" onclick="openMobNav()">` containing `<span class="material-symbols-outlined">menu</span>` | Hidden on mobile by `_mobileInit()` (replaced by the fixed `#mob-hamburger`); visible on desktop in markup. `aria-label="Open navigation"`. |
| Logo | `<div class="h-logo">` with `<span class="material-symbols-outlined">task_alt</span>` + `<span class="mob-hide-text">LG Desk</span>` | `.h-logo` = `font-size:16px;font-weight:700;color:#fff`. Text label hides on small phones (`.h-logo .mob-hide-text{display:none}` at the 375px breakpoint). |
| Spacer | `<div class="h-spacer">` (`flex:1`) | Pushes the rest to the right. |
| Refresh button | `<button id="global-refresh-btn" onclick="globalRefresh()" title="Refresh">` containing `<span class="material-symbols-outlined" id="global-refresh-icon">refresh</span>` + `<span class="mob-hide-text">Refresh</span>` | Translucent white pill; brightens on hover via inline `onmouseover`/`onmouseout`. During refresh the icon spins via `style.animation='spin 0.8s linear infinite'` (`@keyframes spin{to{transform:rotate(360deg)}}`) and the button is disabled. See 2.3. |
| User chip | `<div id="user-chip">` (`display:flex;...;background:rgba(255,255,255,.12);border-radius:20px`) | Container for the avatar, name, role badge, presence dot. `cursor:default`. |
| Avatar | `<div id="hd-avatar">` | 28x28 round, `background:var(--accent)`. Filled at login with the first letter of the user's name (`el('hd-avatar').textContent = u.name.charAt(0).toUpperCase()`). |
| User name | `<span id="hd-name">` | Set to `u.name`. Hidden on mobile (`#hd-name,.role-badge{display:none}` in the 768px media block and IIFE bypass). |
| Role badge | `<span class="role-badge" id="hd-role">` | Set to `u.role`. `.role-badge` = `font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(255,255,255,.2)`. Hidden on mobile alongside `#hd-name`. |

**Presence indicator + profile menu** live inside `<div id="hd-status-wrap" onclick="togglePresMenu(event)" title="Set your status">`:

- Status dot: `<div id="hd-status-dot" class="pres-dot pres-offline">` (starts offline). Colours: `.pres-online{background:#43a047}`, `.pres-away{background:#fb8c00}`, `.pres-dnd{background:#e53935}`, `.pres-offline{background:#9e9e9e}`.
- Dropdown menu: `<div id="pres-menu" class="pres-menu hidden">` (`position:absolute;top:calc(100% + 10px);right:0`, z-index 400). Toggled by `togglePresMenu(e)`, which flips the `hidden` class and registers a one-shot document-click listener to close it. Contents:
  - Label `<div class="pres-menu-label">Set Status</div>`
  - Four status items: `#pmi-online` (`setPresStatus('online')`), `#pmi-away`, `#pmi-dnd`, `#pmi-offline` — each a `.pres-menu-item` with its own coloured `.pres-dot`. `setPresStatus(status)` updates `PRES_MY_STATUS`, pings the server (`_presPing`), repaints the header dot and directory cards, and closes the menu.
  - A divider, then **My Profile** (`<div class="pres-menu-item" onclick="openProfileModal()">` with `manage_accounts` icon) and **Sign Out** (`<div class="pres-menu-item" onclick="logout()" style="color:var(--danger)">` with `logout` icon).

> ⚠ Note: the "profile menu" is implemented as the **lower portion of the presence menu** (`#pres-menu`), not a separate dropdown. There is no standalone profile-menu element id.

### 2.2 Sidebar Navigation

`<nav id="sidebar">` (`width:var(--sidebar);background:var(--surface);position:fixed;top:var(--hh);bottom:0;overflow-y:auto`, z-index 90). Inside it: `<div id="nav-main">` holds the static nav, and `<div id="nav-chats-wrap">` holds the async-loaded Chats section.

Each item is `<div class="nav-item" data-view="…" onclick="navigate('…')">` with `<span class="nav-icon"><span class="material-symbols-outlined">ICON</span></span>` then the label. Section headers are `<div class="nav-sec">` (uppercase, letter-spaced). External chat links are `<a class="nav-item-ext">` with a trailing `.nav-ext-arrow` (`open_in_new`).

**Active-state CSS class:** `.nav-item.active` — `background:var(--p3);border-left-color:var(--p);color:var(--p);font-weight:600` (`--p3:#e8eaf6`). `navigate()` toggles this class so exactly the item whose `data-view` matches the current view is highlighted (see 2.3). The Dashboard item ships with `class="nav-item active"` as the default.

**Role gating:** `.nav-mgr-only` items are revealed by `onPayloadLoaded` for roles in `['Super Admin','Admin','Team Captain','Team Facilitator']`; `.nav-admin-only` for `['Super Admin','Admin']`. Both start with the `hidden` class and have it removed via `classList.remove('hidden')`. There is no `.nav-admin-only` item *in the sidebar itself* (it is used on the dashboard "Post" / Forms buttons); all role-gated sidebar items use `.nav-mgr-only`.

#### MY SPACE (`<div class="nav-sec">My Space</div>` — always visible)

| data-view | Label | Material Symbol | Roles |
|---|---|---|---|
| `dashboard` | Dashboard | `home` | All |
| `plan-week` | Plan My Week | `calendar_view_week` | All |
| `my-tasks` | My Tasks | `task_alt` | All (badge `#badge-my-tasks`) |
| `my-projects` | My Projects | `folder_open` | All |
| `work-log` | Work Log | `edit_note` | All |
| `calendar` | Calendar | `calendar_month` | All |
| `meetings` | Meetings | `video_call` | All (badge `#badge-meetings`) |
| `org-chart` | Org Chart | `account_tree` | All |
| `my-leaves` | My Leaves | `event_available` | All |
| `directory` | Directory | `contacts` | All |

#### TEAM (`<div class="nav-sec nav-mgr-only hidden">Team</div>` — managers only)

| data-view | Label | Material Symbol | Gating |
|---|---|---|---|
| `team-tasks` | Team Tasks | `checklist_rtl` | `.nav-mgr-only` |
| `team-projects` | Team Projects | `folder_special` | `.nav-mgr-only` |
| `team-logs` | Team Work Logs | `monitoring` | `.nav-mgr-only` |
| `mis-report` | MIS Report | `assessment` | `id="nav-mis-report"`, plain `nav-item hidden` — revealed **only** when `u.hasMisAccess` is true (permission via the `MIS_Access` sheet, not a role) |
| `leave-approvals` | Leave Approvals | `pending_actions` | `.nav-mgr-only` (badge `#badge-leave-approvals`) |
| `team-mgmt` | Team Members | `groups` | `.nav-mgr-only` (badge `#badge-ddr` for due-date-change requests) |

> ⚠ The sidebar label reads **"Team Members"** with `data-view="team-mgmt"` (the view itself is the Team Management page). The icon is `groups`.

#### COMPANY (`<div class="nav-sec nav-mgr-only hidden">Company</div>` — managers only)

| data-view | Label | Material Symbol | Gating |
|---|---|---|---|
| `all-tasks` | All Tasks | `table_rows` | `.nav-mgr-only` |
| `all-projects` | All Projects | `account_tree` | `.nav-mgr-only` |
| `org-page` | Organisation | `corporate_fare` | `.nav-mgr-only` |
| `forms` | Forms | `description` | `.nav-mgr-only` |

**Import Tasks** is a special button, not a view: `<div class="nav-item hidden" id="nav-import-btn" onclick="openMigrateModal()">` with icon `upload_file`. It starts hidden and is revealed for **all logged-in users** (`onPayloadLoaded` removes `hidden` unconditionally — the inline comment reads "Import Tasks nav visible to all logged-in users"). It opens the migration modal rather than calling `navigate()`.

#### CHATS (`<div id="nav-chats-wrap">` — async, populated by `_navPopulateTeamChats()`)

- Section header `<div class="nav-sec hidden" id="nav-tc-sec">Chats</div>` and list container `<div id="nav-tc-list"></div>`. Loaded after login via `_loadNavTeamChats()` and on OAuth/space events.
- Space links (when available) are `<a class="nav-item-ext" target="_blank">`: the user's own team space (`<team> Chat`, icon `group`) and "General Chat" (icon `forum`), each ending in an `open_in_new` arrow.
- For **non-admins with no spaces**, the whole section is hidden (`sec.classList.add('hidden')`).
- For **admins** (`_isAdmin(u.role)`), an admin control block is appended:
  - If Google Chat is not connected (`!DIR_CHAT_CONNECTED`): `<button id="btn-connect-chat" onclick="connectChat()">` labelled **"Connect Google Chat"** (icon `add_link`). Per-user OAuth2 flow.
  - Once connected: `<button id="btn-sync-chat" onclick="syncChat()">` labelled **"Sync Spaces"** (icon `sync`).

### 2.3 Global Behaviours

**Refresh (no page reload):** `globalRefresh()` (`app.js.html`) disables `#global-refresh-btn`, spins `#global-refresh-icon`, then calls `getInitialPayload(APP.currentUser.email)`. On success it overwrites `APP.tasks/projects/employees/functions/_pendingLeaveCount`, re-runs `populateSelects()`, `updateBadges()`, `updateLeaveBadge()`, then re-renders the **current** view: `work-log`→`loadMyWorkLogs()`, `team-logs`→`loadTeamLogs()`, `leaves`→`loadMyLeaves()`, `calendar`→`loadCalendar()`, `meetings`→`loadMeetings()`, all others→`navigate(v)`. It clears the spin and shows a `Refreshed` success toast; failure shows `Refresh failed: …`. The page is never reloaded.

**Navigation:** `navigate(view)` closes any open searchable dropdown and the mobile nav, tears down task-sheet scroll listeners, stops team-clock tickers when leaving the dashboard, cancels Work-Log debounces when leaving `work-log`, and (on mobile) redirects views in `_MOB_BLOCKED_VIEWS` to `dashboard`. It then removes `active` / adds `hidden` on all `.view` panels, activates `#view-{view}`, sets `.nav-item.active` on the matching `data-view`, stores `APP.view`, and dispatches to the view's render/load function.

**Session expiry / re-login:** On `DOMContentLoaded` the app reads the `tm_sess` token (`_SESS_KEY`) from `localStorage`; junk values (`'null'`,`'undefined'`,empty) are cleared and the login form shows. If a token exists it calls `validateSession(saved)` and shows "Restoring session…". On success it stores `APP._sessToken = saved` and runs `onPayloadLoaded(r)` (no login screen). On `{ok:false}`:
- `reason === 'expired'` → removes the token and shows "Session expired. Please sign in again."
- `reason === 'not_found'` → removes the token, blank status.
- Any other reason (`'error'`, `'payload_error'`, no response) or a `withFailureHandler` network error → **keeps** the token (transient) and silently falls back to the login form.

`logout()` removes `tm_sess`, nulls `APP._sessToken`, fires `invalidateSession(token)`, and `location.reload()`s. A fresh login persists the token via `createSession` (saved to `localStorage`).

**Toasts:** `toast(msg, type)` creates a `<div class="toast …">` and appends it to `#toasts`, removing it after **3500 ms**. `#toasts` is `position:fixed;bottom:20px;right:20px;z-index:999;max-width:360px` (bottom-right; on mobile it becomes `left:10px;right:10px;bottom:14px`). Variants: `.toast.success{background:var(--ok)}`, `.toast.error{background:var(--danger)}`, `.toast.warn{background:var(--warn)}`; default is dark `#323232`. Entry animation `@keyframes fadeUp`.

> ⚠ Note: call sites pass type strings like `'ok'` / `'info'` in places (e.g. the Chat-connected toast), but the CSS only defines `.success`, `.error`, and `.warn`. An `'ok'` / `'info'` toast therefore renders with the default dark background (no coloured styling). This is a real mismatch in the code.

**Keyboard shortcuts:** **None found** at the application/shell level. All `keydown` handlers in `app.js.html` are scoped to specific inputs (Enter to add Work-Log chips, Enter to apply hours, Enter/Space to activate searchable-dropdown options); there is no global document-level shortcut for navigation, refresh, or search.

## Verification — Shell

- [ ] Load the app while logged out (no `tm_sess` in localStorage) -> login screen shows, no "Restoring session…" text.
- [ ] Reload with a valid `tm_sess` token -> "Restoring session…" appears briefly, then the dashboard loads with no login screen.
- [ ] Manually corrupt/expire the session (or let TTL lapse) and reload -> token removed and status reads "Session expired. Please sign in again." (for `expired`).
- [ ] Click the header **Refresh** button (`#global-refresh-btn`) -> `#global-refresh-icon` spins, button disables, a "Refreshed" toast appears, and the page does NOT reload.
- [ ] Click the presence dot (`#hd-status-wrap`) -> `#pres-menu` opens showing 4 status options + My Profile + Sign Out; clicking elsewhere closes it.
- [ ] Choose each status (online/away/dnd/offline) -> `#hd-status-dot` colour changes to green/orange/red/grey respectively.
- [ ] Click **My Profile** in the menu -> profile modal opens (`openProfileModal()`); click **Sign Out** -> token cleared and page reloads to login.
- [ ] Navigate between views -> exactly one `.nav-item` carries `.active` (indigo `--p3` background + left border) matching the open view.
- [ ] Log in as **Team Member** -> only MY SPACE items visible; TEAM / COMPANY sections and `.nav-mgr-only` items hidden; "Import Tasks" still visible.
- [ ] Log in as **Team Captain / Team Facilitator** -> TEAM + COMPANY sections and all `.nav-mgr-only` items appear.
- [ ] Log in as **Admin / Super Admin** -> same as managers, plus any `.nav-admin-only` controls (dashboard Post / Forms) appear.
- [ ] Log in as a user WITH `MIS_Access` -> "MIS Report" (`#nav-mis-report`) appears; a user WITHOUT it -> item stays hidden even if they are a manager.
- [ ] As an admin with Chat not yet connected -> sidebar Chats section shows "Connect Google Chat" (`#btn-connect-chat`); after connecting -> it switches to "Sync Spaces" (`#btn-sync-chat`).
- [ ] As a non-admin with no chat spaces -> the Chats section (`#nav-tc-sec`) stays hidden.
- [ ] Trigger any `toast(...)` (e.g. refresh) -> toast appears bottom-right inside `#toasts` and auto-dismisses after ~3.5 s.
- [ ] Try common keyboard shortcuts (e.g. Ctrl+K, /, g+h) anywhere -> nothing happens (no global shortcuts exist).


---

## 3. Authentication

The authentication UI lives entirely in the full-screen login card (`<div id="login-screen">`, a fixed overlay with `z-index:9999` and an indigo gradient background `linear-gradient(135deg,#1a237e 0%,#283593 50%,#1565c0 100%)`). Inside it, `<div class="login-card" id="login-card">` shows the logo glyph `<span class="material-symbols-outlined">task_alt</span>`, the app name "LG Desk", a tagline, a status line (`#login-status`), and an error line (`#login-error`). The card contains four mutually exclusive panels: the sign-in form (`#login-form-wrap`), the forgot-password panel (`#forgot-pw-wrap`), the verified-account card (`#login-user-card` + `#btn-enter`), and a footer "Register" link (`<a onclick="openRegisterModal()">`).

Icons on the auth screens are Material Symbols Outlined (`<span class="material-symbols-outlined">…</span>`). (A handful of stray Tabler `ti ti-*` classes exist elsewhere in `app.js.html` with no Tabler font loaded — see §1.3 — but none appear on the auth screens.) The password hash scheme is `SHA-256(password + 'tms_2025')` via `hashPassword()` in `auth.gs` — legacy, not Argon2.

### 3.1 Login

**Fields.** The sign-in form (`#login-form-wrap`) contains:

| Element | Type / id | Notes |
|---|---|---|
| Email | `<input type="email" id="login-email">` | placeholder `you@company.com`; Enter moves focus to password (`onkeydown="…el('login-password').focus()"`) |
| Password | `<input type="password" id="login-password">` | wrapped in `.pw-wrap`; Enter triggers `login()` |
| Show/hide password | `<button class="pw-eye" onclick="togglePw('login-password',this)">` | toggles the field, swaps the `visibility` Material Symbol |
| Submit | `<button id="btn-login" onclick="login()">Sign In →</button>` | full-width primary button |
| Forgot link | `<a onclick="showForgotPw()">Forgot password?</a>` | bottom-right of the form |

**Client validation.** `login()` (`app.js.html`, ~L744) trims the email, reads the password, and if either is empty calls `showLoginError('Enter your email and password.')` and returns. During the request the button is disabled and relabelled "Signing in...".

**Server verification.** `login()` calls `loginWithPassword(email, password)` (`auth.gs`, L526). The backend lowercases the email, finds the matching `Employees` row where `Is_Active === 'TRUE'`, and returns specific errors: "Account not registered…" (no active row), "Your account has no password set…" (empty `Password_Hash`), or "Incorrect password…" (hash mismatch). On success it **creates a 7-day session token inline** (`Utilities.getUuid()`, stored in ScriptProperties as `sess_<token>` with `expires = now + _SESS_TTL_MS` where `_SESS_TTL_MS = 7*24*60*60*1000`) and returns `{ ok, token, name, email, role, designation, team, sub_department, empId }`.

**Two-step entry.** On a successful response the frontend does **not** jump straight to the dashboard. It saves `r.token` to `APP._sessToken` and `localStorage` under key `tm_sess` (`_SESS_KEY = 'tm_sess'`), then populates the verified-account card (`#login-user-card`): avatar initial (`#luc-avatar`), name (`#luc-name`), email (`#luc-email`), role badge (`#luc-role`), team (`#luc-team`), and optional designation (`#luc-designation`). It hides `#login-form-wrap`, sets the status to "Account verified. Click below to continue.", and reveals `<button id="btn-enter" onclick="enterDashboard()">Enter Dashboard →</button>`. The actual data load happens when the user clicks Enter Dashboard.

**Auto-login (silent session restore).** On `DOMContentLoaded` (`app.js.html`, ~L148) the app reads `localStorage.getItem('tm_sess')`. If the value is absent, empty, or the strings `'null'`/`'undefined'`, it is removed and the login form shows cleanly. Otherwise the status shows "Restoring session…", the form is dimmed (`opacity:0.4`), and `validateSession(token)` is called (`auth.gs`, L1871). `validateSession` rejects garbage tokens, checks `sess_<token>` in ScriptProperties, expires it if past TTL, otherwise **slides the expiry** (`expires = now + _SESS_TTL_MS`) and returns the full `getInitialPayload` result merged with `{ ok: true }`. Token-clearing rules in the success handler:

- `reason: 'expired'` -> remove token, show "Session expired. Please sign in again."
- `reason: 'not_found'` -> remove token, blank status.
- `reason: 'error'` / `'payload_error'` / no response -> **keep** token, blank status, fall back to login form silently (transient GAS error).
- A network/script failure (`withFailureHandler`) -> keep token, restore form silently.

On full success it calls `onPayloadLoaded(r)` (goes straight into the app, no Enter-Dashboard step). Logout removes `tm_sess` from localStorage and calls `invalidateSession(token)` to delete the ScriptProperties entry.

**Forgot-password flow (15-minute OTP).** `showForgotPw()` hides `#login-form-wrap`, shows `#forgot-pw-wrap`, sets status "Reset your password", and pre-fills `#fp-email` from `#login-email` if typed. The panel is two steps:

- **Step 1 (`#fp-step1`):** `<input type="email" id="fp-email">` + `<button id="btn-send-code" onclick="sendResetCode()">Send Reset Code</button>`. `sendResetCode()` requires a non-empty email, then calls backend `requestPasswordReset(email)` (`auth.gs`, L287). The backend finds the active employee, generates a 6-digit OTP (`Math.floor(100000 + random*900000)`), stores `pw_otp_<email>` in ScriptProperties with **`expires = now + 15*60*1000` (15 minutes)**, and emails it via `GmailApp.sendEmail` (subject "Password Reset Code — LG Desk"). On success the UI reveals Step 2 and focuses the OTP field.
- **Step 2 (`#fp-step2`):** `<input type="text" id="fp-otp" maxlength="6">` (letter-spaced 6-digit code), `<input type="password" id="fp-newpw">`, `<input type="password" id="fp-confirmpw">`, each with a `.pw-eye` toggle, plus `<button id="btn-reset-pw" onclick="resetPasswordSubmit()">Reset Password</button>` and a "Resend code" link (re-calls `sendResetCode()`). `resetPasswordSubmit()` validates: OTP present, new password present, length >= 6, and new == confirm. It calls `resetPasswordWithOTP(email, otp, newPassword)` (`auth.gs`, L321), which re-reads `pw_otp_<email>`, rejects if missing ("No reset code found…"), expired ("Reset code expired…", and deletes it), or mismatched ("Invalid reset code…"). On success it updates `Password_Hash`, deletes the OTP property, writes a `PASSWORD_RESET` audit row, and the UI returns to the sign-in form with status "Password reset! Please sign in." and the email pre-filled.

A "← Back to Sign In" link (`onclick="hideForgotPw()"`) resets both steps and clears the OTP/password fields.

### 3.2 Registration — Request Access

Opened from the login footer link `New here? <a onclick="openRegisterModal()">Register →</a>`. The modal is `<div class="modal-bg hidden" id="register-modal">` titled "Request Access — Register". `openRegisterModal()` (`app.js.html`, ~L7723) populates the role dropdown from `ROLES = ['Super Admin','Admin','Team Captain','Team Facilitator','Team Member','Intern']` and the division dropdown from `Object.keys(TEAM_HIERARCHY)`, clears all fields, and shows the modal.

**Fields.**

| Element | Type / id | Required |
|---|---|---|
| First Name | `<input id="reg-fname">` | Yes |
| Last Name | `<input id="reg-lname">` | Yes |
| Work Email | `<input type="email" id="reg-email">` | Yes |
| Role | `<select id="reg-role" onchange="onRegRoleChange()">` | Yes |
| Password | `<input type="password" id="reg-password">` + `.pw-eye` | Yes (>= 6 chars) |
| Confirm Password | `<input type="password" id="reg-confirm">` + `.pw-eye` | Yes (must match) |
| Designation | `<input id="reg-designation" maxlength="100">` | Optional |
| Date of Birth | `<input type="date" id="reg-dob">` | Yes |
| Team Division | `<select id="reg-division" onchange="onRegDivisionChange()">` | Yes |
| Sub-department | `<select id="reg-subdept" onchange="onRegSubdeptChange()">` inside `#fg-reg-subdept` | If applicable |
| Manager's / Reports-to Email | `<input type="email" id="reg-manager-email">` with label `#lbl-reg-manager` and hint `#reg-manager-hint` | Yes except Super Admin |
| Message | `<textarea id="reg-message">` | Optional |
| Error banner | `<div id="reg-error">` | — |
| Submit | `<button id="btn-submit-reg" onclick="submitRegistration()">Submit Registration</button>` | — |

**Team Division -> Sub-Department cascade.** `onRegDivisionChange()` reads `#reg-division`, looks up `TEAM_HIERARCHY[div]` for the sub-department list, rebuilds `#reg-subdept` options, dims `#fg-reg-subdept` (`opacity` 0.4 when empty / 1 when populated), then calls `_regAutoFillManager()`. `onRegSubdeptChange()` simply re-runs `_regAutoFillManager()`.

**Manager-email behaviour by role.** `onRegRoleChange()` branches on `_REG_MANUAL_ROLES = ['Super Admin','Admin','Team Captain']`:

- **Super Admin / Admin / Team Captain** -> manual entry. Field is reset editable; label becomes "Reports-to Email" (Super Admin, optional) or "Reports-to Email *" (Admin/TC, required).
- **Team Member / Team Facilitator / Intern** -> auto-fill. Label "Manager's Email *"; `_regAutoFillManager()` runs.

**Manager auto-fill logic.** `_regAutoFillManager()` (only for TM/TF/Intern) sets the field read-only with hint "⏳ Fetching manager from database…", disables Submit, then calls backend `getTeamCaptainByTeam(team, subDept)` (`auth.gs`, L1525). The backend resolution order is:

1. **Sub-department Team Captain** — active employee with `Role === 'Team Captain'`, matching `Team` and `Sub_Department` (only attempted when a sub-dept is selected).
2. **Team-only Team Captain** — active TC matching `Team`.
3. **`LGD_DEFAULT_MANAGER_EMAIL` Script Property** — the configured fallback (paired with `LGD_DEFAULT_MANAGER_NAME`), set via `setDefaultManager()` in the GAS editor.
4. **Any active Super Admin.**
5. **Any active Admin.**
6. If none -> `{ ok:false, error: 'No Team Captain, Admin, or Super Admin found…' }`.

On a found manager the field is filled green-bordered/read-only with hint "✓ Auto-filled: \<name\> (Manager)" and Submit is re-enabled. On `{ok:false}` the field is blocked (red border, placeholder "No manager assigned for this team") and **Submit stays disabled** with the hint "No manager is assigned for this team yet. Please contact the admin." On a network/script failure the handler **fails open** — the field becomes manually editable and Submit is re-enabled.

**Submit -> pending state.** `submitRegistration()` (`app.js.html`, ~L7880) validates: first/last name, email, password (present + >= 6), passwords match, role, DOB, division, and manager email (required unless role is Super Admin). It posts a record to backend `submitRegistration(record)` (`auth.gs`, L1597), which hashes the raw password, rejects if the email already exists in `Employees` or already has a `Pending` row in `Registration_Requests`, then inserts a `Registration_Requests` row with `Status: 'Pending'`, a generated `Req_ID` (`generateId('Registration_Requests','REQ',5)`), and `Reviewed_By/Reviewed_At/Review_Notes` blank. The UI closes the modal and toasts "Registration submitted! Your manager will review your request." No account is created yet — the user cannot log in until an approver acts.

WARNING — Planned / Not yet implemented: `submitRegistration` does **not** send any email to the user or to the manager/admin. The request is silent until a manager happens to open the approval view.

### 3.3 Admin Approval Flow

Pending registrations surface as cards in two views:

- **Team Management view** (`#view-team-mgmt`) — mount point `<div id="team-pending-registrations">`, loaded by `_loadPendingRegs('team-pending-registrations', true)` (`myOnly = true`).
- **Organisation view** (`#view-org-page`, admin-only) — mount point `<div id="org-pending-registrations">`, loaded by `_loadPendingRegs('org-pending-registrations', false)` (`myOnly = false`).

`_loadPendingRegs(elId, myOnly)` (`app.js.html`, ~L6108) calls backend `getRegistrationRequests(email, myOnly)` (`auth.gs`, L1659) and renders results via `_renderRegCards()` (or empty string if none). Server-side scoping in `getRegistrationRequests`:

| Caller role | `myOnly` | Result |
|---|---|---|
| Non-manager (`!_isManager`) | any | `[]` (nothing) |
| Admin / Super Admin (`_isAdmin`) | `false` | All pending requests |
| TC / TF (managers) | `true` | Requests where `Manager_Email === me` OR `Team === my team` |

**Card UI.** `_renderRegCards(reqs)` produces a `<div class="pending-reg-section">` with an `<h3>` count header and one `<div class="reg-card">` per request, showing name (`.reg-card-name`), email (`.reg-card-email`), a role pill, a meta row (designation / team / manager email / requested date), the optional message (`.reg-card-msg`), and two action buttons in `.reg-card-actions`:

- `<button class="btn btn-sm btn-accent" onclick="approveReg(this,'<Req_ID>')">Approve</button>`
- `<button class="btn btn-sm btn-danger" onclick="rejectReg(this,'<Req_ID>')">Reject</button>`

**Approve.** `approveReg()` (`app.js.html`, ~L6418) shows a `confirm()` dialog, then calls `approveRegistration(reqId, email)` (`auth.gs`, L1683). The backend requires `_isManager`; non-admins must additionally be the designated manager (`Manager_Email === me`) or a same-team manager. It resolves the manager's `Emp_ID`, generates `EMP-###`, inserts an active `Employees` row (copying name/email/role/designation/team/sub-dept/password-hash/DOB), invalidates the org-tree cache, attempts to add the user to the team Chat space (`_tryAddToTeamSpace`, wrapped in try/catch), flips the request `Status` to `Approved` (recording `Reviewed_By`/`Reviewed_At`), and writes an `APPROVE_REG` audit row. The UI toasts "Registration approved! Employee ID: \<empId\>" and re-renders the current view.

**Reject.** `rejectReg()` (`app.js.html`, ~L6474) uses a `prompt()` for optional notes, then calls `rejectRegistration(reqId, email, notes)` (`auth.gs`, L1743). Same authorization gate as approve; it sets `Status: 'Rejected'` with `Review_Notes` and writes a `REJECT_REG` audit row. The UI toasts "Registration rejected."

**Email notification on approval/rejection.** WARNING — Planned / Not yet implemented: neither `approveRegistration` nor `rejectRegistration` sends any email. The only `GmailApp.sendEmail` call in `auth.gs` is in `requestPasswordReset` (the OTP). An approved user only learns of access by trying to log in; a rejected user is not notified at all. The approval side effect that does fire is the best-effort Chat-space add (`_tryAddToTeamSpace`).

## Verification — Auth

- [ ] Load the app with no `tm_sess` in localStorage -> the login form (`#login-form-wrap`) shows with status "Sign in with your registered work email"; no "Restoring session…" flash.
- [ ] Submit the login form with an empty email or password -> inline error "Enter your email and password." appears in `#login-error`; no server call.
- [ ] Sign in with a correct email/password -> `#login-form-wrap` hides, `#login-user-card` populates (name/email/role/team), status reads "Account verified…", and `#btn-enter` ("Enter Dashboard →") appears; `localStorage.tm_sess` is now set.
- [ ] Click "Enter Dashboard →" -> the dashboard loads (data fetch happens here, not at sign-in).
- [ ] Sign in with a wrong password -> error "Incorrect password. Please try again."; with an unregistered email -> "Account not registered…".
- [ ] Reload the page while `tm_sess` is valid -> status shows "Restoring session…", form dims, and the app opens directly into the dashboard without re-entering credentials.
- [ ] Manually corrupt `tm_sess` to `null`/empty and reload -> token is cleared and the clean login form shows (no error toast).
- [ ] Let a session pass its 7-day TTL (or delete its `sess_*` Script Property) and reload -> for an expired token status reads "Session expired. Please sign in again." and the token is removed; for an unknown token the form shows silently.
- [ ] Log out -> `tm_sess` is removed from localStorage and the `sess_*` Script Property is deleted.
- [ ] Click "Forgot password?" -> `#forgot-pw-wrap` Step 1 shows; `#fp-email` is pre-filled if an email was already typed.
- [ ] Send a reset code for an active account -> a 6-digit OTP email arrives (subject "Password Reset Code — LG Desk"); Step 2 (`#fp-step2`) appears and focuses `#fp-otp`.
- [ ] Submit Step 2 with mismatched passwords -> "Passwords do not match."; with a < 6-char password -> "Password must be at least 6 characters."
- [ ] Submit with a wrong OTP -> "Invalid reset code…"; with an OTP older than 15 minutes -> "Reset code expired. Please request a new one."
- [ ] Complete a valid reset -> returns to sign-in with status "Password reset! Please sign in.", `#login-email` pre-filled; the new password then logs in successfully.
- [ ] Open Register, pick a Team Division -> `#reg-subdept` repopulates from `TEAM_HIERARCHY` and the sub-dept group un-dims only when sub-depts exist.
- [ ] Set role to Team Member/Team Facilitator/Intern with a team that has a Team Captain -> `#reg-manager-email` auto-fills read-only/green with "✓ Auto-filled: \<name\> (Manager)" and Submit enables.
- [ ] Pick a team with no TC and no fallback manager -> `#reg-manager-email` shows red "No manager assigned for this team" and Submit stays disabled.
- [ ] Set role to Admin or Team Captain -> the manager field becomes manually editable with label "Reports-to Email *"; for Super Admin the label/email is optional.
- [ ] Submit a valid registration -> the modal closes, a toast "Registration submitted! Your manager will review your request." shows, and a `Pending` row appears in `Registration_Requests`; the user still cannot log in.
- [ ] Submit a registration with an email that already has an account or pending request -> "An account with this email already exists." / "A registration request for this email is already pending."
- [ ] As an Admin/Super Admin, open the Organisation view -> all pending requests render as `.reg-card` items in `#org-pending-registrations`.
- [ ] As a TC/TF, open Team Management -> only requests where you are the designated manager or in your team render in `#team-pending-registrations`.
- [ ] Click Approve on a card and confirm -> a toast "Registration approved! Employee ID: EMP-###" shows, an active `Employees` row is created, the request flips to `Approved`, and the approved user can now log in (confirm NO email is sent — notification is not implemented).
- [ ] Click Reject, enter/skip a note -> toast "Registration rejected.", request flips to `Rejected` with notes recorded (confirm NO rejection email is sent).


---

## 4. My Space — Work Log

The Work Log view is the `<div class="view hidden" id="view-work-log">` (in `index.html`). Its header (`<div class="ph">`) shows the title "Work Log", a sub-label `<div class="ph-sub" id="wl-week-sub">`, the Week/Month mode tabs, a navigation cluster, a **Weekly Summary** button, and a refresh button (`<button …onclick="loadMyWorkLogs()">↻</button>`). The week grid renders into `<div id="my-work-log-history">`.

The entire grid is built client-side by `renderWeekLog()` in `app.js.html`. Data is fetched by `loadMyWorkLogs()` which calls either `getMyWorkLogs` (regular employees) or `getInternWorkLogs` (interns) — the role switch is `APP.currentUser.role === 'Intern' ? 'getInternWorkLogs' : 'getMyWorkLogs'`. Loading is two-phase: Phase 1 fetches the work-log rows and renders immediately; Phase 2 (`_wlLoadMeetingsAsync`) fetches calendar meetings in the background and patches in meeting chips + auto-hours; Phase 3 (`_wlLoadDurationsAsync`) patches in actual clocked work durations. Icons throughout are **Material Symbols Outlined** (`<span class="material-symbols-outlined">…</span>`), e.g. `summarize` on the Weekly Summary button.

> ⚠ Mismatch to flag: the per-row "Work duration" chip rendered by `_wlDurHtml` uses `<i class="ti ti-clock-hour-4">` — a **Tabler icon** class, inconsistent with the Material Symbols used everywhere else in this view. The clock icon will not render unless a Tabler font is also loaded.

### 4.1 View Modes

Two mode tabs sit in `<div class="tl-tabs">`:

| Element | id | Action |
|---|---|---|
| Week tab | `wl-mode-week` (class `tl-tab active` by default) | `onclick="setWLMode('week')"` |
| Month tab | `wl-mode-month` (class `tl-tab`) | `onclick="setWLMode('month')"` |

`setWLMode(mode)` sets the module-level `WL_MODE` (`'week'` | `'month'`), toggles the `active` class on the two tab buttons, then calls `loadMyWorkLogs()`. Module default is `var WL_MODE = 'week'`.

Navigation cluster `<div class="wl-nav">`:
- `<button class="tl-nav-btn" onclick="wlNav(-1)">‹</button>` — previous week/month
- `<button …onclick="wlNavToday()">Today</button>`
- `<span class="wl-week-label" id="wl-week-label">` — current range label (also mirrored into `id="wl-week-sub"`)
- `<button class="tl-nav-btn" onclick="wlNav(1)">›</button>` — next

`wlNav(delta)` first calls `_wlCommitAllTextareas()` (commits any typed-but-uncommitted notes and fire-and-forget saves dirty rows), shifts `WL_ANCHOR` by `delta` months (month mode) or `delta*7` days (week mode), then either re-fetches (`loadMyWorkLogs()` when outside the loaded range, per `_wlNeedsReload()`) or re-renders from cached `WL_DATA`. The loaded range is a ±8-week window (`_wlDateRange()`), so navigating within that window is instant with no server round-trip.

### 4.2 Week View Table

`renderWeekLog()` emits one `<table class="wl-week-table">` inside `<div class="wl-week-wrap">`. The `<thead>` has exactly these eight column headers plus an unlabeled save column:

| # | Header text | `<th>` class |
|---|---|---|
| 1 | Day | `wl-day-cell` |
| 2 | Attendance | `wl-att-cell` |
| 3 | Work Update — 1st Half | `wl-h1-cell` |
| 4 | Work Update — 2nd Half | `wl-h2-cell` |
| 5 | Extra Hrs | `wl-extra-cell` |
| 6 | Remark | `wl-remark-cell` |
| 7 | Status | `wl-status-cell` |
| 8 | Comments | `wl-comments-cell` |
| 9 | (empty save column) | `wl-save-cell` |

Each body row is `<tr class="wl-row …" id="wl-tr-{iso}">` (iso = `YYYY-MM-DD`). Row modifier classes are added conditionally: `wl-row-today`, `wl-row-wknd`, `wl-row-off`, `wl-row-leave`, `wl-row-future`.

Per-column cell contents:

- **Day** (`<td class="wl-day-cell">`): `<div class="wl-day-name">` shows e.g. "Mon 23"; a `<div class="wl-day-today-badge">Today</div>` appears for today; `<div class="wl-future-lbl">Upcoming</div>` appears for locked future dates; and the `+OT` badge `<span id="wl-ot-badge-{iso}" class="wl-ot-badge">+OT</span>` lives here.
- **Attendance** (`<td class="wl-att-cell">`): the attendance input (`<select>` for regular employees, `<input type="text">` for interns — see 4.3), plus the inline **Hrs** calculator `<div class="wl-hc-wrap">` containing `<input type="number" class="wl-hc-inp" id="wl-hc-{iso}">` (min 0, max 16, step 0.5) with a live preview span `id="wl-hc-pre-{iso}"`, plus the off-day "Worked today" toggle `<div id="wl-odt-{iso}" class="wl-offday-toggle">` (hidden unless attendance is an off-type) with checkbox `id="wl-odc-{iso}"`.
- **Work Update 1st/2nd Half** (`<td class="wl-h1-cell">` / `wl-h2-cell`): each is dual-purpose — a work builder div `id="wl-h1-work-{iso}"` (built by `_wlBuildCell`, see 4.4) and a leave sub-control div `id="wl-h1-leave-{iso}"` (Leave Type `<select id="wl-lt-{iso}">` in the 1st half; Leave-Requested timing `<select id="wl-lr-{iso}">` in the 2nd half). Visibility flips based on attendance: full-day leave hides work and shows leave; half-day leave shows both; off-day with no logged work hides both.
- **Extra Hrs** (`<td class="wl-extra-cell">`): `<input type="number" class="wl-inp wl-hrs-inp" id="wl-eh-{iso}">` (min 0, max 12, step 0.5). On input it calls `wlMarkDirty` + `_wlUpdateOtBadge`; on blur it calls `_wlOnBlur`.
- **Remark** (`<td class="wl-remark-cell">`): `<input type="text" class="wl-inp" id="wl-rm-{iso}">` placeholder "Remark…".
- **Status** (`<td class="wl-status-cell">`): for managers (`_canEditWlStatus(role)` true = Super Admin / Admin / Team Captain / Team Facilitator) it is an editable `<select class="wl-inp wl-status-sel" id="wl-st-{iso}" onchange="_wlSaveStatus(this)">` with options from `WL_STATUS_OPTIONS` (`''`, Tentative, On Time, Late, Absent, Half Day); for everyone else it is a read-only `<span class="wl-status-badge …">` (badge class `wl-badge-ok` / `wl-badge-warn` / `wl-badge-danger` / `wl-badge-tentative` / `wl-badge-none`).
- **Comments** (`<td class="wl-comments-cell">`): for managers an editable `<input class="wl-inp wl-admin-inp" id="wl-ac-{iso}" onchange="_wlSaveComment(this)">`; for others a read-only `<span class="wl-admin-note">`. This cell also appends the "Work duration" chip (`_wlDurHtml`, see 4.6).
- **Save** (`<td class="wl-save-cell">`): a `<button class="wl-save-btn …" id="wl-save-btn-{iso}" onclick="saveWeekEntry('{iso}')">` whose icon reflects state (`sync` while saving, `save` when dirty, `check` when saved, `—` when empty), and the auto-save status span `<span id="wl-as-{iso}">`. Interns do **not** get a save button (auto-save only).

Future dates are locked for non-managers: `var isFuture = !isAdmin && iso > today` adds `wl-row-future` and disables the attendance/Hrs inputs.

### 4.3 Attendance Dropdown

For regular employees the attendance control is a `<select class="wl-inp wl-att-sel" id="wl-att-{iso}" onchange="wlOnAttendanceChange('{iso}')">`. Options come from `WL_ATTENDANCE_OPTIONS` — exactly **8** values. Their abbreviations and colours come from the single source of truth `WL_ATTENDANCE_STYLES`:

| Attendance option | Abbr | Background | Text colour | Group |
|---|---|---|---|---|
| Present | P | `#dcfce7` | `#15803d` | working |
| Leave Full Day | LF | `#fecdd3` | `#be123c` | leave (`WL_LEAVE_TYPES`) |
| Leave Half Day | LH | `#fed7aa` | `#c2410c` | leave (`WL_LEAVE_TYPES`) |
| Alternate Week Off | AW | `#fde68a` | `#92400e` | off (`WL_OFF_TYPES`) |
| Week Off | W | `#fce7f3` | `#9d174d` | off (`WL_OFF_TYPES`) |
| Holiday | H | `#bfdbfe` | `#1d4ed8` | off (`WL_OFF_TYPES`) |
| Extra Full Day | EF | `#14532d` | `#ffffff` | always-OT (`WL_ALWAYS_OT_TYPES`) |
| Extra Half Day | EH | `#065f46` | `#ffffff` | always-OT (`WL_ALWAYS_OT_TYPES`) |

Helpers: `_wlAttendanceAbbr(att)` returns the abbr (`—` if unknown); `_wlAttendanceColor` / `_wlAttendanceTextColor` return the bg/text colours, and additionally return a green tint (`#d1fae5` / `#065f46`) for an off-day that has logged work.

**Auto pre-fill (unsaved rows):** when no saved log exists, Sunday pre-fills "Week Off", an alternate-week Saturday (`_isAltWeekSat`) pre-fills "Alternate Week Off", a holiday date (in `TL_HOLIDAYS`) pre-fills "Holiday", otherwise blank.

**`wlOnAttendanceChange(iso)`** runs on every change: it shows/hides the work vs leave sub-controls, shows/hides the off-day "Worked today" toggle, disables work inputs for off-days that are not marked worked, re-applies the row colour class, refreshes the `+OT` badge, then (when not rendering) marks the row dirty and triggers auto-save.

**+OT badge logic** — `_wlShowsOtBadge(att, extraHrs, isOffDayWorked)` returns true (badge shown) if any of:
1. attendance is in `WL_ALWAYS_OT_TYPES` (Extra Full Day / Extra Half Day), OR
2. the off-day "Worked today" checkbox is checked (`isOffDayWorked`), OR
3. Extra Hrs `> 0`.

The badge element is `<span id="wl-ot-badge-{iso}" class="wl-ot-badge">+OT</span>`; `_wlUpdateOtBadge(iso)` toggles its `display`.

**Hours auto-calc per attendance type** — the inline **Hrs** input (`wl-hc-{iso}`) lets the user type total hours; `wlApplyHrs` (on blur/Enter) snaps to 0.5 steps and calls `_wlCalcFromHrs` which back-computes both attendance and Extra Hrs:

| Context | < 4h | 4–<9h | ≥ 9h |
|---|---|---|---|
| Regular day | Leave Full Day (extra = hrs) | Leave Half Day (extra = hrs−4) | Present (extra = hrs−9) |
| Off day | keep base off type (extra = hrs) | Extra Half Day (extra = hrs−4) | Extra Full Day (extra = hrs−9) |

A live preview (`wlHrsPreview`) writes `→ Present +2h` style text into `wl-hc-pre-{iso}`. The reverse mapping (`_attEffHours`) computes effective hours for pre-fill: Present / Extra Full Day = 9h base, Extra Half Day / Leave Half Day = 4h base, plus Extra Hrs.

**Intern branch (verified):** for `APP.currentUser.role === 'Intern'` the attendance control is instead `<input type="text" class="wl-inp wl-att-sel" id="wl-att-{iso}" oninput="_internWlOnAttendanceChange(this,'{iso}')">` with placeholder `"e.g. 9, 8.5, Holiday, Leave"`. Interns type a free-text numeric (hours) or an off-day keyword. `_internIsOffDayText` tests against `INTERN_OFF_PATTERNS = /^\s*(holiday|leave|week.?off|off|absent|half.?day|sick|vacation|alt.?week)\s*$/i`. `_internWlOnAttendanceChange` enables work fields for numeric/other text, disables them for off-day keywords or empty, shows the "Worked today" toggle for off-day text, updates the per-row hours display `wl-intern-hrs-{iso}`, then marks dirty and auto-saves. Interns have no Hrs calculator dropdown and no manual save button.

### 4.4 Task Chips

`_wlBuildCell(iso, half, data, disabled)` builds each work-update cell as `<div class="wl-upd-wrap" id="wl-upd-{half}-{iso}">` with three stacked sections:

1. **Task / Project picker button (top):** `<button class="wl-add-item-btn" onclick="wlTogglePicker('{iso}','{half}')">` labelled "+ Task / Project" (Material Symbol `add`). It opens a dropdown `<div class="wl-picker-drop" id="wl-picker-{half}-{iso}">`. `wlTogglePicker` injects `_wlPickerHtml` (a `<input class="wl-picker-search">` plus a `<div class="wl-picker-list">`). Picker items are the user's own tasks (assigned to them) and their projects, each rendered as `<div class="wl-picker-item" onclick="wlAddItemFromEl(this, …)">` with Material Symbols `folder_open` (project) / `task_alt` (task) / `subdirectory_arrow_right` (sub-fn). Already-added items show class `wl-pi-added` with a ✓ and are not clickable. A single document-level click listener (registered once via `WL_DOC_LISTENER_DONE`) closes any open picker on outside-click.
2. **Custom note textarea (middle):** `<textarea class="wl-cust-inp wl-inp" id="wl-cust-{half}-{iso}" data-iso="{iso}" data-half="{half}" rows="2">` with placeholder "Custom note — 1st half…" / "…2nd half…". Key behaviours:
   - `oninput` → `wlMarkDirty` + `wlAutoResize(this)` (auto-grows 40–120px).
   - **Commit on Enter:** `onkeydown` — `Enter` (without Shift) calls `wlAddCustom(iso, half)` and prevents the newline; `Shift+Enter` inserts a newline.
   - **Commit on blur:** `onblur="_wlOnBlur('{iso}','{half}')"` — if the textarea has content it is committed as a chip via `wlAddCustom`, otherwise dirty rows are saved.
   - An explicit add button `<button class="wl-cust-add-btn" …>↵</button>` also calls `wlAddCustom`.
3. **Chips area (bottom):** `<div class="wl-upd-chips" id="wl-chips-{half}-{iso}">`.

Chip state lives in `WL_ITEMS` keyed `'{iso}:{half}'` → array of `{type,id,text}`. Each chip is rendered by `_wlChipHtml` as `<div class="wl-chip wl-chip-{type}">` with a Material Symbol (`video_call` meeting · `folder_open` project · `task_alt` task · `edit_note` custom · etc.), a clickable text span (`<span class="wl-chip-text" title="Click to edit" onclick="wlEditChip(...)">`) and a delete span (`<span class="wl-chip-del" onclick="wlRemoveItem(...)">×</span>`).

- `wlAddItem` pushes the chip, re-renders chips, refreshes the picker, and (unless `WL_RENDERING`) marks dirty + auto-saves; duplicate `id`s are skipped.
- `wlAddCustom` normalises CRLF/CR → `\n`, trims each line, pushes a `custom` chip, then clears and collapses the textarea.
- `wlEditChip` puts the chip text back into the textarea, removes the chip, and re-focuses for editing.
- `wlRemoveItem` splices the chip, re-renders, marks dirty, auto-saves.

Serialization (`wlGetWorkText`) joins all chip texts (plus any uncommitted textarea text) with the canonical delimiter `'; '`, encoding in-chip newlines as the literal `\n`. On (re)render, `renderWeekLog` repopulates `WL_ITEMS` by splitting the saved `work1`/`work2` strings on `'; '` (decoding `\n` back to newlines).

Phase-2 meeting chips: `wlAutoAddMeetings` adds a `meeting` chip per calendar meeting (before 1pm → 1st half, else 2nd half), skipping halves that already have saved content, and pre-fills `WL_AUTO_HRS[iso]` from total meeting minutes.

### 4.5 Auto-Save

State is held in four module-level maps: `WL_DIRTY` (iso → has unsaved edits), `WL_SAVING` (iso → save in flight), `WL_DEBOUNCE` (iso → pending `setTimeout` id), and the boolean guard `WL_RENDERING`.

**Triggers** (each calls `wlMarkDirty(iso)` then `_wlAutoSave(iso)`): attendance change (`wlOnAttendanceChange`), chip add/remove (`wlAddItem`/`wlRemoveItem`), off-day toggle (`_wlToggleOffDayWork`), Extra Hrs / Remark / textarea blur (`_wlOnBlur`), and the intern attendance change. `wlMarkDirty` sets `WL_DIRTY[iso]=true` and refreshes the save-button icon (`_wlUpdateSaveBtn`).

**Debounce:** `_wlAutoSave(iso)` clears any existing `WL_DEBOUNCE[iso]` timer and sets a new 500ms one. When it fires it bails if the row is no longer dirty or a save is already running (`if (!WL_DIRTY[_iso] || WL_SAVING[_iso]) return;`), otherwise shows "Saving…" and calls `saveWeekEntry(iso, true)`.

**Status indicator:** `_wlAsStatus(prefix, iso, state)` writes into `<span id="wl-as-{iso}">` (prefix `'wl'` for personal, `'ml'` for the team modal): `Saving…` (muted italic) → `Saved ✓` (green, auto-clears after 2.5s) → `Save failed` (red). The save button (`wl-save-btn-{iso}`) icon also reflects the cycle via `_wlUpdateSaveBtn`.

**Race-safe pattern in `saveWeekEntry(iso, autoSave)`:**
1. **Re-entry guard:** `if (WL_SAVING[iso]) return;` at the top prevents concurrent saves for the same row.
2. On commit it sets `WL_SAVING[iso]=true` and **immediately `delete WL_DIRTY[iso]`** (before the async call), so any edit arriving during the in-flight call re-sets the dirty flag rather than being lost.
3. During auto-save only **committed chips** are persisted (`WL_ITEMS`), never the still-in-progress textarea text — this avoids turning partial text into a chip that would duplicate on Enter.
4. On success (`onSuccess`): the result patch (including a new `logId`) is merged into `WL_DATA[iso]`, `WL_SAVING[iso]` is cleared, and if `WL_DIRTY[iso]` is now true (new edits arrived mid-flight) it schedules exactly **one** retry via `_wlAutoSave`; otherwise it shows "Saved ✓" (auto-save) or a success toast (manual save).
5. On error it shows "Save failed" / toast, clears `WL_SAVING`, and retries once if still dirty.

**`WL_RENDERING` guard:** `renderWeekLog` sets `WL_RENDERING=true` at the start and `false` after `_wlRenderAllChips()` and post-render fixups. While true, `wlOnAttendanceChange` and `wlAddItem` skip `wlMarkDirty`/`_wlAutoSave`, so pre-populating chips from saved data on initial render does **not** falsely dirty the row or trigger a redundant save.

**Empty-row short-circuit:** if attendance, both work halves, leave type, remark, and extra hours are all empty, `saveWeekEntry` clears the dirty flag and returns without a server call.

**Off-day work gate (manual save only):** when attendance is an off-type and "Worked today" is checked, a manual save requires Extra Hrs ≥ 2 — otherwise the warning `<span id="wl-odc-warn-{iso}">Min 2 hrs</span>` flashes and the save aborts. Auto-save skips this gate.

**Routing:** interns route to `saveInternWorkLog`; existing rows (`data.logId`) route to `updateWorkLog`; new rows route to `submitWorkLog`. Manager-only fields (`Status`, `Comments`) are included only when `_isManager(role)`.

### 4.6 Work Duration

The Work Log grid surfaces the day's **actual clocked work time** as a "Work duration" chip appended to the Comments cell. `_wlDurHtml(iso, null)` renders `<div id="wl-dur-wrap-{iso}">` containing a label "Work duration" and a value span `<span id="wl-dur-{iso}">` showing `HH:MM:SS` (e.g. `07:42:15`) or `—` when none. Values come from `WL_DURATIONS[iso]`, loaded asynchronously by `_wlLoadDurationsAsync` → backend `getWorkDurationsForDates(email, startDate, endDate)`, which returns `{ ok, data: { 'YYYY-MM-DD': 'HH:MM:SS' } }` derived from `Net_Work_Mins` (or Clock_In→Clock_Out minus break). `_wlApplyDurations` patches the spans in place after Phase 3 completes.

> ⚠ The chip's clock glyph is `<i class="ti ti-clock-hour-4">` (Tabler), not a Material Symbol — see the note at the top of Section 4.

The live ticking timer `<div class="wd-status-timer" id="wd-timer">00:00:00</div>` (HH:MM:SS) belongs to the **Work Duration clock widget** (in the dashboard / header area, not the Work Log table). It updates live while a session is ACTIVE/ON_BREAK and is set on clock-out via `el('wd-timer').textContent = _wdFmtMins(r.netMins)`.

**Auto clock-out — daily reset at midnight UTC (NOT an 18-hour cap):** `wdAutoClockOut()` (in `work-duration.gs`) runs hourly. It computes `todayMidnightUTC` (00:00 UTC = 05:30 AM IST) and closes any ACTIVE/ON_BREAK session whose `Clock_In` is **before** that boundary. Closed sessions get `Clock_Out` = the midnight-UTC instant (stored as an IST wall-clock string), `Net_Work_Mins` = Clock_In→midnight minus break, `Status = 'AUTO_CLOSED'`, and an audit note "Auto-closed at midnight UTC (05:30 IST) …". There is no fixed-hours limit constant — it is a clean daily boundary, so a live shift started after 05:30 IST is never interrupted.

### 4.7 Weekly Summary Button

The button lives in the Work Log header: `<button class="btn btn-ghost btn-sm" onclick="openWeeklySummaryModal()" title="View AI-generated weekly summary for MIS"><span class="material-symbols-outlined" style="font-size:16px">summarize</span>Weekly Summary</button>`.

`openWeeklySummaryModal()` derives the week start (Monday of the current `WL_ANCHOR`), sets `_WS_CUR_START`, writes the range label + an "editable" badge into `<div id="ws-modal-sub">`, opens the modal, and calls `getWeeklySummary(APP._verifiedEmail, weekStart)`. The response drives two states (rendered by `_wsRenderModalContent`):

- **No summary yet (`r.found === false`):** the body shows a centred Material Symbol `description` with "No summary for this week yet" and the note "Summaries are auto-generated every Monday at 12 AM UTC. You can generate it now if your work logs are filled in." The footer shows **Close** plus a **Generate Now** button `<button class="btn btn-accent btn-sm" onclick="_wsGenerateNow('{weekStart}')">` (Material Symbol `auto_awesome`). `_wsGenerateNow` shows a "Generating summary with AI…" spinner, calls `generateMyWeeklySummary`, then re-fetches and re-renders.
- **Summary exists (`r.found === true`):** the content string is split on newlines into `_WS_BULLETS` (stripping leading `• ` / `- `) and rendered by `_wsRenderBullets` (see 4.8). The footer shows "Generated {date}" (+ " · edited" if `r.isEdited`), a **Copy** button (Material Symbol `content_copy`, `onclick="_wsCopyAll()"`), and **Close**.

### 4.8 Weekly Summary Modal

The static modal is `<div class="modal-bg hidden" id="weekly-summary-modal">` (in `index.html`) with title "Weekly Summary", sub-line `<div id="ws-modal-sub">`, body `<div id="ws-modal-body">`, and footer `<div id="ws-modal-footer">`. Module state: `_WS_BULLETS` (current bullet array), `_WS_EDIT_IDX` (index being edited, `null` = none), `_WS_CUR_START` (open week start).

This is the **Option-C inline-edit** UI built by `_wsRenderBullets` / `_wsBulletRowHtml`:

- A hint "Click any point to edit" sits above the list `<div id="ws-bullet-list">`.
- **Each bullet** (`_wsBulletRowHtml`) is a clickable row `onclick="_wsStartEditBullet(idx, weekStart)"` showing a **crimson dot** (`<span style="…border-radius:50%;background:var(--danger)…">`) followed by the bullet text. Empty / zero-width-space placeholders are skipped so no orphan dot appears.
- **Add a point:** a dashed-border row at the bottom `onclick="_wsAddBullet('{weekStart}')"` reading "+ Add a point". `_wsAddBullet` pushes a zero-width-space placeholder, re-renders, then opens it in edit mode after a short timeout.

**Edit mode (`_wsStartEditBullet`)** replaces the clicked row with a `<textarea id="ws-ta-{idx}" rows="2">` (auto-focused and selected) plus a vertical stack of three icon buttons (all **Material Symbols**):

| Button | Icon | Style | Handler |
|---|---|---|---|
| Save | `check` | navy filled (`#2D3E51`) | `_wsConfirmBullet(idx, weekStart)` |
| Cancel | `undo` | ghost bordered | `_wsCancelBullet(weekStart)` |
| Delete | `delete` | red bordered (`#fca5a5`/`#dc2626`) | `_wsDeleteBullet(idx, weekStart)` |

- `_wsConfirmBullet` — empty text discards the (placeholder) bullet; otherwise it writes `_WS_BULLETS[idx]`, re-renders, and **auto-saves** via `_wsPersist`.
- `_wsCancelBullet` — drops a never-filled placeholder and re-renders; no save.
- `_wsDeleteBullet` — splices the bullet, re-renders, and **auto-saves** via `_wsPersist`.

**Auto-save on each confirm/delete (`_wsPersist`):** joins `_WS_BULLETS` with `'• '` prefixes into one content string and calls `saveWeeklySummary(APP._verifiedEmail, weekStart, content)`. On success it briefly shows "Saved ✓" (green) via an inserted `.ws-saved-hint` span in the footer (auto-clears after 2.5s); on failure it toasts an error. Backend `saveWeeklySummary` updates the matching `Weekly_Summary` row, sets `Is_Edited='TRUE'`, and stamps `Edited_At`/`Edited_By`.

**Footer (summary state):** "Generated {timestamp}" (formatted by `_wsFormatTs` e.g. "23 Jun 2026, 9:00 AM", with " · edited" appended if edited), a **Copy** button (`_wsCopyAll` copies all bullets with `'• '` prefixes via the clipboard API, with an `execCommand` fallback), and a **Close** button (`closeModal('weekly-summary-modal')`).

**Generation (backend, `weekly-summary.gs`):** summaries are produced by `generateWeeklySummaries()`, registered as a **Monday 12 AM UTC** (= 05:30 IST) trigger in `installTriggers()`. For each active employee it builds per-day entries from `Work_Log` (+ `Intern_Work_Log`), parses the `'; '`-delimited work chips, and calls `_wsGenerateWithAI`. The AI call hits Gemini at endpoint `…/v1beta/models/gemini-2.5-flash:generateContent?key=…` (model id exactly **`gemini-2.5-flash`**; key from Script Property **`GEMINI_API_KEY`**) with `temperature: 0.4`, `maxOutputTokens: 2048`, prompting for 5–10 past-tense `•`-prefixed bullets. Results are upserted (`_wsUpsertSummary`) into the `Weekly_Summary` sheet keyed `WS-{empId}-{weekStartNoDashes}` (idempotent — re-runs skip done employees; a ~5-minute time-budget guard schedules a one-shot continuation trigger via `WS_CONT_TRIGGER_ID`). The on-demand "Generate Now" path is `generateMyWeeklySummary`, which refuses to spend an AI call when the week has no work logs.

## Verification — Work Log

- [ ] Open Work Log and click the **Month** tab (`#wl-mode-month`) -> tab gains `active`, `WL_MODE='month'`, grid reloads as a month range; click **Week** (`#wl-mode-week`) -> reverts to a 7-day week.
- [ ] Click `‹` / `›` (`wlNav(-1)`/`wlNav(1)`) within ±8 weeks -> grid re-renders instantly with no spinner; navigate beyond 8 weeks -> "Loading…" appears and a server fetch runs.
- [ ] Confirm the `<thead>` reads exactly: Day | Attendance | Work Update — 1st Half | Work Update — 2nd Half | Extra Hrs | Remark | Status | Comments (+ empty save column).
- [ ] Open the attendance `<select id="wl-att-{iso}">` -> exactly 8 options appear (Present, Leave Full Day, Leave Half Day, Alternate Week Off, Week Off, Holiday, Extra Full Day, Extra Half Day).
- [ ] Select **Present** then set **Hrs** (`#wl-hc-{iso}`) to 11 and blur -> attendance stays Present and Extra Hrs (`#wl-eh-{iso}`) becomes 2; set Hrs to 6 -> attendance flips to Leave Half Day with Extra Hrs 2; set Hrs to 2 -> attendance flips to Leave Full Day.
- [ ] On a **Week Off** row set Hrs to 10 -> attendance flips to Extra Full Day with Extra Hrs 1 and the **+OT** badge (`#wl-ot-badge-{iso}`) shows.
- [ ] Select **Extra Half Day** with Extra Hrs 0 -> +OT badge still shows (always-OT rule); select **Present** with Extra Hrs 0 -> +OT badge hidden; set Extra Hrs to 1 -> +OT badge appears.
- [ ] As an **intern**, confirm the attendance cell is a free-text `<input id="wl-att-{iso}">`; type "9" -> work textareas enable and `#wl-intern-hrs-{iso}` shows "9 hrs"; type "Holiday" -> work fields disable and the "Worked today" toggle appears.
- [ ] In a work-update cell type a note and press **Enter** -> a `wl-chip` appears and the textarea clears; type another note and click away (blur) -> it also commits as a chip.
- [ ] Click the **+ Task / Project** button (`.wl-add-item-btn`) -> picker `#wl-picker-{half}-{iso}` opens with your tasks/projects; pick one -> a chip is added and the picker entry shows ✓; click a chip's × (`.wl-chip-del`) -> chip is removed.
- [ ] Add a chip and watch `#wl-as-{iso}` -> shows "Saving…" then "Saved ✓" within ~1s (no manual save needed); confirm the save button (`#wl-save-btn-{iso}`) icon returns to the `check` (saved) state.
- [ ] Rapidly add several chips in succession -> only one row record is written (no duplicate), proving the `WL_SAVING` re-entry guard + single-retry pattern.
- [ ] Set attendance to an off-type, check "Worked today" (`#wl-odc-{iso}`) with Extra Hrs < 2, click the manual save button -> "Min 2 hrs" warning flashes and no save occurs; set Extra Hrs ≥ 2 and save -> saves successfully.
- [ ] Reload the Work Log -> existing chips re-render from saved data without `#wl-as-{iso}` showing "Saving…" (confirms the `WL_RENDERING` guard prevents a false dirty-save on render).
- [ ] On a day you clocked in/out, confirm the Comments cell shows a "Work duration" chip (`#wl-dur-{iso}`) with an `HH:MM:SS` value (or `—` if none).
- [ ] Verify auto clock-out is a daily reset: leave a session open past 05:30 IST -> within the hour the session's Status becomes `AUTO_CLOSED` with Clock_Out at midnight-UTC and an "Auto-closed at midnight UTC (05:30 IST)" note (NOT an 18-hour cap).
- [ ] Click **Weekly Summary** (`summarize` icon) for a week with no summary -> modal shows "No summary for this week yet" and a **Generate Now** button; click it -> "Generating summary with AI…" then bullets render.
- [ ] Open Weekly Summary for a week that has a summary -> footer shows "Generated {date}", a **Copy** button, and **Close**; bullets show a crimson dot + text with the "Click any point to edit" hint.
- [ ] Click a bullet -> it becomes a `<textarea id="ws-ta-{idx}">` with three Material-Symbol buttons (check / undo / delete); edit text and click **check** -> row re-renders with new text and "Saved ✓" flashes in the footer.
- [ ] Click a bullet, then **delete** (trash) -> the bullet disappears and the summary auto-saves; click **+ Add a point**, type text, confirm -> a new bullet is appended and saved.
- [ ] Click a bullet, edit, then **undo** (cancel) -> the original text is restored and no save fires.
- [ ] Click **Copy** -> a "Copied to clipboard" toast appears and pasted text contains each bullet prefixed with "• ".
- [ ] Confirm backend generation targets model `gemini-2.5-flash` using Script Property `GEMINI_API_KEY` and that the trigger is scheduled Monday 12 AM UTC (05:30 IST).


---

## 5. My Space — My Tasks

The My Tasks view lives in the `<div class="view hidden" id="view-my-tasks">` shell (`index.html`). Its header (`.ph`) shows the title "My Tasks" and the sub-line "Tasks assigned to or created by you". The view is rendered by `renderMyTasks()` (`app.js.html`). On entry the function:

1. Reads the assignment scope tab from `_ASGN_FILTER['my-tsk']` (default `'all'`).
2. Filters `APP.tasks` to the user's scope (see 5.1 below).
3. Updates the sidebar badge `#badge-my-tasks` with the count of OPEN tasks (`_isOpen(t.Status)`), hiding it when zero.
4. Injects the modern multi-select filter bar via `_tskInjectFilterBarForVid('my-tasks','my')` and populates its selects with `_populateTskFilterSelects('my')`.
5. Applies the column filters with `_tskApplyColFilters(rows,'my')`.
6. Renders the body in whichever group-by mode is active (`_TSK_GRP_MODE['my']`).

> WARNING — Tab scope (not in the assignment template): the page header carries three "assignment" tabs (`.tl-tab.asgn-tab` with `data-vid="my-tsk"`): **All**, **To Me**, **By Me** (`index.html` lines 2040–2042). `setAsgnFilter('my-tsk', val)` sets `_ASGN_FILTER['my-tsk']` and re-renders. Scope logic in `renderMyTasks()`: **To Me** = current user in `Assignee_IDs`; **By Me** = `Assigner_ID === empId`; **All** = the union. (There is no "team" value wired to these three buttons in My Tasks — the `af === 'team'` branch in `renderMyTasks()` is reachable only if `_ASGN_FILTER['my-tsk']` were set to `'team'`, which these buttons never do.)

> WARNING — Legacy filter row: the static `<tr class="ts-filter-row">` and the first `<thead><tr>` of `.task-sheet` (`index.html` lines 2050–2075, single-`<select>` filters like `#tf-my-fn`, `#tf-my-status`) are **superseded at runtime**. `_tskInjectFilterBarForVid` hides the old header row (`oldHdrRow.style.display='none'`) and removes `.ts-filter-row`, then injects the new bar described in 5.2. Document the runtime bar, not the static markup.

### 5.1 View Modes

A "Group by" segmented control is rendered into `#my-tasks-grp-toggle` (an empty div in the header, `index.html` line 2044). Its HTML comes from `_tskGrpToggleHtml('my')`, which builds three `<button>` elements (no id; inline-styled) labelled **Function**, **Date**, **Week** — keys `function` / `date` / `week`. The active button is filled LG navy (`#2D3E51`, white text); inactive buttons are transparent grey. A leading `<span>` reads "Group by:".

Clicking a mode calls `_tskSetGrp('my', mode)` which:
- Stores the mode in `_TSK_GRP_MODE['my']` and persists it to `localStorage` under key **`lgd_grp_my`** (team/all use `lgd_grp_team` / `lgd_grp_all`).
- Re-invokes `renderMyTasks()`.

The default for each scope is read from localStorage at module load, falling back to `'function'`:

```js
var _TSK_GRP_MODE = {
  my:   localStorage.getItem('lgd_grp_my')   || 'function', ...
};
```

| Mode | Renderer | Output target | Layout |
|---|---|---|---|
| **Function** (default) | `_renderGroupedTasksHtml(rows)` injected into `#my-tasks-body` inside `#my-tasks-tbl-wrap` (the `.task-sheet` table is shown) | `#my-tasks-tbl-wrap` visible, `#my-tasks-alt-body` hidden | Tasks grouped under their Function → Sub-Function with coloured group headers (palette `_TSK_GRP_COLORS`); rows from `_renderGroupedRow` |
| **Date** | `_renderDateGroupedTasksHtml(rows,'my')` | `#my-tasks-tbl-wrap` hidden, `#my-tasks-alt-body` shown (`display:block`) | Buckets: Overdue / Today / This week / Next week / Later / No due date. Each closed task is excluded (`!_isClosed`). Rows from `_tskDateRowHtml` |
| **Week** | `_renderWeekGroupedTasksHtml(rows,'my')` | same alt body | Overdue bucket + one "Week of …" section per ISO week (Monday-anchored via `_mlWeekMonday`), current week highlighted; closed tasks excluded |

> WARNING — Icon mismatch in Date/Week bucket headers: the bucket header icons in `_renderDateGroupedTasksHtml` and `_renderWeekGroupedTasksHtml` use **Tabler classes** (`<i class="ti ti-alert-triangle">`, `ti-calendar-event`, `ti-calendar-week`, `ti-calendar-time`, `ti-calendar-off`). Per project ground truth the icon library is **Material Symbols Outlined** and there are no `ti-*` definitions — so these specific icons render as empty/broken glyphs unless Tabler is also loaded. Everywhere else in My Tasks (search, status, actions) correctly uses `<span class="material-symbols-outlined">`.

### 5.2 Filter Bar

In **Function** mode the bar is built by `_tskBuildFilterBar('my')` and injected immediately above `.task-sheet-wrap`. After injection, `setTimeout(_tskInitFilterWidgets('my'), 0)` upgrades the eight column `<select>`s into portal multi-select widgets via `_ssInitMulti`. The bar has two parts.

**Secondary row** (`#tsk-filter-secondary-my`, a flex strip) — a "Filter:" label plus two wide multi-selects:

| Control | Element (after upgrade) | Source |
|---|---|---|
| Functions | `<select id="tf-my-fn">` → multi-select portal | top-level functions, narrowed to selected Projects |
| Projects | `<select id="tf-my-proj">` → multi-select portal | all `APP.projects` |

**Aligned column row** (`#tsk-filter-bar-wrap-my`, a fixed-layout `<table>` whose `<colgroup>` widths come from `_TSK_COL_SPEC`). One filter cell per column:

| Column (`_TSK_COL_SPEC.label`) | ftype | Element id / type | Filter behaviour |
|---|---|---|---|
| Assigned date | `adate` | two `<input type="date">` `#flt-adate-from` / `#flt-adate-to` (`data-filter="adate-from/to"`) | `Created_At` between from/to; `onchange="_tskGrpRerender()"` |
| Sub-function | `subfn` | `<select id="tf-my-parent" data-filter="subfn">` → multi-select | matches `t.SubFn_ID` |
| Task | `task` | `<select id="tf-my-sub" data-filter="task">` → multi-select | matches `t.Task_ID` |
| Assigned to | `assignee` | `<select id="tf-my-asgn" data-filter="assignee">` → multi-select | any selected id ∈ `Assignee_IDs` |
| Assigned by | `assigner` | `<select id="tf-my-asgr" data-filter="assigner">` → multi-select | matches `t.Assigner_ID` |
| Recurring | `recurring` | `<select id="flt-recurring-my" data-filter="recurring">` (plain select) | `none`/Daily/Weekly/Monthly/Quarterly |
| Status | `status` | `<select id="tf-my-status" data-filter="status">` → multi-select | matches `t.Status` |
| Priority | `priority` | `<select id="tf-my-pri" data-filter="priority">` → multi-select | matches `t.Priority` |
| Due date | `date2` | `<input type="date" id="tf-my-due" data-filter="due">` (single picker) | "due by" — keeps tasks with `Due_Date <= value` |
| Actions | `null` | "Select all" `<input type="checkbox" id="tsk-chk-all">` + Clear `<button>` ("✕ Clear") | bulk-select / clear filters |

**Multi-select widget (`_ssInitMulti`).** The native `<select>` is hidden; a `.ssm-trigger` div replaces it. Clicking the trigger opens a body-appended **portal** (`position:fixed; z-index:2147483647`) containing a `.ssm-srch` search input and a `.ssm-list` of checkbox rows (Material Symbols `check` glyph in the box). Selections are stored as a JSON array on `dataset.ssmVals`; each toggle dispatches a `change` event so the select's `onchange` re-render fires. The trigger shows the placeholder ("All Functions" etc.) when empty, the single label when one is chosen, or a navy count pill "N selected" with a crimson `×` clear control when multiple.

- **Multi-value OR / cross-field AND.** Confirmed in `_tskTaskMatchesCols`: within one field any selected value matches (`f.fn.indexOf(t.Function_ID) === -1` rejects only when none match; assignee uses `f.asgn.some(...)`); across fields all must pass. Empty arrays do not filter.
- **Auto-apply.** Every control re-renders immediately on `change` — secondary selects via `onchange="renderMyTasks()"`, column controls via `onchange="_tskGrpRerender()"` (which routes back to `renderMyTasks()` in non-function modes). There is no Apply button.
- **Cascade.** `_populateTskFilterSelects('my')` narrows Functions to selected Projects, Sub-Functions to selected Projects+Functions, and Tasks to selected Projects+Sub-Functions, and prunes now-invalid selections via `_ssmSet`. Assignee/Assigner/Status/Priority lists are full (no cascade).
- **Stays open on scroll.** The portal registers `window.addEventListener('scroll', _onScroll, true)`; `_onScroll` returns early (does NOT close) when `portal.contains(e.target)` — i.e. scrolling *inside* the dropdown list keeps it open; only an outside/page scroll closes it. The list also stops `wheel`/`touchmove` propagation.
- **Close on outside click — verified `contains()` check.** `_onDocDown` closes only when neither the portal nor the trigger wrap contains the click target: `if (portal && (portal.contains(e.target) || wrap.contains(e.target))) return; _closePortal();`. The single-select sibling `_ssInit` uses the same pattern (`if(openDrop&&!openDrop.contains(e.target))closeAll();`).

**Clear.** The Actions-cell "✕ Clear" button calls `_tskClearFilters()`, which `_ssmClear`s all eight multi-selects, blanks the date inputs and recurring select in `#tsk-filter-bar-wrap-my`, clears the `#tsk-search-input` and `_tskSearchQuery`, then `_tskGrpRerender()`s.

**Debounced text search.** The search box `<input id="tsk-search-input">` (with a leading Material Symbols `search` icon) is injected into the page-header `.ph-actions` by `_tskGrpInjectHeaderControls`. Its `oninput="_tskGrpSearchDebounced(this.value)"` sets `_tskSearchQuery` (lower-cased, trimmed) then debounces `_tskGrpRerender` with `setTimeout(..., 220)` (≈220 ms — close to the ~300 ms in the template). The query matches against `Title`, `Description`, or `Task_ID` (case-insensitive) inside `_tskApplyColFilters`.

### 5.3 Task Row

In Function mode each task row is built by `_renderGroupedRow(t)` as a `<tr class="tsk-grp-row" data-task-id="…" onclick="openTaskDetail('TASK-…')">`. Closed tasks add `.tsk-row-closed`. Columns (left→right), matching `_TSK_COL_SPEC`:

| # | Column | Cell content |
|---|---|---|
| 1 | Assigned date | `.tsk-gtd.tsk-gtd-first` → `.tsk-gadate` formatted `Created_At` |
| 2 | Sub-function | `.tsk-gsub` name + grey `SubFn_ID` below, or "—" |
| 3 | Task | `.tsk-gtask-title` (with `+N` link badge `.tsk-glbadge` when `Links` present) + `.tsk-gtask-id` |
| 4 | Assigned to | avatar stack via `_tskGrpAvatarHtml(Assignee_IDs, 3)` |
| 5 | Assigned by | coloured initials circle + `.tsk-gby-name` |
| 6 | Recurring | `.tsk-rec-badge` (or "—" for none/One Time) |
| 7 | Status | `_tskGrpStatusHtml` (`.tsk-gst` dot + label); inline-editable (below) |
| 8 | Priority | `_tskGrpPriorityHtml` (`.tsk-gpri` arrow glyph + label) |
| 9 | Due date | `_tskGrpDueHtml` (red "Overdue · date" when past due & open; struck-through when closed) |
| 10 | Actions | row `<input type="checkbox" class="tsk-row-chk">` + optional 📎 attachment badge (`ATT_COUNTS`) + three `.tsk-gact-btn` icons: `open_in_new` (open detail), `edit` (`openEditTaskModal`), `delete` (`confirmDeleteTask`) |

(Date/Week modes render rows via `_tskDateRowHtml` instead — a card-style row with sub-function·"by"·assigner subtitle, a thin progress bar `_tskProgHtml`, and the date-pill status `_tskDatePillHtml`.)

**Open detail.** Clicking anywhere on the row (except cells that `event.stopPropagation()`) fires `openTaskDetail(t.Task_ID)`. The status cell, the row checkbox, and all action buttons each carry `onclick="event.stopPropagation()"` so they do not open the detail modal.

**Double-click status inline edit — saves immediately, no full re-render.** The Status cell carries `title="Double-click to edit status"`, `onclick="event.stopPropagation()"`, and `ondblclick="tskStatusDblClick(event,'TASK-…','<status>','grp')"` (the date/week pill passes kind `'date'`).

`tskStatusDblClick`:
1. Snapshots the cell into `_TSK_INLINE_RESTORE[taskId]` (element, original HTML, kind, `_saving` flag).
2. Replaces the cell with a `<select>` (navy 1.5px border) listing `TASK_STATUSES`, current value pre-selected, auto-focused.
3. Wires `change → tskStatusSave`, `Escape → _tskStatusRevert`, and a 200 ms `blur` that reverts if nothing was committed.

`tskStatusSave(taskId, newStatus, prev)`:
- No-op (revert) if unchanged.
- Sets `_saving=true`, dims the cell (`opacity:0.5`), disables the select.
- Calls `google.script.run … .updateTask(taskId, { Status: newStatus }, APP._verifiedEmail)` — a **partial update** (only the `Status` field).
- On success: patches `APP.tasks[i].Status` in memory, toasts "Status updated", and calls `_tskRebuildStatusEl` which re-renders **only that single cell** (`_tskGrpStatusHtml` for `grp`, `_tskDatePillHtml` for `date`) and re-binds its `ondblclick`/`onclick`. No table re-render occurs.
- On failure: restores the cell's original HTML and toasts the error.

**Bulk select.** Each row checkbox `.tsk-row-chk` calls `_tskToggleRow`; the header `#tsk-chk-all` calls `_tskSelectAll(checked)`; both feed `_tskSelectedIds` and update the selection bar (`#tsk-selection-bar` / `#tsk-sel-count`).

### 5.4 Task Detail Modal

`openTaskDetail(taskId)` populates the static modal `<div class="modal-bg hidden" id="task-detail-modal">` (`index.html`, opened with `.modal.modal-lg`) and removes `.hidden`. It backgrounds the click backdrop close (`onclick="closeModal('task-detail-modal',event)"`) and an `✕` `.modal-x` button.

**Header** (`.modal-hd`):
- `#tdm-title` ← task `Title`.
- `#tdm-subtitle` ← "Task · TASK-00042".
- `#tdm-edit-btn` (Material Symbols `edit`, → `openEditTaskModal(APP._taskId)`) — shown when `_isManager(role)` OR the user is a TM/Intern assigned to the task, and the task is not context-only.
- `#tdm-delete-btn` (Material Symbols `delete`, → `confirmDeleteTask(APP._taskId)`) — shown only for managers on non-context-only tasks.

**Body** (`#task-detail-body`, assembled as one HTML string `strip + ctxHtml + peopleHtml + hoursHtml + descHtml + linksHtml + chainHtml`):

| Section | Content |
|---|---|
| Info strip | Status `pill()`, Priority `badge()`, Due Date `deadlineHtml()`, and (if recurring) "↻ <recurrence>". For non-admin non-assigner users a "Request Change" `<button>` appears under Due Date → `openDueDateRequestModal('Task', …)` |
| Context cards (`.tdm-grid2` / `.tdm-card`) | Project name, Function (name + ≤120-char description), Sub-Function (name + ≤120-char description) — only the ones present |
| People (`.tdm-grid2`) | **Assigned To** — one `.ms-chip` per assignee (resolved via `findEmp`), "—" if none; **Assigned By** — `.avatar-sm` initial + name + designation·role·team meta |
| Hours (`.tdm-card`) | Always shown: actual / est / percent with a progress bar when an estimate exists, else "Not tracked" |
| Description | Always shown; pre-wrap text block, or italic "No description added." placeholder |
| Related Links | Always shown via `_renderLinksHtml(t.Links)` |
| Assignment Chain | Collapsible `<details>` ("Assignment Chain", `account_tree` icon) when `_renderTaskAssignChain` returns content |

> Note: the detail body fields are **read-only displays** — there is no inline field editing inside the modal; edits go through `#tdm-edit-btn` → `openEditTaskModal`. (The only inline edit for a task is the double-click Status in the row, 5.3.)

**Progress Updates** (static block below `#task-detail-body`): a "Progress Updates" `.section-title`, an `#btn-add-progress` "+ Add Progress" button (visibility gated by `canProgress` — managers, the assigner, or assignees only), and a `#progress-timeline` div. The timeline is loaded async via `getTaskProgressUpdates(taskId, email)` → `renderProgressTimeline`, which renders a `.progress-timeline` list of `.pt-item` rows (avatar, `.pt-author`, `.pt-date`, optional percentage bar, `.pt-desc`, `.pt-blocker`, `.pt-hours`), or a `checklist` empty state. "+ Add Progress" opens `#progress-modal`; `saveProgressUpdate()` calls `submitProgressUpdate(record, email)`.

**Attachments** (static block): "Attachments" section with File (`attach_file`) and Audio (`mic`) buttons and an `#task-attachments-list` div, loaded by `loadAttachments('Task', taskId, 'task-attachments-list')`.

## Verification — My Tasks

- [ ] Open My Tasks with no tasks assigned -> the `#badge-my-tasks` sidebar badge is hidden (count 0); with open tasks it shows the open count.
- [ ] Click the **To Me** tab -> only tasks where you are in `Assignee_IDs` remain; click **By Me** -> only tasks where you are `Assigner_ID`; click **All** -> the union of both.
- [ ] Click **Date** in the "Group by" toggle (`#my-tasks-grp-toggle`) -> `#my-tasks-tbl-wrap` hides, `#my-tasks-alt-body` shows Overdue/Today/This week/Next week/Later/No due date buckets; reload the page -> Date mode persists (localStorage `lgd_grp_my`).
- [ ] Switch to **Week** mode -> tasks group into "Week of …" sections, Monday-anchored, current week highlighted, closed tasks omitted.
- [ ] In Date/Week mode inspect a bucket header icon -> WARNING expected-broken: these use Tabler `ti-*` classes, not Material Symbols, so the glyph is blank unless Tabler is loaded.
- [ ] Open the **Status** column filter and tick two statuses -> rows matching EITHER status appear (multi-value OR within the field).
- [ ] Tick a Status and an Assignee in two different filters -> only rows matching BOTH constraints appear (cross-field AND).
- [ ] Open any multi-select dropdown and scroll the list past its visible height -> the dropdown stays open while scrolling inside it; then scroll the page body -> the dropdown closes.
- [ ] With a multi-select open, click outside it -> it closes; click on its own search box or an option -> it stays open (contains() check).
- [ ] Select a Project in the Projects multi-select -> the Functions/Sub-Functions/Tasks dropdown lists narrow to that project and any now-invalid prior selections are pruned.
- [ ] Type in the search box (`#tsk-search-input`) -> results filter after ~220 ms (debounced) and match Title, Description, or Task_ID.
- [ ] Click the Actions-column "✕ Clear" button -> all eight multi-selects, both date inputs, the recurring select, and the search box reset and the list re-renders unfiltered.
- [ ] Double-click a task row's Status cell -> an inline `<select>` (navy border) appears focused with the current status selected.
- [ ] Choose a different status in the inline select -> it saves immediately via `updateTask({Status})`, toasts "Status updated", and updates ONLY that cell (the rest of the table does not re-render or scroll-reset).
- [ ] During the inline status save, click elsewhere -> the cell does not revert mid-save (blur revert is suppressed while `_saving`); press Escape before choosing -> the cell reverts unchanged.
- [ ] Click a task row (not on the status cell, checkbox, or action buttons) -> the Task Detail modal (`#task-detail-modal`) opens with `#tdm-title` = task title and `#tdm-subtitle` = "Task · <id>".
- [ ] Click the status cell, a row checkbox, or an action button -> the detail modal does NOT open (stopPropagation).
- [ ] In the detail modal as a non-admin non-assigner -> a "Request Change" button appears under Due Date (opens the due-date request modal); as a manager/assigner it is absent.
- [ ] In the detail modal -> the `#progress-timeline` loads asynchronously and shows progress items or the "No progress updates yet." empty state; "+ Add Progress" (`#btn-add-progress`) is hidden for users who are neither manager, assigner, nor assignee.
- [ ] Click the header `edit` button (`#tdm-edit-btn`) -> the task edit modal opens; the field rows inside the detail body itself are read-only (no inline field editing there).


---

## 6. Team — Team Work Logs

The Team Work Logs view lets managers review and edit the daily work logs of the people they oversee. It lives in `<div class="view hidden" id="view-team-logs">` (`index.html`). The sidebar entry is `<div class="nav-item nav-mgr-only hidden" data-view="team-logs" onclick="navigate('team-logs')">` with a Material Symbols `monitoring` icon — the `nav-mgr-only` class gates it to managers (Super Admin / Admin / Team Captain / Team Facilitator). Navigating to the view calls `loadTeamLogs()` (`navigate()` at app.js.html line 1150).

Backend access is enforced server-side: `getTeamWorkLogs(email, startDate, endDate)`, `getMemberWorkLogs(targetEmpId, adminEmail, startDate, endDate)`, `adminSubmitWorkLog(record, targetEmpId, adminEmail)` and `adminUpdateWorkLog(logId, updates, adminEmail)` (all in `auth.gs`) each throw `'Not authorized.'` unless `_isManager(user.role)` is true. Admins/SA see all employees; TC/TF are scoped via `_getTeamEmpIds(user)` on the server and re-scoped client-side in `_tlByMember` (`members = isAdmin ? allActive : allActive.filter(e => (e.Team || e.Sub_Department) === myTeam)`).

`getTeamWorkLogs` returns `{ logs: [...], holidays: [...] }`. `logs` merges regular `Work_Log` rows with `Intern_Work_Log` rows (interns don't write to `Work_Log`); `holidays` is the list of admin-set holiday ISO dates used to compute expected work days. The success handler stores these in module state: `TL_RAW = r.logs`, `TL_HOLIDAYS = r.holidays`, then calls `_populateMemberFilter(TL_RAW)` and `renderTeamLogs()` (app.js.html line 3549).

### 6.1 View Modes (Day / Week / Month / Custom + By Member / By Date tabs)

The page header (`class="ph"`) contains four control clusters inside `.ph-actions`:

**Range navigation** — `<div class="tl-range-bar">`:
- `‹` prev: `<button class="tl-nav-btn" onclick="tlNav(-1)">`
- `Today`: `<button class="btn btn-ghost btn-sm" onclick="tlNavToday()">`
- range label: `<span class="tl-range-label" id="tl-range-label">` (updated by `_tlUpdateLabel()` from `_tlRange().label`)
- `›` next: `<button class="tl-nav-btn" onclick="tlNav(1)">`

`tlNav(dir)` shifts `TL_ANCHOR` by one day (day mode), 7 days (week), or one month (month) and reloads. In **custom** mode `tlNav`/`tlNavToday` return immediately (arrows do nothing). `setTLMode('custom')` additionally sets `document.querySelector('.tl-range-bar').style.visibility = 'hidden'`, so the whole nav bar is hidden in custom mode.

**Period mode** — `<div class="tl-tabs">` with four buttons calling `setTLMode(mode)`:

| Button id | Mode | `_tlRange()` behaviour |
|---|---|---|
| `tl-mode-day` (default `active`) | `day` | single ISO day; label e.g. "Monday, 27 Jun 2026" |
| `tl-mode-week` | `week` | Mon→Sun 7-day window around `TL_ANCHOR` |
| `tl-mode-month` | `month` | 1st → last day of the anchor's month; label "June 2026" |
| `tl-mode-custom` | `custom` | `TL_CUSTOM_START` → `TL_CUSTOM_END` inclusive |

`setTLMode(mode)` sets `TL_MODE`, toggles the `active` class on `tl-mode-{m}`, shows/hides the custom bar via `el('tl-custom-bar').classList.toggle('hidden', mode !== 'custom')`, and (for non-custom) calls `loadTeamLogs()`. The module-level default is `var TL_MODE = 'day'`.

**Custom date range bar** — `<div id="tl-custom-bar" class="hidden" ...>`, shown only in custom mode:
- start: `<input type="date" class="fc tl-date-inp" id="tl-cust-from">`
- end: `<input type="date" class="fc tl-date-inp" id="tl-cust-to">`
- `<button class="btn btn-primary btn-sm" onclick="tlApplyCustomRange()">Apply</button>`

`tlApplyCustomRange()` reads both inputs, validates that both are present, that `from <= to`, and that the span does not exceed 90 days (`toast('Custom range cannot exceed 90 days.','error')`), then sets `TL_CUSTOM_START`/`TL_CUSTOM_END` and reloads.

**View type tabs** — second `<div class="tl-tabs">` calling `switchTeamLogTab(tab)`:
- `<button class="tl-tab active" id="tl-tab-member" onclick="switchTeamLogTab('member')">` (Material Symbols `person`, "By Member")
- `<button class="tl-tab" id="tl-tab-date" onclick="switchTeamLogTab('date')">` (Material Symbols `calendar_month`, "By Date")

`switchTeamLogTab(tab)` sets `TL_TAB` (default `'member'`), toggles `active` on each tab, toggles the member filter dropdown visibility (`el('tl-member').classList.toggle('hidden', tab === 'member')` — i.e. the dropdown is hidden in member tab, shown in date tab), and calls `renderTeamLogs()` which dispatches `TL_TAB === 'member' ? _tlByMember() : _tlByDate()`.

**Member filter** — `<select class="fc tl-filter-inp hidden" id="tl-member" onchange="renderTeamLogs()">`, populated by `_populateMemberFilter(logs)` with one option per distinct `Emp_ID` plus a leading `All Members` option. Used in the By Date tab to filter to a single member.

**Refresh** — `<button class="btn btn-ghost btn-sm" onclick="loadTeamLogs()">↻</button>`.

Results render into `<div id="team-logs-container">`; the subtitle `<div class="ph-sub" id="tl-sub">` shows the range label plus an active-member count (e.g. "June 2026 — 14 / 22 members active"). For SA/Admin, the By Member render groups members under team section headers (`.tl-team-section` / `.tl-team-hdr` / `.tlm-grid`); for TC/TF it renders a single flat `.tlm-grid`.

### 6.2 Member Cards (Month / Custom Mode)

In the By Member tab, the card layout depends on `TL_MODE`:
- `day` → `_tlMemberDayCards(...)` (single-day card, attendance badge + hours + work text)
- `week` → `_tlMemberWeekCards(...)` (7 coloured day dots `.tlm-dot` via `_attDot`)
- `month` / `custom` → `_tlMemberMonthCards(members, logMap, workDays)`

All cards use class **`.tlm-card`** (with extra `missing` class when the member has no logs in range) and `onclick="openMemberLogDetail('{Emp_ID}')"`. Month/custom cards are wrapped in `try/catch`; on error an inline red `Error rendering cards: ...` message is shown instead of a stuck spinner.

`_tlMemberMonthCards` renders each card with:

| Element | Source |
|---|---|
| Avatar `<div class="tlm-avatar">` (initial, colour via `_avatarColor`; grey `#bdbdbd` when no logs) | `emp.Name` |
| Name `<div class="tlm-name">` + team `<div class="tlm-team">` | `emp.Name`, `emp.Team \|\| emp.Sub_Department` |
| Hours row `<div class="tlm-hours-row">`: `<span class="tlm-hours">{totalHrs}</span><span class="tlm-hours-lbl"> hrs</span>` | Σ `_attEffHours(attVal, extra)` per log, rounded to 1 dp |
| **OT badge** (orange pill `+{otHrs} OT`) | shown only when `otHrs > 0`; inline style `color:#e65100;background:#fff3e0` |
| Progress bar `<div class="tlm-month-bar"><div class="tlm-month-bar-fill" style="width:{pct}%">` | `submitted / workDays` |
| Stats `<div class="tlm-month-stats">`: "{submitted} / {wdLen} work days" + `{pct}%` | colour `var(--ok)` ≥80%, `var(--warn)` ≥50%, else `var(--danger)` |
| Attendance breakdown row (flex-wrap of mini pills, `margin-top:8px`) | `attCounts` |

`workDays` is `_tlExpectedWorkDays(range.days)` — it excludes Sundays, 1st/3rd/5th Saturdays (`_isAltWeekSat`, alternate week-offs), and admin holidays in `TL_HOLIDAYS`. `pct = round(submitted / wdLen * 100)`.

**OT (overtime) formula** — accumulated in the per-log loop (app.js.html ~line 3942):

```
otHrs += parseFloat(log['Extra Hours'] || log.Hours_Total || 0)   // the Extra Hours column
if (attVal === 'Extra Full Day') otHrs += 9
if (attVal === 'Extra Half Day') otHrs += 4
otHrs = Math.round(otHrs * 10) / 10
```

i.e. **OT = Σ(Extra Hours column) + (Extra Full Day count × 9) + (Extra Half Day count × 4)**, rounded to one decimal. This matches the Team Work Logs OT fix (CLAUDE.md change #46): explicitly-logged overtime is summed rather than derived from attendance-minus-baseline.

**Attendance breakdown badges.** Pills are emitted in a fixed priority order from `_TLM_ATT_ORDER`, each as `{label}: {count}` with colours from `_TLM_ATT_COLORS` and labels from `_TLM_ATT_LABELS`. Any attendance value not in the order list is appended last as a grey fallback pill.

| Attendance value | Badge label | Colour (bg / text) |
|---|---|---|
| Present | **P** | `#e8f5e9` / `#2e7d32` (green) |
| Extra Full Day | **EF** | `#e0f2f1` / `#00695c` (teal) |
| Extra Half Day | **EH** | `#e0f7fa` / `#00838f` (cyan) |
| Leave Full Day (and legacy `Leave`) | **LF** | `#fff3e0` / `#e65100` (orange) |
| Leave Half Day | **LH** | `#fff8e1` / `#f57f17` (amber) |
| Holiday | **H** | `#e3f2fd` / `#1565c0` (blue) |
| Week Off | **W** | `#f5f5f5` / `#757575` (grey) |
| Alternate Week Off | **AW** | `#fafafa` / `#9e9e9e` (light grey) |

Note the label set is **P / EF / EH / LF / LH / H / W / AW**; there is no separate "LF" vs "leave" — both `Leave Full Day` and the legacy `Leave` value map to **LF**. Order in `_TLM_ATT_ORDER` is Present → Extra → Leave → Holiday → Week Off → Alt Week Off.

Clicking anywhere on a `.tlm-card` opens the Member Work Log modal for that employee via `openMemberLogDetail('{Emp_ID}')`.

### 6.3 Member Work Log Modal

The modal is `<div class="modal-bg hidden" id="member-log-modal" onclick="closeModal('member-log-modal',event)">` (`index.html` line 3563). Header: `<div id="ml-header-avatar" class="tlm-avatar">` + `<div class="modal-hd-title" id="ml-header-title">`. The week-nav strip holds `<button class="tl-nav-btn" onclick="_mlPrevWeek()">‹</button>`, `<span class="ml-week-lbl" id="ml-week-label">`, `<button class="tl-nav-btn" onclick="_mlNextWeek()">›</button>`. Content renders into `<div id="member-log-body" style="...max-height:65vh;overflow-y:auto">` inside `<div id="member-log-content">`.

`openMemberLogDetail(empId)` snapshots the team view's mode/anchor into the modal state — `ML_MODE = TL_MODE`, `ML_ANCHOR = new Date(TL_ANCHOR)`, `ML_CUSTOM_START = TL_CUSTOM_START`, `ML_CUSTOM_END = TL_CUSTOM_END` — clears `ML_DATA/ML_DIRTY/ML_SAVING`, un-hides the modal, then calls `loadMemberLogDetail()`. The live render path is **`_renderMemberLogModal()`** (called from `loadMemberLogDetail`, `_mlPrevWeek`, `_mlNextWeek`, `_mlGoToday`). A legacy `renderMemberLogDetail()` / `mlNav()` pair still exists in the file but is not on the active path (the modal's `‹`/`›` buttons call `_mlPrevWeek`/`_mlNextWeek`).

**Mode-awareness.** `_mlDays()` returns the day list per `ML_MODE`:
- `month` → every day of the anchor month (1st → last).
- `custom` → every day from `ML_CUSTOM_START` to `ML_CUSTOM_END`.
- `week` / `day` → Mon→Sun (7 days) of `ML_ANCHOR`.

`_renderMemberLogModal` sets the label via `_mlRangeLabel(isoDays)` ("June 2026" in month mode; a date range otherwise) and **hides the prev/next arrows for fixed-range modes**: `var isFixedRange = (ML_MODE === 'month' || ML_MODE === 'custom'); document.querySelectorAll('#member-log-modal .tl-nav-btn').forEach(b => b.style.visibility = isFixedRange ? 'hidden' : '')`. So opening a month-mode card shows the whole month with arrows hidden; a custom-mode card shows the custom range with arrows hidden; week/day cards show a 7-day grid with arrows visible.

On open, `loadMemberLogDetail()` chooses the anchor by mode: in month mode it picks today's week if the team anchor is the current month, else the first week of that month; otherwise it normalises the team anchor to Monday (`_mlWeekMonday`). It then fetches the correct server range — full calendar month for `month`, exact `ML_CUSTOM_START/END` for `custom`, a ±8-week window for day/week — via `getMemberWorkLogs(targetId, APP._verifiedEmail, start, end)`. `_mlNeedsReload()` recomputes the needed range per mode so navigation only re-fetches when the data falls outside `ML_LOADED_START`/`ML_LOADED_END`; within range, `_mlPrevWeek`/`_mlNextWeek`/`_mlGoToday` just re-render. For intern members, `getMemberWorkLogs` routes to `_getInternWlLogs` (the modal then renders free-text attendance inputs instead of the dropdown).

**Editable grid.** Each day is a row `<tr id="ml-tr-{iso}">` in a `<table class="wl-week-table">` with columns Day / Attendance / Work Update — 1st Half / Work Update — 2nd Half / Extra Hrs / Remark / Status / Comments:

| Cell | Control | id / class |
|---|---|---|
| Attendance | `<select>` (regular) or `<input type="text">` (intern) | `class="wl-inp wl-att-sel ml-att" data-iso="{iso}"`; options `WL_ATTENDANCE_OPTIONS`; `onchange="_mlOnAttChange('{iso}')"` |
| Work 1st / 2nd half | `<textarea>` + `↵` add-item button, chips below | `id="ml-cust-h1-{iso}" class="wl-cust-inp wl-inp ml-ta"`; chips in `id="ml-chips-h1-{iso}"` |
| Extra Hrs | `<input type="number" min=0 max=12 step=0.5>` | `id="ml-eh-{iso}" class="wl-inp wl-hrs-inp ml-hrs"` |
| Remark | `<input type="text">` | `class="wl-inp ml-remark" data-iso="{iso}"` |
| Status | `<select>` (`WL_STATUS_OPTIONS`) | `class="wl-inp wl-status-sel" data-date="{iso}"` |
| Comments | `<input type="text">` | `class="wl-inp ml-comment" data-date="{iso}"` |

Work updates use the same chip model as the personal Work Log: typed text becomes a chip on Enter (no Shift) or via the `↵` `wl-cust-add-btn`, serialized to a `'; '`-delimited string. Off-day attendance (Week Off / Alt Week Off / Holiday) renders a "Worked today" toggle (`id="ml-odt-{iso}"`, checkbox `ml-odc-{iso}`) that re-enables the work fields (`_mlToggleOffDayWork`). A `+OT` badge `<span id="ml-ot-badge-{iso}" class="wl-ot-badge">` is toggled by `_mlUpdateOtBadge` via `_wlShowsOtBadge`. Each row has a save indicator `<span id="ml-as-{iso}">` showing "Saving…" / "Saved".

**Inline editing is gated to managers** — the modal is only reachable from the manager-only Team Work Logs view, and every persist call (`adminSubmitWorkLog` / `adminUpdateWorkLog` / `adminSaveInternWorkLog`) is server-checked with `_isManager(user.role)` and throws `'Not authorized.'` otherwise. Status + Comments columns are the manager-only review fields.

**Auto-save queue.** Edits mark the row dirty (`ML_DIRTY[iso] = true`) and call `_mlAutoSave(iso)`, which shows "Saving…" immediately and debounces 500 ms (`ML_DEBOUNCE[iso]`) before firing `_mlSaveEntry(iso, true)`. Save state machine:
- `_mlSaveEntry` early-returns if `ML_SAVING[iso]` is already true (re-queuing via `_mlAutoSave` when called as an auto-save).
- On entry it sets `ML_SAVING[iso] = true` and `delete ML_DIRTY[iso]` **before** the GAS call, so edits arriving mid-flight re-set the dirty flag.
- `onDone` clears `ML_SAVING[iso]`; if the row is dirty again it re-queues `_mlAutoSave`, else shows "Saved".
- `onFail` clears `ML_SAVING`, shows error status, and (for auto-saves) retries if still dirty.
- New entries call `adminSubmitWorkLog` and store the returned `logId`; existing entries call `adminUpdateWorkLog(logId, ...)`. Intern members route to `adminSaveInternWorkLog`.

`_mlOnBlur(inputEl)` commits any pending textarea text as a chip on blur, then triggers the debounced save. `_renderMemberLogModal` guards against false dirty during render with `ML_RENDERING = true/false`, and on/change handlers check `if (ML_RENDERING) return`.

### 6.4 Day View (and By Date tab)

In the **By Member** tab with `TL_MODE === 'day'`, `_tlMemberDayCards(members, logMap, date)` renders one `.tlm-card` per member for the single anchored date:
- members with a log: green `<span class="badge">Done</span>` (plus a `.tlm-tentative-badge` if `Status === 'Tentative'`), hours via `_attEffHours` in `<span class="tlm-hours">`, 1st-half work in `.tlm-tasks`, 2nd-half in `.tlm-desc`, and any remark/blocker in `.tlm-tags` as `<span class="wl-blocker">⚠ …</span>`.
- members with no log: a `.tlm-card missing` card with a grey avatar, `<span class="badge">✗ Missing</span>`, and a `.tlm-missing-note` "Click to add work log." Clicking opens the modal to add a log.

Separately, the **By Date** tab (`TL_TAB === 'date'`, any mode) is handled by `_tlByDate()`: it filters `TL_RAW` to the range, optionally to the `tl-member` selection, groups entries by date (`.team-log-day` → `.tld-date` header), and lists each submission as `.tld-entry` with avatar, employee name (`.tld-emp`), team (`.tld-team`), hours (`.tld-hours`), and the 1st/2nd-half work text. Dates are sorted newest-first; the subtitle reports total entries across N days. The By Date list is read-only (no inline edit controls — entries are not clickable cards).

## Verification — Team Work Logs

- [ ] Sign in as a Team Member (non-manager) -> the "Team Work Logs" sidebar item (`nav-item.nav-mgr-only`, `monitoring` icon) is hidden.
- [ ] Sign in as TC/TF/Admin/SA and open Team Work Logs -> `loadTeamLogs()` runs and `#team-logs-container` populates; `#tl-sub` shows "{range} — {active} / {total} members active".
- [ ] As a TC/TF -> only own-team members appear; as Admin/SA -> all members appear grouped under `.tl-team-hdr` team headers.
- [ ] Click `Day`/`Week`/`Month`/`Custom` (`#tl-mode-*`) -> only the clicked button has the `active` class and the card layout switches (day cards / week dots / month progress cards).
- [ ] Switch to `Custom` -> `#tl-custom-bar` is shown and the `.tl-range-bar` nav bar becomes `visibility:hidden`; clicking `‹`/`›` (`tlNav`) does nothing.
- [ ] In Custom, pick from > to and Apply -> toast "Start date must be before end date."; pick a >90-day span -> toast "Custom range cannot exceed 90 days."
- [ ] Toggle `By Member` / `By Date` (`#tl-tab-member` / `#tl-tab-date`) -> render switches and the `#tl-member` dropdown is hidden in By Member, shown in By Date.
- [ ] **Month not stuck:** in Month mode confirm `.tlm-card` progress cards render (no perpetual spinner / no inline "Error rendering cards"); navigate `‹`/`›` to an adjacent month -> cards re-render for that month.
- [ ] **OT badge:** find a member with logged Extra Hours and/or Extra Full/Half days in Month mode -> the orange `+{n} OT` pill appears in `.tlm-hours-row`; a member with zero overtime shows no OT pill.
- [ ] **OT value:** for a member with 2 Extra Full Days, 1 Extra Half Day, and 3 in the Extra Hours column -> OT badge reads `+25 OT` (2×9 + 1×4 + 3).
- [ ] **Badge counts:** member attendance breakdown pills appear in order P → EF → EH → LF → LH → H → W → AW, each as "{label}: {count}", and the counts match the member's logs for the range.
- [ ] **Badge colours:** P pill is green (`#e8f5e9`/`#2e7d32`), LH pill is amber (`#fff8e1`/`#f57f17`), H pill is blue (`#e3f2fd`/`#1565c0`).
- [ ] Click any member card (`.tlm-card`) -> `openMemberLogDetail` un-hides `#member-log-modal` and `#ml-header-title` shows "{name} — Work Log".
- [ ] **Modal opens in correct mode:** open a card while team view is in **Month** mode -> modal shows the full month in `#ml-week-label` ("June 2026"). Open while in **Custom** mode -> modal shows the custom date range. Open while in **Week/Day** mode -> modal shows a 7-day Mon–Sun grid.
- [ ] **Arrows hidden:** in the modal, when opened in Month or Custom mode the `.tl-nav-btn` `‹`/`›` are `visibility:hidden`; in Week/Day mode they are visible and clicking them (`_mlPrevWeek`/`_mlNextWeek`) shifts the week.
- [ ] Edit a day's Extra Hrs / textarea / Status / Comments in the modal -> the `#ml-as-{iso}` indicator shows "Saving…" then "Saved" within ~1s (500ms debounce + round-trip) and no duplicate row is created on repeated quick edits.
- [ ] Edit a member with no prior log for a day -> `adminSubmitWorkLog` creates the row and a `logId` is stored (subsequent edits route through `adminUpdateWorkLog`).
- [ ] Open a card for an Intern member -> the Attendance column is a free-text `<input>` (placeholder "e.g. 9, 8.5, Holiday") and saves route to `adminSaveInternWorkLog`.
- [ ] Day mode, By Member -> a member with no log shows a `.tlm-card.missing` card with "✗ Missing" badge and "Click to add work log."; clicking opens the modal.
- [ ] By Date tab -> entries group under date headers (`.tld-date`) newest-first; selecting a person in `#tl-member` filters to that member only.


---

## 7. Team — Leave Approvals

The Leave Approvals view (`<div class="view hidden" id="view-leave-approvals">`, index.html) is a manager-only queue of pending leave requests. The page header (`.ph`) shows the title "Leave Approvals" and sub-text "Pending leave requests from your team". All content renders into `<div id="leave-approvals-container">`.

### Navigation & badge

The sidebar nav item carries an unread-count badge `<span class="nav-badge hidden" id="badge-leave-approvals">0</span>` (index.html line 1848). `updateLeaveBadge(count)` (app.js.html) sets `badge-leave-approvals` text and toggles the `hidden` class when `count` is 0. The count comes from `APP._pendingLeaveCount` in the initial payload and is refreshed after each approve/reject by re-calling `getInitialPayload` and reading `pendingLeaveCount`. Backend `getPendingLeaveCount(email)` (leaves.gs) returns the count of pending leaves: all for admins, only direct-reports (employees whose `Manager_ID === user.empId`) for non-admin managers; returns 0 for non-managers.

### Loading & list rendering

`navigate('leave-approvals')` calls `loadLeaveApprovals()` (app.js.html line 12839). It shows a "Loading..." empty state (`<span class="material-symbols-outlined">hourglass_empty</span>`), then calls backend `getPendingLeaves(APP.currentUser.email)`.

`getPendingLeaves(email)` (leaves.gs) requires `_isManager(user.role)` (throws "Not authorized." otherwise). It returns only `Status === 'Pending'` leaves; admins see all, non-admin managers see only leaves where the requester's `Manager_ID` equals the manager's `empId`. Each row is augmented with an `Emp_Name` field built from the employee's first/last name (falling back to email, then Emp_ID).

`renderLeaveApprovals(leaves)` builds a `<div class="tbl-wrap"><table>` with header columns: **Employee, Type, Start, End, Days, Reason, Requested,** and an unlabeled actions column. When there are no pending requests it shows `emptyState('No pending leave requests', 'All caught up!')`.

| Column | Source field | Rendering |
|---|---|---|
| Employee | `l.Emp_Name` (fallback `l.Emp_ID`) | bold text |
| Type | `l.Leave_Type` | `pill()` |
| Start | `l.Start_Date` | `fmtDate()` |
| End | `l.End_Date` | `fmtDate()` |
| Days | `l.Days` (default 1) | plain text |
| Reason | `l.Reason` (fallback `—`) | escaped text |
| Requested | `l.Created_At` | `fmtDate()` |
| Actions | — | Approve / Reject buttons |

### Approve / Reject actions

Each row's last cell holds two buttons:
- Approve: `<button class="btn btn-sm btn-accent" onclick="reviewLeave(this,'<Leave_ID>','Approved')">Approve</button>`
- Reject: `<button class="btn btn-sm btn-danger" onclick="reviewLeave(this,'<Leave_ID>','Rejected')">Reject</button>`

`reviewLeave(btn, leaveId, status)` (app.js.html line 12879):
- For **Rejected**, it prompts via `prompt('Reason for rejection (optional):')`; cancelling (null) aborts. The entered text becomes the review note.
- For **Approved**, it shows `confirm('Approve this leave request?')`; cancelling aborts.
- It sets the button to a loading state (`_btnLoading`), then calls `reviewLeaveRequest(leaveId, status, notes, APP.currentUser.email)`.
- On success it toasts ("Leave request approved." with type `success`, or "...rejected." with type `warn`), reloads the queue (`loadLeaveApprovals()`), and refreshes the leave badge.

Backend `reviewLeaveRequest(leaveId, status, notes, email)` (leaves.gs):
- Requires `_isManager(user.role)` ("Not authorized to review leave requests.").
- Rejects any status not in `['Approved','Rejected']` ("Invalid status.").
- Rejects if the leave is not found or is no longer `Pending`.
- **Manager scoping:** non-admins may only review their direct reports — it looks up the requester in Employees and throws "Not authorized to review this leave request." unless `emp.Manager_ID === user.empId`.
- Writes `Status`, `Reviewed_By` (email), `Reviewed_At` (`_nowTs()`), and `Review_Notes`.
- On **Approved** it calls `_tryCalLeaveSync(..., 'CREATE')` to create a calendar event; on **Rejected** with an existing `Cal_Event_ID` it deletes the event. Always writes an audit entry (`APPROVED_LEAVE` / `REJECTED_LEAVE`).

### Leave types & Half Day rule (context)

Leave types are defined in the request modal `<select class="fc" id="lv-type">` (index.html line 3486): Annual Leave, Sick Leave, Casual Leave, Maternity Leave, Paternity Leave, Unpaid Leave, and `<option value="Half Day">Half Day</option>`. Backend `submitLeaveRequest` (leaves.gs) enforces that **Half Day must be a single day** (`start_date === end_date`, else "Half Day leave must be a single day.") and fixes `Days` at `0.5`; all other types compute `Days` as the inclusive day span. (Submitting a leave is done from the My Leaves view, not from Leave Approvals.)

### Verification — Leave Approvals

- [ ] Log in as a Team Captain and open the Leave Approvals nav item -> the view `#view-leave-approvals` shows with title "Leave Approvals" and only pending requests from direct reports appear in `#leave-approvals-container`.
- [ ] Submit a leave as a team member whose Manager_ID is the logged-in TC -> the request appears as a new row (Employee, Type pill, Start, End, Days, Reason, Requested) in the manager's queue and the `#badge-leave-approvals` count increments.
- [ ] Click **Approve** on a row and confirm the dialog -> a `success` toast "Leave request approved." shows, the row disappears, and the badge count decrements.
- [ ] Click **Reject**, type a reason in the prompt, and confirm -> a `warn` toast "Leave request rejected." shows and the row disappears.
- [ ] Click **Reject** and press Cancel on the prompt -> nothing happens (no server call).
- [ ] As a non-admin manager, attempt to review a leave from someone outside your reports (e.g. via a stale row) -> the backend returns an error "Not authorized to review this leave request." surfaced as an error toast.
- [ ] Submit a Half Day leave with different start/end dates -> backend rejects with "Half Day leave must be a single day."

---

## 8. Team — Team Members

The Team Members view (`<div class="view hidden" id="view-team-mgmt">`, index.html line 2351) is the manager workspace for their own team. The header shows "Team Members" / "Members in your team". It contains three pending-request containers stacked above the member table:

- `<div id="team-pending-registrations">` — pending registration requests
- `<div id="team-pending-profile-updates">` — pending profile-change requests
- `<div id="team-pending-ddr">` — pending due-date change requests

The member table is `<div class="tbl-wrap"><table>` with header columns **Employee, Role, Team, Reports To, Open Tasks, Actions** and body `<tbody id="team-mgmt-body">`.

> Note: there is **no `getTeamMembers` backend function**. `renderTeamMgmt()` (app.js.html line 6344) builds the member list entirely client-side from the already-loaded `APP.employees`. The pending-request lists are loaded from the server.

### Rendering (`renderTeamMgmt`)

For managers (`_isManager(u.role)`), three loaders run:
- `_loadPendingRegs('team-pending-registrations', true)` — `myOnly=true`, so only requests where this manager is the designated manager. Calls `getRegistrationRequests(email, myOnly)`; rendered by `_renderRegCards` into `.reg-card` blocks with Approve/Reject buttons (`approveReg` / `rejectReg`).
- `_loadPendingProfileUpdates('team-pending-profile-updates')` — calls `getPendingProfileRequests(email)`; rendered by `_renderProfileUpdateCards` (green `.reg-card`, "Profile Update" badge) with `approveProfileUpd` / `rejectProfileUpd`.
- `_loadPendingDueDateRequests('team-pending-ddr')` — calls `getDueDateRequests(email)`; rendered by `_renderDueDateRequestCards` (indigo `.reg-card`, "Date Change" badge) with `approveDueDateReq` / `rejectDueDateReq`.

The member table renders only employees whose `Team` or `Sub_Department` matches the current user's team (`e.Team === myTeam || e.Sub_Department === myTeam`). Each row shows:
- Employee: `.avatar-sm` initial + bold name + small email.
- Role: `pill(e.Role)`.
- Team: `e.Team` (or `—`).
- Reports To: manager name resolved via `findEmp(e.Manager_ID)`.
- Open Tasks: count of `APP.tasks` where the member is an assignee and `_isOpen(t.Status)`.
- Actions: a **Change Role** button `<button class="btn btn-ghost" ... onclick="openChangeRoleModal('<Emp_ID>','<Name>','<Role>')">Change Role</button>` shown only when `canChange` is true, otherwise `—`.

`canChange` requires: the row is not the current user, the target is in the same team (Team Captains are restricted to their own team), and `_allowedNewRoles(u.role, e.Role).length > 0`. Empty list renders "No members found for your team".

> There is **no "Add Member" button** in this view. New members enter the org via the registration approval flow (the pending-registration cards), not a direct add form. The "+ New Project" / "+ Request Leave" style add buttons do not exist here.

### Due-date request badge

The sidebar nav item carries `<span class="nav-badge hidden" id="badge-ddr">0</span>` (index.html line 1852). `_ddrUpdateBadge()` (app.js.html line 6215) calls `getPendingDueDateCount(APP._verifiedEmail)` and sets/hides `badge-ddr` based on the returned count.

### Change Role modal (`change-role-modal`)

`openChangeRoleModal(empId, empName, currentRole)` (app.js.html line 6439) populates the static modal `<div class="modal-bg hidden" id="change-role-modal">` (index.html line 3669):
- `<div id="cr-emp-name">` — employee name.
- `<span id="cr-current-role">` — current role.
- `<select class="fc" id="cr-role-select">` — options come from `_allowedNewRoles(actorRole, currentRole)`, with the current role pre-selected.
- Footer buttons: Cancel (`closeModal('change-role-modal')`) and `<button class="btn btn-primary" id="cr-save-btn" onclick="submitRoleChange()">Save Role</button>`.

`_allowedNewRoles(actorRole, targetCurrentRole)` (mirrored in app.js.html line 212 and auth.gs line 1786):

| Actor | Allowed target roles | Restriction |
|---|---|---|
| Super Admin | Team Member, Intern, Team Facilitator, Team Captain, Admin, Super Admin | none |
| Admin | Team Member, Intern, Team Facilitator, Team Captain, Admin | cannot touch a Super Admin or another Admin (returns `[]`) |
| Team Captain | Team Member, Intern, Team Facilitator, Team Captain | only when target is currently Team Member or Intern |
| (others) | `[]` | no role-change rights |

`submitRoleChange()` calls `changeEmployeeRole(_crEmpId, newRole, email)`. On success it toasts "Role updated to <newRole>.", closes the modal, and calls `refresh()`.

Backend `changeEmployeeRole(targetEmpId, newRole, email)` (auth.gs line 1803) re-validates server-side: blocks self-edit ("You cannot change your own role."), re-checks `_allowedNewRoles` (authorization + assignable-role check), and for a Team Captain confirms the target is in the same `Team` ("You can only change roles of members in your own team."). It writes `{ Role: newRole }`, audits `ROLE_CHANGE`, and returns the old/new role.

### Organisation view parity

The admin-only Organisation view (`#view-org-page`, rendered by `renderOrgPage()`, covered in Section 10) reuses the same three pending containers (`org-pending-registrations` / `org-pending-profile-updates` / `org-pending-ddr` with `myOnly=false`) and the same Change Role flow, but lists **all** employees with an extra Sub_Department line.

### Verification — Team Members

- [ ] Open the Team Members nav item as a Team Captain -> `#view-team-mgmt` lists only employees in your Team/Sub_Department in `#team-mgmt-body`.
- [ ] Have a team member request a profile change (e.g. team change) where you are their manager -> a green "Profile Update" card appears in `#team-pending-profile-updates` with Approve/Reject buttons.
- [ ] Request a due-date change on a task you do not own -> a "Date Change" card appears in `#team-pending-ddr` and the `#badge-ddr` count increments.
- [ ] Click **Change Role** on a Team Member row -> the `#change-role-modal` opens showing the employee name, current role, and a `#cr-role-select` whose options match `_allowedNewRoles` for your role.
- [ ] As a Team Captain, confirm the Change Role dropdown lists only Team Member, Intern, Team Facilitator, Team Captain and offers no option for an existing TF/TC/Admin row (button shows `—`).
- [ ] Save a role change -> a "Role updated to X." toast appears, the modal closes, and the member's Role pill updates after refresh.
- [ ] As an Admin, open the Change Role modal for a Super Admin -> the button is absent (`—`) because `_allowedNewRoles` returns `[]`.

---

## 9. Company — All Tasks / Team Tasks / Projects

These four views reuse the My Tasks task-sheet machinery (same filter bar, same multi-select column filters, same inline cell editing, same group-by toggle) and add scope/team controls on top.

| View | Element id | Render fn | Scope mechanism |
|---|---|---|---|
| Team Tasks | `view-team-tasks` | `renderTeamTasks()` (line 3352) | admin client-side filter to own team; assignment tabs |
| Team Projects | `view-team-projects` | `renderTeamProjects()` (line 3419) | admin client-side filter to own team; assignment tabs |
| All Tasks | `view-all-tasks` | `renderAllTasks()` (line 6007) | scope `<select id="scope-all-tsk">` |
| All Projects | `view-all-projects` | `renderAllProjects()` (line 6060) | scope `<select id="scope-all-prj">` |

### Shared task-sheet UI (Team Tasks & All Tasks)

Both task views use `<table class="task-sheet">` with identical structure to My Tasks:

1. **Header row** of sortable columns — each `<th class="ts-sort-th" onclick="_tskSortClick('<vid>','<key>')">` for Function, Sub-Function, Task, Assigned To, Assigned By, Project, Status, Priority, Due Date, plus a leading priority bar `<th class="ts-pribar">` and a trailing 34px actions column. Sort indicator spans use ids like `ts-si-team-status` / `ts-si-all-status`.
2. **Filter row** `<tr class="ts-filter-row">` — one `<select class="ts-cf-inp" ...>` (or date input) per column, e.g. `tf-team-fn` / `tf-all-fn`, `tf-team-status` / `tf-all-status` (with the full Task-status option list), `tf-team-pri` / `tf-all-pri`, `tf-team-due` / `tf-all-due`. A clear-filters button `<button class="ts-cf-clear" onclick="_clearTskFilters('team'|'all')">` (Material icon `filter_alt_off`) resets them. Column filters are applied by `_tskApplyColFilters(tasks, vid)`.
3. **Add-tasks trigger** `<tr class="ts-foot-trig" id="ts-trig-team|all">` with an "Add Tasks" link (`_tskBatchOpen('team'|'all')`) that reveals the batch-add panel `<tr class="ts-add-row hidden" id="ts-add-team|all">` (Add Row / Cancel / Save All via `_atmSaveAll`).
4. **Body** `<tbody id="team-tasks-body">` / `<tbody id="all-tasks-body">` plus an alternate container `#team-tasks-alt-body` / `#all-tasks-alt-body` used by non-function group modes.

The group-by toggle is injected into `#team-tasks-grp-toggle` / `#all-tasks-grp-toggle` via `_tskGrpToggleHtml(vid)`; mode is held in `_TSK_GRP_MODE[vid]` with values `function` (default), `date`, `week`. In `function` mode rows render via `_renderGroupedTasksHtml(tasks)`; otherwise via `_renderDateGroupedTasksHtml` / `_renderWeekGroupedTasksHtml`.

**Inline status edit (shared with My Tasks):** each row is built by `_tskRowHtml` → `_tskCellHtml`. In read mode the Status cell renders `pill(t.Status)` and Priority renders `badge(t.Priority)` (line ~9980). Clicking an editable cell calls `_tskEdit(taskId, col, td)` which swaps it to a `<select class="ts-input">` populated from `TASK_STATUSES` (Status) or Low/Medium/High/Critical (Priority) and commits on change. Each row also has action buttons: Edit row (`_tskRowEditStart`), Delete (`confirmDeleteTask`, managers only), Open detail (`openTaskDetail`), and an attachments badge.

### Team Tasks scoping & assignment tabs

`renderTeamTasks()` sets `_tskGrpVid = 'team'`, populates filter selects, then for SA/Admin filters `APP.tasks` **client-side to the admin's own team**: it builds `myIds` from `_myTeamEmpIds()` (always adding the admin themselves), collects the admin team's project ids, and includes a task if it belongs to the team (`_belongsToMyTeam`) or is unassigned but in a team project. Assignment tabs `<button class="tl-tab asgn-tab" data-vid="team-tsk" data-val="all|team|by-team" onclick="setAsgnFilter('team-tsk',...)">` (labels **All / To Team / By Team**) drive `_applyAsgnTaskFilter(tasks, 'team-tsk')`.

`renderTeamProjects()` mirrors this: SA/Admin client-side filter to own team (by Owner_IDs or `_belongsToMyTeam`), plus a status `<select id="tp-status">`, a search `<input id="tp-search">`, the same All/To Team/By Team tabs (`data-vid="team-prj"`), and a **+ New Project** button (`openNewProjectModal()`). Cards render into `<div class="cards-grid" id="team-projects-grid">`.

### All Tasks / All Projects scope selector

`renderAllTasks()` uses a scope `<select class="scope-select" id="scope-all-tsk" onchange="setAllScope('all-tsk',this.value)">` inside `.scope-filter-wrap` (label "Scope:"). `_populateScopeSelect('all-tsk')` fills it with a default `Organization (All Teams)` option plus one option per distinct `Team` name from `APP.employees` (sorted). When a team is selected (`_ALL_SCOPE['all-tsk']`), tasks are filtered by `_getTeamIds(team)` + `_belongsToMyTeam`. Non-admin managers viewing this page are auto-scoped to their own team (`_ALL_SCOPE['all-tsk'] = APP.currentUser.team`).

`renderAllProjects()` uses the parallel `<select id="scope-all-prj" onchange="setAllScope('all-prj',this.value)">`, the same team-scoping logic (also matching by `Owner_IDs`), a **+ New Project** button, and renders grouped project cards into `<div class="cards-grid" id="all-projects-grid">` via `_renderProjGrouped(_sortProjHierarchy(projs))`.

`setAllScope(vid, team)` (line 3242) stores the chosen team in `_ALL_SCOPE[vid]` and re-renders the matching view.

### Verification — All Tasks / Team Tasks / Projects

- [ ] Open Team Tasks as an Admin -> `#view-team-tasks` shows the `task-sheet` table populated only with tasks belonging to the admin's own team.
- [ ] Click the **To Team** tab in Team Tasks -> only tasks assigned to your team members remain (assignment filter `team-tsk=team`).
- [ ] Type a status into the `#tf-team-status` filter select -> the task list narrows to that status and the clear-filters button (`filter_alt_off`) restores the full list.
- [ ] Click a Status cell in a Team Tasks row -> it becomes a `<select class="ts-input">` of `TASK_STATUSES`; choosing a new value commits the change and the cell re-renders as a status pill.
- [ ] Open All Tasks as an Admin and pick a team in the `#scope-all-tsk` Scope dropdown -> the list filters to that team; selecting "Organization (All Teams)" restores all tasks.
- [ ] Open All Tasks as a non-admin manager -> the Scope dropdown is auto-set to your own team.
- [ ] Open Team Projects -> project cards render in `#team-projects-grid`, and `+ New Project` opens the new-project modal.
- [ ] Pick a team in the `#scope-all-prj` dropdown on All Projects -> `#all-projects-grid` filters to projects owned by / belonging to that team.

---

## 10. Company — Organisation

This section covers two distinct views: the **Organisation** roster page (`view-org-page`) and the **Org Chart** (`view-org-chart`).

### Organisation roster (`view-org-page`, `renderOrgPage`)

`<div class="view hidden" id="view-org-page">` (index.html line 2365), header "Organisation" / "All members across the organisation". Structure mirrors Team Members: three pending containers — `org-pending-registrations`, `org-pending-profile-updates`, `org-pending-ddr` — above a `<div class="tbl-wrap"><table>` with columns **Employee, Role, Team, Reports To, Open Tasks, Actions** and `<tbody id="org-page-body">`.

`renderOrgPage()` (app.js.html line 6385):
- Loads all pending requests across teams: `_loadPendingRegs('org-pending-registrations', false)` (`myOnly=false`), `_loadPendingProfileUpdates('org-pending-profile-updates')`, `_loadPendingDueDateRequests('org-pending-ddr')`.
- Lists **every** employee from `APP.employees` (not team-scoped). Each row shows avatar+name+email, role pill, team (with a smaller Sub_Department line when present), manager name (`findEmp(e.Manager_ID)`), open-task count, and a **Change Role** button when `e.Emp_ID !== u.empId && _allowedNewRoles(u.role, e.Role).length > 0`.
- Empty list renders "No employees found".

> Note: there is **no `getTeamsAndDivisions` backend function.** The roster is built entirely from client-side `APP.employees`; division/sub-department grouping is derived inline (and from `TEAM_HIERARCHY` in the Org Chart, below).

### Org Chart (`view-org-chart`, `renderOrgChart`)

`<div class="view hidden" id="view-org-chart">` (index.html line 2619), header "Org Chart" / "Leveraged Growth — Company Structure". Layout:
- Header actions: **Reset** (`renderOrgChart()`), **Expand All** (`orgExpandAll()`, Material icon `unfold_more`), **Collapse** (`orgCollapseAll()`, `unfold_less`).
- A colour legend `<div class="oc-legend" id="oc-legend">`.
- The pannable canvas `<div id="org-chart-wrap"><div id="oc-viewport"><div class="oc-tree" id="org-chart-container"></div></div></div>`.
- A floating zoom bar `<div class="oc-zoom-bar">`: **Find me** (`ocFindMe()`, icon `my_location`), zoom out (`ocZoom(-1)`, `remove`), a live level label `<span id="oc-zoom-label">100 %</span>`, zoom in (`ocZoom(1)`, `add`), and **Reset view** (`ocResetView()`, `fit_screen`).

`renderOrgChart()` (line 13840) resets zoom/pan state, shows a "Loading org chart…" placeholder, and calls backend `getOrgChartData()`. `getOrgChartData()` (auth.gs line 817) returns active employees with `empId, name, role, designation, team, subDept, managerId` (no email, no auth needed beyond the implicit call).

`_buildOrgChart(employees)` (line 13864) groups employees `team → subDept → []`, then builds nodes for **all** teams in `TEAM_HIERARCHY` (plus any extra teams in data) so empty teams/sub-departments still appear. Team/sub-dept heads are chosen by role priority (`_OC_ROLE_PRIORITY`: Super Admin 1 → Admin 2 → Team Captain 3 → Team Facilitator 4 → Team Member 5). A root card "Leveraged Growth" (colour `#1a237e`) sits above the team cards. Cards render via `_ocRenderCard` (`.oc-card`, avatar `.oc-av` with initials from `_ocInitials`, name `.oc-name`, head `.oc-head`, role `.oc-role`, employee count `.oc-ec`). The tree is built as flat sibling rows (`_ocBuildFlatRows`) so expanding a node never shifts other cards. The chart auto-expands the root and auto-fits via `ocResetView()`.

**Division colours** (`_OC_TEAM_COLORS`, line 13672):

| Team | Colour |
|---|---|
| 1. Founder's Office | `#6a1b9a` |
| 2. Student Success | `#0277bd` |
| 3. Knowledge | `#00695c` |
| 4. Growth (Marketing) | `#e65100` |
| 5. Tech | `#1565c0` |
| 6. Consulting | `#880e4f` |
| 7. Operations - PP & Admin | `#2e7d32` |
| 8. Operations - FP&A | `#6a4c93` |
| (fallback) | `#455a64` |

`_ocRenderLegend()` (line 14278) renders one `.oc-legend-item` per team node with a `.oc-legend-dot` in the team colour.

**Zoom / pan:**
- `_ocApplyTransform(animate)` writes `translate(panX,panY) scale(zoom)` onto `#oc-viewport` and updates `#oc-zoom-label`.
- `ocZoom(dir)` steps zoom by ±0.15 clamped to [0.2, 3], keeping the wrap centre as the focal point.
- `ocResetView()` measures natural content size and computes a fit-zoom (clamped to [0.2, 1]) so the whole tree is centred.
- `ocFindMe()` expands the root if needed, locates the current user's team card (`oc-card-root_<idx>`), pans it to centre at 100%, and briefly highlights it with a blue box-shadow.
- Drag-to-pan state (`_ocDrag`, `_ocPanX/Y`) is wired via `_ocAttachListeners()`.

### Verification — Organisation

- [ ] Open the Organisation nav item as an Admin -> `#view-org-page` lists every employee in `#org-page-body` with role, team (+sub-dept line), manager, and open-task count.
- [ ] Confirm pending registration / profile / due-date cards in the Organisation view show requests from all teams (not just yours).
- [ ] Open the Org Chart -> `#org-chart-container` renders the "Leveraged Growth" root plus one card per team, including teams with zero employees.
- [ ] Check the `#oc-legend` -> there is one coloured dot per team matching `_OC_TEAM_COLORS` (e.g. Tech `#1565c0`, Founder's Office `#6a1b9a`).
- [ ] Click **Zoom in** / **Zoom out** -> the `#oc-zoom-label` percentage changes and the tree scales, clamped between 20% and 300%.
- [ ] Click **Find me** -> the chart expands and pans to centre your team's card with a brief blue highlight.
- [ ] Click **Reset view** -> the whole chart re-fits and re-centres in the viewport.
- [ ] Click **Expand All** then **Collapse** -> all team/sub-dept nodes expand, then return to collapsed.

---

## 11. Directory

The Directory view (`<div class="view hidden" id="view-directory">`, index.html line 2436) presents employee cards in two tabs. Header: "Directory" with a dynamic sub-text `<div id="dir-sub">` and a search box `<input class="fc" id="dir-search" placeholder="Search by name, role, team…" oninput="filterDirectory()">`.

Tab bar `<div class="dir-tabs">`:
- `<button class="dir-tab active" id="dir-tab-team" onclick="switchDirTab('team')">Team Directory</button>`
- `<button class="dir-tab" id="dir-tab-company" onclick="switchDirTab('company')">Company Directory</button>`

Two panels: `<div id="dir-panel-team">` holding the grid `<div id="dir-grid" class="dir-grid">`, and `<div id="dir-panel-company" class="hidden">` holding `<div id="dir-company-container">`.

### Loading (`loadDirectory`)

`navigate('directory')` calls `loadDirectory()` (app.js.html line 13052). It shows a loading state, calls `getTeamDirectory(APP.currentUser.email)` for the team grid, sets `#dir-sub` to "Members in <team>", and **pre-loads** the company directory in the background via `getCompanyDirectory(...)`. Presence dots are refreshed afterward (`_presRefreshAll()`).

- Backend `getTeamDirectory(email)` (directory-only.gs line 3): returns **only the current user's own team** (active employees with `Team === user.team`) for everyone, each with `empId, name, email, role, designation, team, subDepartment, managerName` (manager name resolved from an Emp_ID→name map), sorted by name. Also returns `isManager`, `isAdmin`, and `teamChatSpaces`.
- Backend `getCompanyDirectory(email)` (directory-only.gs line 43): returns **all** active employees (no role restriction), same field shape, sorted by name, plus `teamChatSpaces`.

### Tab switching & search

`switchDirTab(tab)` (line 13092) toggles the `active` class on the two tab buttons, toggles the `hidden` class on the two panels, clears `#dir-search`, updates `#dir-sub` (e.g. "<n> members in <team>" or "<n> people across all teams"), and renders the active dataset. If company data was not yet pre-loaded it fetches it on demand.

`filterDirectory()` (line 13138) filters the active tab's dataset (`DIR_DATA` for team, `DIR_COMPANY_DATA` for company) by a case-insensitive match across name, role, team, subDepartment, and designation, then re-renders.

### Card rendering

`renderDirectory(employees)` (line 13185) maps each employee through `_dirCardHtml` into `#dir-grid` (empty state "No team members found." with Material icon `group`).

`renderCompanyDirectory(employees)` (line 13194) groups by `team` and renders one section per team: `<div class="dir-team-section">` with a `<div class="dir-team-header">` (Material icon `group`, team name, and a `<span class="dir-team-count">` member count), followed by a nested `.dir-grid` of cards.

`_dirCardHtml(e)` (line 13161) builds each `<div class="dir-card">`:
- Avatar `.dir-card-avatar` (first initial, colour from `_avatarColor(e.empId)`) inside `.dir-card-av-wrap`, with a presence dot `.pres-dot.pres-card-dot` (class from `_presClass(PRES[e.email])`, default `offline`) when the employee has an email.
- Name `.dir-card-name` with a "You" tag for the current user.
- Role via `pill(e.role)`.
- Designation `.dir-card-designation` (when present).
- Team `.dir-card-team` = team, with `· <subDepartment>` appended when present.
- Email `.dir-card-email` (when present).
- Manager `.dir-card-mgr` = "Reports to: <managerName>" (when present).
- For everyone except the current user, a `.dir-card-actions` row with two buttons:
  - **Email** `<button class="btn btn-sm btn-outline" onclick="openChatWindow('https://mail.google.com/mail/?view=cm&to=<email>', ...)">` (Material icon `mail`).
  - **Chat** `<button class="btn btn-sm btn-primary" onclick="openChatWindow('https://mail.google.com/chat/u/0/r/dm/<email>', ...)">` (Material icon `chat`) — opens a Google Chat DM.

### Verification — Directory

- [ ] Open the Directory nav item -> `#view-directory` opens on the **Team Directory** tab and `#dir-grid` shows cards only for your own team; `#dir-sub` reads "Members in <your team>".
- [ ] Click the **Company Directory** tab -> the panel switches, cards are grouped per team under `.dir-team-section` headers each showing a member count, covering all active employees.
- [ ] Type a name/role/team fragment into `#dir-search` -> the visible cards narrow to matches in the active tab (case-insensitive across name, role, team, sub-department, designation).
- [ ] Locate your own card -> it shows a "You" tag and has **no** Email/Chat action buttons.
- [ ] On another person's card, click **Email** -> a Gmail compose window opens addressed to their email.
- [ ] On another person's card, click **Chat** -> a Google Chat DM window opens for that person.
- [ ] Confirm each card shows the manager line "Reports to: <name>" when the employee has a `Manager_ID`, and a presence dot reflecting their online/away/offline state.


---

## 12. Cross-Cutting Features

These features span multiple views, run on server-side triggers, or harden shared data paths. They are largely invisible in everyday navigation but underpin reliability of the Work Log, Work Duration, AI summaries, and registration flows.

### 12.1 AI Weekly Summary

The AI Weekly Summary generates 5–10 past-tense bullet points summarising each employee's previous week of work, drawn from their `Work_Log` (and `Intern_Work_Log`) chips. Backend lives in `src/weekly-summary.gs`.

**Generation model and key**

- Model id is exactly `gemini-2.5-flash` (no `-preview` suffix). The endpoint is built in `_wsGenerateWithAI`:
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=...`
- The API key is read from Script Property `GEMINI_API_KEY` via `PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')`. If unset, the function returns `{ ok:false, error:'GEMINI_API_KEY not set in Script Properties' }`.
- Generation config: `temperature: 0.4`, `maxOutputTokens: 2048`. The prompt explicitly instructs "Write 5 to 10 bullet points", past-tense action verbs, and each bullet prefixed with the `•` character.

**Automatic weekly trigger**

- `generateWeeklySummaries()` is the trigger target, registered in `installTriggers()` (`src/triggers.gs`) as:
  `ScriptApp.newTrigger('generateWeeklySummaries').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(0).inTimezone('Etc/UTC').create();`
  i.e. **Monday 12 AM UTC (= 05:30 IST)**. The `.inTimezone('Etc/UTC')` is required so `.atHour(0)` fires at true midnight UTC rather than midnight IST.
- It computes the just-ended week (Monday→Sunday in UTC via `_wsWeekMonday`), reads active employees, and for each that has work-log data and no existing summary, calls Gemini and upserts a row.
- It is idempotent: the `existing` map (keyed on `Email` for the week) skips employees who already have a summary, and `_wsUpsertSummary` updates rather than duplicates by `Summary_ID`.
- Time-budget guard: if elapsed time exceeds `300000` ms (5 min, under the 6-min GAS limit) it schedules a one-shot continuation trigger 60 s out and stores its id in Script Property `WS_CONT_TRIGGER_ID`; the next run cleans that up and resumes.

**Storage**

- Summaries are stored in the `Weekly_Summary` sheet (`_WS_SHEET = 'Weekly_Summary'`).
- The deterministic key is `Summary_ID = 'WS-' + Emp_ID + '-' + weekStart.replace(/-/g,'')` (e.g. `WS-EMP-001-20260615`). This makes the trigger path and the on-demand path converge to the same row.
- Mutable fields on update: `Emp_Name`, `Content`, `Is_Edited`, `Generated_At`, `Edited_At`, `Edited_By`.

**On-demand "Generate Now"**

- Triggered from the empty-state of the Weekly Summary modal. When `getWeeklySummary` returns `found:false`, `_wsRenderModalContent` (`app.js.html`) renders a `<button class="btn btn-accent btn-sm">` whose `onclick` calls `_wsGenerateNow(weekStart)`; its label is a Material Symbol `auto_awesome` + "Generate Now".
- `_wsGenerateNow` swaps the modal body (`#ws-modal-body`) to a "Generating summary with AI…" spinner, calls server function `generateMyWeeklySummary(APP._verifiedEmail, weekStart)`, then re-reads via `getWeeklySummary`.
- `generateMyWeeklySummary` validates identity, guards against weeks with no logs (`'No work logs found for this week — fill in your work log first.'`), then runs the same `_wsGenerateWithAI` + `_wsUpsertSummary` path.

**Modal and entry point**

- The static modal is `<div class="modal-bg hidden" id="weekly-summary-modal">` in `index.html`, with body container `#ws-modal-body` and footer `#ws-modal-footer`.
- Opened from the Work Log header via `<button class="btn btn-ghost btn-sm" onclick="openWeeklySummaryModal()">` (Material Symbol `summarize`, label "Weekly Summary").
- `openWeeklySummaryModal()` anchors to the currently viewed week (`WL_ANCHOR`), shows a "Loading summary…" state, and calls `getWeeklySummary(APP._verifiedEmail, weekStart)`.
- Bullets are individually editable; `saveWeeklySummary` persists edits and sets `Is_Edited='TRUE'`, `Edited_At`, `Edited_By`.

**MIS Report access control**

- A separate `MIS_Access` sheet (`_MIS_SHEET = 'MIS_Access'`) lists emails permitted to view all employees' summaries.
- `_wsHasMisAccess(email)` returns true only if the lowercased email matches a row in `MIS_Access`; it never throws. `wsCheckMisAccess(email)` is the public wrapper called from `getInitialPayload`, surfacing a `hasMisAccess` flag to the frontend (gates the `#nav-mis-report` nav item, hidden by default with class `hidden`).
- `getMisSummaries(callerEmail, weekStart)` returns `{ ok:false, error:'Access denied' }` for non-MIS emails, otherwise deduplicates rows by `Summary_ID` (keeping the most recently `Generated_At`) and returns all employees' summaries sorted by name.

> NOTE: The default GAS execution limit referenced by the 5-minute budget guard is the standard 6-minute consumer quota; no `LIMIT_MS` constant is defined for this — the literal `300000` is used inline.

### 12.2 Work Duration Tracking

Clock in/out is tracked per employee in the `Work_Duration` sheet (`_WD_SHEET`). The net work duration also surfaces inside the Work Log as an `HH:MM:SS` value.

**Daily auto clock-out (midnight UTC, NOT an 18-hour cap)**

- `wdAutoClockOut()` (`src/work-duration.gs`) is registered in `installTriggers()` to run **hourly** (`.timeBased().everyHours(1)`).
- It computes `todayMidnightUTC = Date.UTC(year, month, date, 0,0,0,0)` — i.e. **00:00 UTC = 05:30 AM IST** — and closes any session whose `Clock_In` is **before** that boundary. There is **no 18-hour elapsed cap**; the cutoff is a fixed daily calendar boundary chosen to fall before anyone starts work, so no live shift is interrupted.

  > WARNING: Any PRD/template claim of an "18-hour auto-close" is stale. The trigger comment at line 25–27 of `triggers.gs` still says "sessions older than 18 hours", but the actual `wdAutoClockOut` body uses the midnight-UTC boundary only and contains no `LIMIT_MS` / 18h logic. Treat the midnight-UTC daily reset as ground truth.

- For each closed session it sets `Clock_Out` to the midnight-UTC instant (stored as an IST wall-clock string `yyyy-MM-dd'T'HH:mm:ss`), computes `Net_Work_Mins` (gross seconds minus stored `Total_Break_Mins`), sets `Status: 'AUTO_CLOSED'`, and appends an audit note `"Auto-closed at midnight UTC (05:30 IST) — …"` to `Notes`. Rows already `COMPLETED`/`AUTO_CLOSED` or without `Clock_In` are skipped.
- After closing it invalidates the Work_Duration cache and best-effort syncs the matching `Work_Log` duration via `_updateWorkLogDuration` (non-fatal).
- `testWdAutoClockOut()` is a dry-run editor helper (`DRY_RUN = true` by default).

**HH:MM:SS display inside Work Log**

- Personal Work Log keeps a client map `WL_DURATIONS` (iso → `'HH:MM:SS'`); team log uses `TL_DURATIONS` (`empId:iso` → `'HH:MM:SS'`).
- `_wlDurHtml(iso, empId)` renders a "Work duration" row per day cell; the value span has id `wl-dur-{iso}` (personal) or `wl-dur-{empId}-{iso}` (team), wrapped in `#wl-dur-wrap-...`. It shows `—` when empty or `00:00:00`, else the `HH:MM:SS` value.
  - WARNING: This row's clock icon is `<i class="ti ti-clock-hour-4">` — a **Tabler-style class**, inconsistent with the rest of the app's Material Symbols. It is the lone remaining `ti-*` reference observed in this area and will only render a glyph if a Tabler font happens to be loaded.
- Durations load asynchronously: `_wlLoadDurationsAsync(start,end)` calls server `getWorkDurationsForDates(email, startDate, endDate)` which returns `{ ok, data: { 'YYYY-MM-DD':'HH:MM:SS' } }`, then `_wlApplyDurations()` patches the spans.
- Server-side, `_wdDurationForDate(email, dateStr)` resolves the employee, computes session seconds via `_wdCalcSessionSecs`, and formats with `_wdSecsToHms`. `submitWorkLog` writes this into the `Work_Log` `Work_Duration` column at save time.

### 12.3 Registration Manager Fallback

`getTeamCaptainByTeam(team, subDept)` (`src/auth.gs`) resolves the manager to assign to a new registrant, with a strict priority order so registration never dead-ends when a team has no Team Captain yet:

| Step | Lookup | Source |
|---|---|---|
| 1a | Active **Team Captain** matching both `Team` and `Sub_Department` | `Employees` sheet (only when `subDept` provided) |
| 1b | Active **Team Captain** matching `Team` only (widened) | `Employees` sheet |
| 2 | Configured **default manager** | Script Property `LGD_DEFAULT_MANAGER_EMAIL` (+ `LGD_DEFAULT_MANAGER_NAME`) |
| 3a | Any active **Super Admin** | `Employees` sheet |
| 3b | Any active **Admin** | `Employees` sheet |
| 4 | Failure | returns `{ ok:false, error:'No Team Captain, Admin, or Super Admin found…' }` |

- Empty `team` short-circuits to `{ ok:true, email:'', name:'' }`.
- The default manager Script Properties are seeded once by editor helper `setDefaultManager()` (currently hardcoded to `priyankadugar.lg@gmail.com` / `Priyanka Dugar`).
- All employee lookups filter to `Is_Active === 'TRUE'` and a non-empty `Email`. Name is `First_Name + ' ' + Last_Name` (falling back to `Email`).

### 12.4 Work Log ID Collision Prevention

Concurrent saves previously risked two records receiving the same CacheService-backed ID. The fix wraps **INSERT paths only** with `LockService` and bypasses the cache when computing the next ID.

**Work_Log (`auth.gs`)**

- `submitWorkLog(record, email)` acquires `LockService.getScriptLock().tryLock(20000)` at the top; on failure returns `{ ok:false, error:'Server busy — please try again in a moment.' }`. The lock is released in `finally`.
- `_wlNextId()` reads the `Work_Log` sheet **directly** via `_getDb().getSheetByName('Work_Log')` (bypassing CacheService so it sees rows a concurrent request inserted but hasn't flushed), scans the ID column for the max numeric suffix on `/^WL-\d+$/`, and returns the next padded id (`WL-00001`, `WL-00042`, …).

**Intern_Work_Log (`intern-work-log.gs`)**

- Equivalent helper `_ilNextId()` reads `Intern_Work_Log` directly, scans `/^IWL-\d+$/`, and returns the next id (`IWL-00001`, …).
- Both `saveInternWorkLog` and `adminSaveInternWorkLog` take the lock **only on the insert branch** (`var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return { ok:false, error:'Server busy — please try again.' }`), release in `finally`, and call `_ilNextId()` inside the lock.

> The UPDATE branches (known `Log_ID`, upsert match on Emp_ID + Date) are intentionally **not** locked — only inserts need atomic ID allocation.

### 12.5 Auto-Save Race Safety

The Work Log saves silently as the user edits (no Save button required). Several state vars and guards prevent false dirties, duplicate records, and lost edits.

**Render guard — `WL_RENDERING` / `ML_RENDERING`**

- `WL_RENDERING` (personal WL) and `ML_RENDERING` (team member-log modal) are module-level flags (`var WL_RENDERING = false;` / `var ML_RENDERING = false;`).
- `renderWeekLog()` sets `WL_RENDERING = true` at the start and `false` after rendering all chips; `_renderMemberLogModal()` does the same with `ML_RENDERING`.
- All `onchange`/chip-mutation handlers skip dirty-marking and auto-save while the flag is true. Examples:
  - `wlOnAttendanceChange`: `if (!WL_RENDERING) { wlMarkDirty(iso); _wlAutoSave(iso); }`
  - `wlAddItem`: same `if (!WL_RENDERING)` guard around `wlMarkDirty` + `_wlAutoSave` (so chips pre-populated during render are not re-saved).
  - Team modal inline handlers gate on `if(!ML_RENDERING){ML_DIRTY['{iso}']=true;_mlAutoSave('{iso}');}`.

**Dirty / saving / debounce queue**

- Per-iso maps drive the debounced save engine:
  - `WL_DIRTY` (iso → true) — rows with unsaved edits.
  - `WL_SAVING` (iso → true) — an in-flight save guard; `saveWeekEntry` returns early `if (WL_SAVING[iso])` to prevent a second `submitWorkLog` with no `logId` (the duplicate-record cause).
  - `WL_DEBOUNCE` (iso → setTimeout id) — 500 ms debounce per row; the callback skips when `!WL_DIRTY[iso] || WL_SAVING[iso]`.
- The team modal mirrors these exactly: `ML_DIRTY`, `ML_SAVING`, `ML_DEBOUNCE`.
- On a successful save, if new edits arrived during the round-trip (`WL_DIRTY[iso]` still true, or `WL_DEBOUNCE[iso]` pending) the dirty flag is preserved and one more `_wlAutoSave` is scheduled; otherwise dirty is cleared. Status is reflected in the `wl-as-{iso}` / `ml-as-{iso}` spans ("Saving…" → "Saved ✓").

## Verification — Cross-Cutting

- [ ] In the GAS editor run `installTriggers()`, then open the project triggers list -> a `generateWeeklySummaries` trigger fires Monday, hour 0, timezone Etc/UTC is present.
- [ ] Open the Weekly Summary modal (`#weekly-summary-modal`) for a week with logs but no summary -> empty state shows a "Generate Now" button (Material Symbol `auto_awesome`).
- [ ] Click "Generate Now" with `GEMINI_API_KEY` set -> body shows the "Generating summary with AI…" spinner, then 5–10 `•` bullets render.
- [ ] Clear/unset `GEMINI_API_KEY` and run `generateMyWeeklySummary` -> error string contains "GEMINI_API_KEY not set in Script Properties".
- [ ] Inspect `weekly-summary.gs` `_wsGenerateWithAI` endpoint -> model segment is exactly `gemini-2.5-flash` (no `-preview`).
- [ ] Generate a summary twice for the same employee+week -> only ONE row exists in `Weekly_Summary` with `Summary_ID = WS-{empId}-{weekStartNoDashes}`.
- [ ] Log in as an email NOT in `MIS_Access` and call `getMisSummaries` -> returns `{ ok:false, error:'Access denied' }` and `#nav-mis-report` stays hidden.
- [ ] Add the email to `MIS_Access`, reload -> `hasMisAccess` is true and the MIS Report nav item appears.
- [ ] Read `wdAutoClockOut` in `work-duration.gs` -> it computes `todayMidnightUTC` and contains NO 18-hour / `LIMIT_MS` cap.
- [ ] Leave a Work_Duration session open across the 05:30 IST boundary and run `wdAutoClockOut()` -> the session is set `Status: AUTO_CLOSED` with a "Auto-closed at midnight UTC (05:30 IST)" note.
- [ ] Open a Work Log week with clocked time -> each day cell shows a "Work duration" row (span id `wl-dur-{iso}`) displaying `HH:MM:SS`, or `—` when zero.
- [ ] Register a new user for a team that has a Team Captain -> the resolved manager is that Team Captain (sub-department match preferred).
- [ ] Register for a team with NO Team Captain after running `setDefaultManager()` -> resolved manager equals `LGD_DEFAULT_MANAGER_EMAIL`.
- [ ] Delete `LGD_DEFAULT_MANAGER_EMAIL` and register for a TC-less team -> manager falls back to an active Super Admin, then Admin.
- [ ] Inspect `_wlNextId` / `_ilNextId` -> both read the sheet directly via `_getDb().getSheetByName(...)` and do not call `dbGetAll`/CacheService.
- [ ] Inspect `submitWorkLog` / `saveInternWorkLog` insert branch -> wrapped in `LockService.getScriptLock().tryLock(20000)` with release in `finally`; the update branch is NOT locked.
- [ ] Trigger two near-simultaneous new-day Work Log saves -> two distinct `WL-#####` ids are produced (no collision).
- [ ] Switch weeks in the Work Log during initial render -> no spurious "Saving…" status appears (verifying `WL_RENDERING` suppresses onchange).
- [ ] Rapidly add several chips to one day -> only a single debounced `submitWorkLog`/`adminUpdateWorkLog` round-trip fires per 500 ms (verifying `WL_DEBOUNCE` + `WL_SAVING`).


---

## 13. Role-Based Access Control Matrix

LG Desk has six effective roles. All authorisation is enforced **server-side** in the `.gs` files; the frontend (`app.js.html`) only mirrors these gates to hide UI it cannot use (`.nav-mgr-only` / `.nav-admin-only` classes, revealed in `onPayloadLoaded`). Two role-set predicates drive almost every gate, defined in `auth.gs`:

```js
var ADMIN_ROLES   = ['Super Admin', 'Admin'];
var MANAGER_ROLES = ['Super Admin', 'Admin', 'Team Captain', 'Team Facilitator'];
function _isAdmin(role)   { return ADMIN_ROLES.indexOf(role)   !== -1; }
function _isManager(role) { return MANAGER_ROLES.indexOf(role) !== -1; }
```

Key consequences derived from these definitions (NOT from PRD intent):

- **TF == TC at every gate.** Both `Team Captain` and `Team Facilitator` are in `MANAGER_ROLES`, so any check using `_isManager(role)` treats them identically. There is **no** predicate anywhere that separates TC from TF except `changeEmployeeRole`'s extra same-team check (which is keyed on `Team`, not on TC-vs-TF) and the `_allowedNewRoles` table (where `Team Captain` appears explicitly but `Team Facilitator` does not — a TF is still a `_isManager`, but `_allowedNewRoles('Team Facilitator', ...)` falls through to the final `return []`, so a TF **cannot** change anyone's role).
- **Intern == Team Member at every gate except the work-log entry surface.** Neither role is in `ADMIN_ROLES` or `MANAGER_ROLES`, so all manager/admin gates reject both equally. The one difference: interns write their attendance to the separate `Intern_Work_Log` sheet via `saveInternWorkLog`, gated by `if (user.role !== 'Intern') throw` (`intern-work-log.gs`); a Team Member uses `submitWorkLog` against the `Work_Log` sheet.

Cell legend: **Full** = unrestricted org-wide · **Edit** = can mutate within own scope · **View** = read-only within scope · **—** = no access (server throws / returns `{ok:false}` / UI hidden).

| Feature | Super Admin | Admin | TC | TF | Team Member | Intern |
|---|---|---|---|---|---|---|
| View / edit own work log | Edit | Edit | Edit | Edit | Edit | Edit (Intern_Work_Log) |
| View team work logs | Full (all) | Full (all) | View (own team) | View (own team) | — | — |
| Edit team member's work log | Edit (all) | Edit (all) | Edit (own team) | Edit (own team) | — | — |
| Set work-log Status / Comments | Edit | Edit | Edit | Edit | — | — |
| View MIS Report | gated by MIS_Access sheet | gated by MIS_Access sheet | gated by MIS_Access sheet | gated by MIS_Access sheet | gated by MIS_Access sheet | gated by MIS_Access sheet |
| Approve / reject leave | Full (all) | Full (all) | Edit (direct reports) | Edit (direct reports) | — | — |
| Add / delete holiday | Full | Full | — | — | — | — |
| Post / delete announcement | Full | Full | — | — | — | — |
| Create task | Edit | Edit | Edit | Edit | Edit (defaults to self) | Edit (defaults to self) |
| Edit task | Edit (all) | Edit (all) | Edit (team scope) | Edit (team scope) | Edit (own/assigned) | Edit (own/assigned) |
| Delete task | Full | Full | Edit (assignee in team) | Edit (assignee in team) | Edit (own as assigner) | Edit (own as assigner) |
| Create project | Edit | Edit | Edit | Edit | — | — |
| Edit project | Edit (all) | Edit (all) | Edit (owner/assigner/assignee) | Edit (owner/assigner/assignee) | Edit (owner/assigner/assignee) | Edit (owner/assigner/assignee) |
| Delete project | Full | Full | Edit (owner/assigner) | Edit (owner/assigner) | — | — |
| Create function | Edit | Edit | Edit | Edit | Edit (self-assign only) | Edit (self-assign only) |
| Edit function | Edit (all) | Edit (all) | Edit (team scope) | Edit (team scope) | Edit (assignee/creator) | Edit (assignee/creator) |
| Delete function | Full | Full | Edit | Edit | — | — |
| Change due date **directly** | Full | Full | Edit (only as entity's Assigner) | Edit (only as entity's Assigner) | Edit (only as entity's Assigner) | Edit (only as entity's Assigner) |
| Change due date via **request** | n/a (direct) | n/a (direct) | Edit (request if not assigner) | Edit (request if not assigner) | Edit (request) | Edit (request) |
| Approve / reject due-date request | Full (all) | Full (all) | Edit (named Approver) | Edit (named Approver) | Edit (named Approver) | Edit (named Approver) |
| Change employee role | Full (any role) | Edit (not SA/Admin targets) | Edit (own-team TM/Intern only) | — | — | — |
| View all-company tasks / projects | Full | Full | View (own team) | View (own team) | View (own assigned) | View (own assigned) |
| View Organisation page (org-page) | View | View | View | View | — | — |
| Manage team members (team-mgmt) | View/Edit | View/Edit | View/Edit (own team) | View/Edit (own team) | — | — |
| View scoreboard scope | company | company | team (subordinates) | team (subordinates) | self only | self only |

> Note on **Edit project** and **Edit due-date request**: these are gated by record-level fields (`Owner_IDs` / `Assigner_ID` / `Assignee_IDs`, or `Approver_ID`), not by role, so any role including TM and Intern can act when they hold that position on the specific record.

### Gate reference

Each matrix row maps to the exact predicate/function that enforces it. Unless noted, the function lives in `auth.gs`.

| Matrix row | Enforcing function | Predicate |
|---|---|---|
| View / edit own work log (members) | `submitWorkLog`, `getMyWorkLogs`, `updateWorkLog` | `updateWorkLog`: `log['Emp_ID'] !== user.empId && !_isAdmin(user.role)` throws. No role gate on own submit. |
| View / edit own work log (interns) | `saveInternWorkLog`, `getInternWorkLogs` (`intern-work-log.gs`) | `if (user.role !== 'Intern') throw` — separate `Intern_Work_Log` sheet |
| View team work logs | `getTeamWorkLogs` | `if (!_isManager(user.role)) throw`; admins get `all`, managers get `_getTeamEmpIds(user)`-filtered |
| Edit team member's work log | `adminSubmitWorkLog`, `adminUpdateWorkLog`, `getMemberWorkLogs` | `if (!_isManager(user.role)) throw` |
| Set work-log Status / Comments | `updateWorkLogStatus`, `updateWorkLogComment`, `reviewWorkLog` (backend); `_canEditWlStatus(role)` (`app.js.html` line 208) | `if (!_isManager(caller.role)) throw`. Also `submitWorkLog` writes `Status` only when `_isManager(user.role)`. `_canEditWlStatus` == `MANAGER_ROLES.indexOf(role) !== -1`. |
| View MIS Report | `getMisSummaries` → `_wsHasMisAccess` / `wsCheckMisAccess` (`weekly-summary.gs`); `hasMisAccess` flag + `#nav-mis-report` reveal (`app.js.html` line 1054) | `if (!_wsHasMisAccess(user.email)) return {ok:false,'Access denied'}` — membership in `MIS_Access` sheet, **a permission not a role** (any role can be granted) |
| Approve / reject leave | `reviewLeaveRequest` (`leaves.gs`) | `if (!_isManager(user.role)) throw`; non-admins additionally require `emp['Manager_ID'] === user.empId` |
| Pending-leave queue scope | `getPendingLeaves`, `_pendingLeaveCount` (`leaves.gs`) | admins see all; managers filtered to `info.managerId === user.empId` |
| Add / delete holiday | `addHoliday`, `deleteHoliday` (`leaves.gs`) | `if (!_isAdmin(user.role)) throw` |
| Post / delete announcement | `createAnnouncement`, `deleteAnnouncement` (`dashboard.gs`); `#btn-nb-post` is `.nav-admin-only` | `if (!_isAdmin(user.role)) throw` |
| Create task | `createTask` | No role gate — defaults `Assignee_IDs` to self when empty; team-name resolution via `_resolveTeamsToIds(..., user.role)` |
| Edit task | `updateTask` → `canModifyTask(task, user)` | admin → true; manager → team membership of assignee/assigner (or unassigned in team project); else assignee or `Assigner_ID === empId` |
| Delete task | `deleteTask` | admin → true; else `isOwner (Assigner_ID===empId)` OR `_isManager && isAssignee` |
| Create project | `createProject` | `if (!_isManager(user.role)) throw 'Employees cannot create projects.'` |
| Edit project | `updateProject` | admin → true; else `Assigner_ID===empId` OR in `Owner_IDs` OR in `Assignee_IDs` (record-level, any role) |
| Delete project | `deleteProject` | `if (!_isManager(user.role)) throw`; non-admin additionally requires `Assigner_ID===empId` OR in `Owner_IDs` |
| Create function | `createFunction` | `if (!_isManager(user.role) && !_isTmSelfAssign(record, user)) throw` — TM/Intern allowed only when assignee list is empty or self-only |
| Edit function | `updateFunction` | non-managers require `isAssignee` OR `Created_By===empId` OR `Assigner_ID===empId` |
| Delete function | `deleteFunction` | `if (!_isManager(user.role)) throw 'Only managers can delete functions.'` |
| Change due date directly vs request | `requestDueDateChange` (`dueDateRequests.gs`) | `if (_isAdmin(user.role) || assignerId === user.empId) return {direct:true}` — everyone else files a request row |
| Approve / reject due-date request | `approveDueDateChange`, `rejectDueDateChange` (`dueDateRequests.gs`) | `if (!_isAdmin(user.role) && !isApprover) return {ok:false}` where `isApprover = req['Approver_ID']===user.empId` |
| Change employee role | `changeEmployeeRole` → `_allowedNewRoles(actorRole, targetCurrentRole)` | SA → any role; Admin → cannot target SA/Admin; `Team Captain` → only TM/Intern targets, same-team check (`actorTeam === targetTeam`); all other roles (incl. **Team Facilitator**, TM, Intern) → `return []` (no permission). UI: `app.js.html` line 6366/6398 gates the button with the same `_allowedNewRoles`. |
| View all-company tasks / projects | `getAuthorizedTasks` / `getAuthorizedProjects`; nav items `.nav-mgr-only` (`index.html` 1856/1859) | admin → `all`; manager → `_getTeamEmpIds` + team-name + project association; TM/Intern → personal assignee/assigner only. `renderAllTasks` (`app.js.html` 6007) renders the already-scoped `APP.tasks`. |
| View Organisation page | nav item `data-view="org-page"` is `.nav-mgr-only` (`index.html` 1862); `renderOrgPage` (`app.js.html` 6385) | revealed only when `MANAGER_ROLES.indexOf(u.role) !== -1` (`onPayloadLoaded` line 1047) |
| Manage team members | nav item `data-view="team-mgmt"` is `.nav-mgr-only` (`index.html` 1850); `renderTeamMgmt` (`app.js.html` 6344) | manager-revealed; role-change controls inside further gated per-row by `_allowedNewRoles` |
| View scoreboard scope | `_getScores(user, allEmps)` (`dashboard.gs`) | admin → `scope='company'` (no filter); manager → `scope='team'` via `getSubordinateIds(user.empId)` + self; else → `scope='self'`, only `user.empId` |
| Team Clock Status widget | `getTeamClockStatus` (`work-duration.gs`) | `if (!_isManager(user.role) && !_isAdmin(user.role)) return {ok:false,'Access denied'}`; admins see all active employees, managers see `_getTeamEmpIds` |

### Notes on mismatches and special cases

- WARNING (Team Facilitator role-change): although TF is a full manager elsewhere, `_allowedNewRoles('Team Facilitator', …)` returns `[]`, so a TF **cannot change any employee's role** despite the `team-mgmt` page being visible to it. Only Super Admin, Admin, and Team Captain (own-team TM/Intern) can change roles.
- MIS Report access is **not** role-derived: it is a per-email allow-list in the `MIS_Access` sheet checked by `_wsHasMisAccess`. A plain Team Member or Intern listed there gets the report; an Admin not listed does not.
- "Edit project" / "Edit function" / "Approve due-date request" are **record-scoped**, so a Team Member or Intern who is the Owner/Assigner/Assignee/named Approver on a specific record passes the gate even though their role grants nothing org-wide.
- The frontend role-set arrays in `onPayloadLoaded` (`adminRoles` / `managerRoles`, `app.js.html` lines 1044-1045) duplicate the backend `ADMIN_ROLES` / `MANAGER_ROLES` exactly; they only hide nav, never grant access.

## Verification — RBAC

- [ ] Log in as a **Team Facilitator**, open Team Members (`team-mgmt`) -> the page renders, but every member row's role-change control is absent/disabled (because `_allowedNewRoles('Team Facilitator', …)` returns `[]`).
- [ ] Log in as a **Team Captain**, attempt to change a member of a **different team** -> server returns `{ok:false, error:'You can only change roles of members in your own team.'}` (`changeEmployeeRole` same-team check).
- [ ] Log in as a **Team Member**, call `createProject` (or click any project create entry) -> server throws `Employees cannot create projects.`.
- [ ] Log in as a **Team Member** who is an entity's Assigner, change that task's due date -> change applies directly (`requestDueDateChange` returns `direct:true`); repeat on a task they did NOT assign -> a `Due_Date_Requests` row is created instead.
- [ ] Log in as an **Admin** NOT listed in `MIS_Access` -> the `#nav-mis-report` item stays `hidden` and `getMisSummaries` returns `{ok:false, error:'Access denied'}`; add their email to `MIS_Access`, reload -> the nav item appears.
- [ ] Log in as a **Team Captain** and an **Admin**; compare the dashboard scoreboard -> TC sees only own subordinates + self (`scope='team'`), Admin sees the whole company (`scope='company'`).
- [ ] Log in as an **Intern**, submit attendance -> it writes to `Intern_Work_Log` via `saveInternWorkLog`; confirm a Team Member's submission instead lands in `Work_Log` via `submitWorkLog`.
- [ ] Log in as a **Team Member**, attempt `addHoliday` / `createAnnouncement` (e.g. via console) -> both throw `Only admins can …`.
- [ ] Log in as a **TC** vs **Admin** and open Team Work Logs -> TC's list contains only `_getTeamEmpIds` members; Admin's `getTeamWorkLogs` returns all employees' logs.


---

## 14. Google Sheets Data Schema

LG Desk uses one Google Spreadsheet as its entire database. Most sheets are declared in the `SCHEMA` constant at the top of `src/setupSheets.gs` and scaffolded by `setupDatabase()` / `migrateSchema()` (header row written to row 1, frozen, indigo `#1a237e` background). A handful of sheets are **not** in `SCHEMA` and are scaffolded lazily by their owning module the first time they are written to — those headers are sourced from the owning `.gs` file and are flagged in the table below.

Column order in the table is the **exact** order written to the sheet header row. Column names that contain spaces (the `Work_Log` and `Intern_Work_Log` work-update columns) are shown verbatim.

| Sheet | Key Column | All Columns (in order) | Defined in |
|---|---|---|---|
| **Employees** | `Emp_ID` | `Emp_ID`, `First_Name`, `Last_Name`, `Email`, `Role`, `Designation`, `Manager_ID`, `Team`, `Sub_Department`, `Is_Active`, `Password_Hash`, `DOB`, `Created_At` | `SCHEMA` (setupSheets.gs) |
| **Projects** | `Proj_ID` | `Proj_ID`, `Parent_Proj_ID`, `Name`, `Description`, `Owner_IDs`, `Assigner_ID`, `Assignee_IDs`, `Assigned_Teams`, `Status`, `Priority`, `Start_Date`, `Deadline`, `Chat_Link`, `Chat_Space_ID`, `Chat_Space_URI`, `Created_At`, `Updated_At`, `Cal_Event_ID`, `Assignment_History` | `SCHEMA` |
| **Functions** | `Function_ID` | `Function_ID`, `Parent_Fn_ID`, `Proj_ID`, `Name`, `Description`, `Assigner_ID`, `Assignee_IDs`, `Assigned_Teams`, `Status`, `Priority`, `Recurring_Functions`, `Start_Date`, `Deadline`, `Chat_Link`, `Chat_Space_ID`, `Chat_Space_URI`, `Cal_Event_ID`, `Assignment_History`, `Created_By`, `Created_At`, `Updated_At`, `Links` | `SCHEMA` |
| **Tasks** | `Task_ID` | `Task_ID`, `Proj_ID`, `SubFn_ID`, `Function_ID`, `Title`, `Description`, `Assignee_IDs`, `Assigned_Teams`, `Assigner_ID`, `Status`, `Priority`, `Recurring_Task`, `Due_Date`, `Estimated_Hours`, `Actual_Hours`, `File_Link`, `Created_At`, `Updated_At`, `Cal_Event_ID`, `Assignment_History`, `Links` | `SCHEMA` |
| **Progress_Updates** | `Update_ID` | `Update_ID`, `Task_ID`, `Proj_ID`, `Author_Emp_ID`, `Date`, `Description`, `Hours_Logged`, `Blockers`, `Created_At` | `SCHEMA` |
| **Work_Log** | `Log_ID` | `Log_ID`, `Emp_ID`, `Date`, `Month`, `Day`, `Attendance`, `Purpose`, `Leave Requested`, `Work Update - 1st Half`, `Work Update - 2nd Half`, `Extra Hours`, `Remark`, `Status`, `Comments`, `Created_At` | `SCHEMA` (+ `Work_Duration` appended out-of-SCHEMA — see Note A) |
| **Intern_Work_Log** | `Log_ID` | `Log_ID`, `Emp_ID`, `Date`, `Month`, `Day`, `Attendance`, `Purpose`, `Leave Requested`, `Work Update - 1st Half`, `Work Update - 2nd Half`, `Extra Hours`, `Remark`, `Status`, `Comments`, `Created_At` | `_IWL_HEADERS` in intern-work-log.gs (NOT in `SCHEMA`) |
| **Work_Duration** | `Session_ID` | `Session_ID`, `Emp_ID`, `Email`, `Emp_Name`, `Date`, `Clock_In`, `Clock_Out`, `Total_Break_Mins`, `Net_Work_Mins`, `Status`, `Notes`, `Created_At` | `setupWorkDurationSheets()` in work-duration.gs (prod shape; NOT in `SCHEMA` — see Note C) |
| **Work_Breaks** | `Break_ID` | `Break_ID`, `Session_ID`, `Break_Start`, `Break_End`, `Break_Mins`, `Created_At` | `setupWorkDurationSheets()` in work-duration.gs (prod shape; NOT in `SCHEMA` — see Note C) |
| **Leaves** | `Leave_ID` | `Leave_ID`, `Emp_ID`, `Leave_Type`, `Start_Date`, `End_Date`, `Days`, `Reason`, `Status`, `Reviewed_By`, `Reviewed_At`, `Review_Notes`, `Cal_Event_ID`, `Created_At` | `SCHEMA` |
| **Holidays** | `Holiday_ID` | `Holiday_ID`, `Name`, `Date`, `Description`, `Cal_Event_ID`, `Created_By`, `Created_At` | `SCHEMA` |
| **Announcements** | `Ann_ID` | `Ann_ID`, `Type`, `Title`, `Message`, `Target_Date`, `Priority`, `Is_Active`, `Created_By`, `Created_At` | `SCHEMA` (+ `Visibility`, `Expires_At` written at runtime — see Note B) |
| **Forms** | `Form_ID` | `Form_ID`, `Title`, `Description`, `Created_By_ID`, `Team_ID`, `Visibility`, `Status`, `Responder_URL`, `Edit_URL`, `Is_Active`, `Created_At`, `Updated_At` | `_ensureFormsSheet()` in forms.gs (NOT in `SCHEMA`) |
| **Due_Date_Requests** | `Request_ID` | `Request_ID`, `Entity_Type`, `Entity_ID`, `Entity_Title`, `Requestor_ID`, `Approver_ID`, `Current_Date`, `Requested_Date`, `Reason`, `Status`, `Notes`, `Created_At`, `Updated_At` | `SCHEMA` |
| **Attachments** | `Attachment_ID` | `Attachment_ID`, `Entity_Type`, `Entity_ID`, `File_Type`, `Drive_File_ID`, `File_Name`, `MIME_Type`, `File_Size`, `Uploaded_By`, `Uploaded_At`, `Is_Active` | `_ensureAttachmentsSheet()` in attachments.gs (NOT in `SCHEMA`) |
| **Audit_Log** | `Log_ID` | `Log_ID`, `Timestamp`, `Actor_Email`, `Action`, `Entity_Type`, `Entity_ID`, `Old_Value`, `New_Value` | `SCHEMA` |
| **Registration_Requests** | `Req_ID` | `Req_ID`, `First_Name`, `Last_Name`, `Email`, `Password_Hash`, `Role`, `Designation`, `Team`, `Sub_Department`, `Manager_Email`, `Message`, `DOB`, `Status`, `Requested_At`, `Reviewed_By`, `Reviewed_At`, `Review_Notes` | `SCHEMA` |
| **Profile_Update_Requests** | `Req_ID` | `Req_ID`, `Emp_ID`, `Emp_Email`, `New_Designation`, `New_Team`, `New_Sub_Department`, `New_Manager_Email`, `Status`, `Requested_At`, `Reviewed_By`, `Reviewed_At`, `Review_Notes` | `SCHEMA` |
| **Todos** | `Todo_ID` | `Todo_ID`, `Emp_ID`, `Title`, `Done`, `Created_At`, `Updated_At` | `initNotesSheets()` config in notes.gs (NOT in `SCHEMA`) |
| **Notes** | `Note_ID` | `Note_ID`, `Emp_ID`, `Title`, `Content`, `Color`, `Pinned`, `Created_At`, `Updated_At` | `initNotesSheets()` config in notes.gs (NOT in `SCHEMA`) |
| **Ideas** | `Idea_ID` | `Idea_ID`, `Emp_ID`, `Title`, `Content`, `Status`, `Created_At`, `Updated_At` | `initNotesSheets()` config in notes.gs (NOT in `SCHEMA`) |
| **Weekly_Summary** | `Summary_ID` | `Summary_ID`, `Emp_ID`, `Email`, `Emp_Name`, `Week_Start`, `Week_End`, `Content`, `Is_Edited`, `Generated_At`, `Edited_At`, `Edited_By` | `SCHEMA` |
| **MIS_Access** | `Email` | `Email`, `Emp_Name`, `Added_By`, `Added_At` | `SCHEMA` |

### Schema drift notes (verified against code)

**Note A — `Work_Log` has an out-of-SCHEMA `Work_Duration` column.**
The `SCHEMA.Work_Log` array (setupSheets.gs lines 31–38) ends at `Created_At`. The function `addWorkDurationColumn()` (setupSheets.gs, line 750) appends a 16th column named **`Work_Duration`** to the end of the live `Work_Log` sheet (`sheet.getLastColumn() + 1`) and then `_dbInvalidate('Work_Log')`. It is idempotent — it returns early if a `Work_Duration` header already exists. Because this column is added by a separate one-time function and not by `SCHEMA`, a freshly scaffolded sheet from `setupDatabase()`/`migrateSchema()` will lack it until `addWorkDurationColumn()` is run.

**Note B — `Announcements` reads/writes `Visibility` and `Expires_At` that are NOT in `SCHEMA`.**
`SCHEMA.Announcements` (setupSheets.gs lines 39–41) has only 9 columns ending in `Created_At`; it includes `Target_Date` (used as the announcement **start** date) but has no `Visibility` and no `Expires_At` columns. However, `dashboard.gs` both **reads** them — `_getNotices` checks `a['Expires_At']` (line 39) and `a['Visibility'] || 'Organisation'` (line 47) for expiry/role gating — and **writes** them — `createAnnouncement` inserts `Visibility: visibility` and `Expires_At: expiresAt` (lines 260–261). `dbInsert` will add these as new trailing columns at write time, so they exist in practice but are absent from the declared schema. Re-running `setupDatabase()` (which clears + rewrites headers from `SCHEMA`) would drop these columns.

**Note C — Dev DB `Work_Duration` / `Work_Breaks` schema differs from prod.**
Two different definitions exist for these sheets:
- **Production shape** (`setupWorkDurationSheets()` in work-duration.gs): `Work_Duration` = `Session_ID, Emp_ID, Email, Emp_Name, Date, Clock_In, Clock_Out, Total_Break_Mins, Net_Work_Mins, Status, Notes, Created_At`; `Work_Breaks` = `Break_ID, Session_ID, Break_Start, Break_End, Break_Mins, Created_At`.
- **Dev DB shape** (env-setup.gs, lines 191–197): `Work_Duration` = `Session_ID, Emp_ID, Date, Clock_In, Clock_Out, Total_Break_Mins, Net_Work_Mins, Status, Notes, Edited_By, Edited_At, Edit_Reason` (drops `Email`/`Emp_Name`/`Created_At`; adds `Edited_By`/`Edited_At`/`Edit_Reason`); `Work_Breaks` = `Break_ID, Session_ID, Emp_ID, Break_Start, Break_End, Duration_Mins` (adds `Emp_ID`; uses `Duration_Mins` instead of `Break_Mins`, and drops `Created_At`).

The two definitions are inconsistent in both column set and column names (`Break_Mins` vs `Duration_Mins`). The dev `Work_Breaks` uses `Duration_Mins`, whereas the runtime code in work-duration.gs writes/reads `Break_Mins` (e.g. `dbUpdate(_WDB_SHEET, 'Break_ID', ..., { Break_End: now, Break_Mins: bMins })`). The prod shape is the one the live clock code is written against.

**Other observations vs. the CLAUDE.md / PRD summaries:**
- The `Holidays` sheet has 7 columns including `Description` and `Created_By`; some reference docs list only 5.
- `Forms` uses `Responder_URL` (not `Publish_URL` / `Google_Form_ID` as some docs state) and has no separate `Google_Form_ID` column — the Google Forms id is parsed out of the stored URL at read time (forms.gs line 394).
- `Progress_Updates` includes a `Proj_ID` column (between `Task_ID` and `Author_Emp_ID`) not always shown in summary docs.
- `Leaves` uses `Reviewed_By` / `Reviewed_At` / `Review_Notes` (not `Manager_Notes` / `Updated_At` as some docs state).
- `Registration_Requests` and `Profile_Update_Requests` are the actual sheet names (some docs abbreviate to `Registrations` / `Profile_Requests`).

## Verification — Schema

- [ ] Open the production spreadsheet and read the `Work_Log` header row -> the 16th/last column is named exactly `Work_Duration` (added by `addWorkDurationColumn()`), in addition to the 15 `SCHEMA` columns ending in `Created_At`.
- [ ] Read the `Announcements` header row in a live DB that has had announcements created -> trailing columns `Visibility` and `Expires_At` are present even though `SCHEMA.Announcements` declares neither.
- [ ] Compare `Work_Breaks` headers in the dev DB vs prod DB -> dev shows `Duration_Mins` + `Emp_ID` (env-setup.gs), prod shows `Break_Mins` + `Created_At` (work-duration.gs); confirm the live clock code writes `Break_Mins`.
- [ ] In `setupSheets.gs`, confirm `Intern_Work_Log` is absent from `SCHEMA` -> its header comes from `_IWL_HEADERS` in intern-work-log.gs and uses the space-containing columns `Work Update - 1st Half` / `Work Update - 2nd Half` / `Leave Requested` verbatim.
- [ ] Grep `SCHEMA` keys in setupSheets.gs for `Attachments`, `Forms`, `Todos`, `Notes`, `Ideas`, `Work_Duration`, `Work_Breaks` -> none are present (all scaffolded by their owning modules' `_ensure*` functions).
- [ ] Read the `Holidays` header row -> 7 columns present including `Description` and `Created_By`.
- [ ] Read the `Forms` header row -> column is named `Responder_URL` (not `Publish_URL`) and there is no standalone `Google_Form_ID` column.


---

## 15. GAS Function Reference

This section lists every backend Apps Script function invoked from the frontend via `google.script.run.<name>(...)`. The list was produced by extracting all distinct `google.script.run` call targets in `src/app.js.html` (108 distinct names) and locating each definition across the `.gs` files.

Conventions verified in code:

- Every server function takes the caller's `email` as a parameter (usually last, sometimes first or second) and validates it via `getCurrentUser(email)`, which throws for unknown / inactive accounts.
- Most functions return `{ ok: true, ... }` on success and `{ ok: false, error: <message> }` on failure. A handful of CRUD helpers (e.g. `createTask`, `submitWorkLog`) instead **return a bare ID string** or **throw** on error rather than returning a `{ ok }` envelope — flagged in Notes.
- RBAC predicates referenced below: `_isAdmin(role)` = `['Super Admin','Admin']`; `_isManager(role)` = `['Super Admin','Admin','Team Captain','Team Facilitator']`.
- ⚠ **One frontend call has no backend definition: `submitFormResponse`** (called at `app.js.html:14810` — `google.script.run.submitFormResponse(formId, JSON.stringify(answers), email)`). No matching `function submitFormResponse` exists in any `.gs` file. Flagged as **Planned / Not implemented (broken call)** in the Forms table.

### 15.1 Auth, Session & Password

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `loginWithPassword` | auth.gs:526 | `email, password` | `{ ok, token, name, email, role, designation, team, sub_department, empId }` or `{ ok:false, error }` | No prior session needed. Matches active Employee by email, compares `SHA256(pw+'tms_2025')`. Creates a `sess_<uuid>` ScriptProperty inline (7-day TTL) and returns it as `token`. |
| `validateSession` | auth.gs:1871 | `token` | Full `getInitialPayload` result merged with `{ ok:true }`; else `{ ok:false, reason:'not_found'\|'expired'\|'payload_error'\|'error' }` | Null-guards `'null'`/`'undefined'` strings. Sliding 7-day expiry extension on each use. |
| `createSession` | auth.gs:1861 | `email` | `{ ok, token }` or `{ ok:false, error }` | Writes `sess_<uuid>` ScriptProperty. (Mostly superseded by token issued inside `loginWithPassword`.) |
| `invalidateSession` | auth.gs:1895 | `token` | `{ ok:true }` (always) | Deletes the `sess_<token>` ScriptProperty. Fails silently on logout. |
| `requestPasswordReset` | auth.gs:287 | `email` | `{ ok }` or `{ ok:false, error }` | Public (no session). Generates 6-digit OTP (15-min TTL in ScriptProperties), emails it via GmailApp. |
| `resetPasswordWithOTP` | auth.gs:321 | `email, otp, newPassword` | `{ ok }` or `{ ok:false, error }` | Public. Validates OTP + expiry, rewrites `Password_Hash`. Requires `newPassword.length >= 6`. |
| `changePassword` | auth.gs:353 | `email, currentPassword, newPassword` | `{ ok }` or `{ ok:false, error }` | Logged-in user only. Verifies current hash; min 6 chars. Clears `_CUR_USER_CACHE`. |
| `getMyProfile` | auth.gs:371 | `email` | `{ ok, empId, firstName, lastName, email, role, designation, team, sub_department, managerEmail, managerName, dob, pending }` | Any authenticated user. `pending` reflects an open Profile_Update_Request. |
| `submitProfileUpdate` | auth.gs:408 | `record, email` | `{ ok, immediate, reqId? }` or `{ ok:false, error }` | Designation updates apply immediately; team / sub-dept / manager changes create a pending `Profile_Update_Requests` row (one pending allowed at a time). |
| `getPendingProfileRequests` | auth.gs:450 | `email` | `{ ok, requests:[] }` or `{ ok:false, error }` | `_isManager` only. Admin sees all; TC/TF only same-team requests. |
| `approveProfileUpdate` | auth.gs:480 | `reqId, email` | `{ ok }` or `{ ok:false, error }` | `_isManager` only. Applies changes to Employees, invalidates org-tree cache. |
| `rejectProfileUpdate` | auth.gs:512 | `reqId, notes, email` | `{ ok }` or `{ ok:false, error }` | `_isManager` only. Marks request Rejected. |
| `getInitialPayload` | auth.gs:577 | `email` | `{ ok, currentUser, tasks, projects, employees, functions, pendingLeaveCount, attCounts, hasMisAccess }` | Single round-trip startup payload. Tasks/Projects/Functions/Employees scoped by `getAuthorized*`. `hasMisAccess` from `wsCheckMisAccess`. |
| `getDeployerEmail` | migration.gs:53 | (none) | `{ ok, email }` | No session check — returns the deployer's Google identity. |

### 15.2 Registration & Role Management

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `submitRegistration` | auth.gs:1597 | `record` (single object; **no email param**) | `{ ok, reqId }` or `{ ok:false, error }` | Public (pre-account). Hashes raw password if needed; rejects duplicate email / duplicate pending request. Inserts `Registration_Requests` row. |
| `getRegistrationRequests` | auth.gs:1659 | `email, myOnly` | `{ ok, requests:[] }` or `{ ok:false, error }` | Non-managers get empty list. Admin + `!myOnly` = all pending; TC/TF = own-team requests. |
| `approveRegistration` | auth.gs:1683 | `reqId, email` | `{ ok, empId }` or `{ ok:false, error }` | `_isManager`; non-admins must be designated manager or same-team manager. Creates Employee, adds to team Chat space, invalidates org tree. |
| `rejectRegistration` | auth.gs:1743 | `reqId, email, notes` | `{ ok }` or `{ ok:false, error }` | `_isManager`; same same-team / designated-manager check as approve. |
| `getTeamCaptainByTeam` | auth.gs:1525 | `team, subDept` (**no email param**) | `{ ok, email, name }` or `{ ok:false }` | Public (used by registration form). Falls back to `LGD_DEFAULT_MANAGER_EMAIL` Script Property, then any Super Admin, then any Admin. |
| `changeEmployeeRole` | auth.gs:1803 | `targetEmpId, newRole, email` | `{ ok, empId, oldRole, newRole }` or `{ ok:false, error }` | Permission matrix via `_allowedNewRoles`: SA→any; Admin→up to Admin (not SA/Admin targets); TC→TM/Intern in own team only. Cannot change own role. |

### 15.3 Tasks

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `createTask` | auth.gs:870 | `record, email` | **bare new Task_ID string** (throws on error) | Any authenticated user. Defaults Assigner/Assignee to self, resolves team→IDs, appends assignment history, syncs Calendar, write-through cache re-warm. |
| `updateTask` | auth.gs:898 | `taskId, updates, email` | (no return value; throws on error) | Gated by `canModifyTask` (admin; manager with team assignee/assigner or unassigned task in team project; TM as assignee or assigner). Tracks assignment-history diffs, Calendar sync. |
| `deleteTask` | auth.gs:1024 | `taskId, email` | (no return value; throws on error) | Admin, or task owner (assigner), or manager who is an assignee. Deletes Calendar event, write-through re-warm. |
| `submitProgressUpdate` | auth.gs:1141 | `record, email` (`record.taskId/date/hours/description/blockers`) | **bare new Update_ID string** (throws) | Gated by `canModifyTask`. Inserts Progress_Updates row, increments task `Actual_Hours`. |
| `getTaskProgressUpdates` | auth.gs:1168 | `taskId, email` | array of update objects (`+Author_Name`); throws on error | Admin all; manager if team assignee/assigner; TM if assignee. |

### 15.4 Projects

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `createProject` | auth.gs:942 | `record, email` | **bare new Proj_ID string** (throws) | `_isManager` only. Sets creator as permanent `Owner_IDs`, resolves teams, creates Chat space, Calendar deadline sync. |
| `updateProject` | auth.gs:976 | `projId, updates, email` | (no return value; throws on error) | Admin, or project assigner/owner/assignee (incl. TMs in `Assignee_IDs`). `Owner_IDs` protected from overwrite. |
| `deleteProject` | auth.gs:1043 | `projId, email` | (no return value; throws on error) | `_isManager`; non-admins must be assigner or owner. Deletes Calendar event. |

### 15.5 Functions / Sub-Functions

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `createFunction` | auth.gs:1068 | `record, email` | `{ ok, id }` (throws on auth failure) | `_isManager` OR `_isTmSelfAssign` (assignee list empty or only self). Same record covers top-level + sub-functions (`Parent_Fn_ID`). |
| `updateFunction` | auth.gs:1098 | `fnId, updates, email` | `{ ok }` (throws) | `_isManager`, or non-manager who is assignee / creator / assigner. |
| `deleteFunction` | auth.gs:1115 | `fnId, email` | `{ ok }` (throws) | `_isManager` only. Cascade-deletes child sub-functions and unlinks all referencing tasks. |

### 15.6 Work Log (Personal & Team)

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `submitWorkLog` | auth.gs:1216 | `record, email` | **bare new Log_ID string**, or `{ ok:false, error }` if lock fails | Any authenticated user, own log only. LockService-guarded insert via `_wlNextId()`. `Status`/`Comments` written only when `_isManager`. Pulls Work_Duration for the day. |
| `updateWorkLog` | auth.gs:1294 | `logId, updates, email` | `{ ok }` (throws) | Own log, or `_isAdmin`. |
| `updateWorkLogStatus` | auth.gs:1259 | `empId, dateKey, newStatus, callerEmail` | `{ ok }` (throws) | `_isManager` only (TC/TF/Admin/SA). Patches Status on the matching Emp_ID+date row. |
| `updateWorkLogComment` | auth.gs:1271 | `empId, dateKey, newComment, callerEmail` | `{ ok }` (throws) | `_isManager` only. Patches Comments field. |
| `getMyWlWeekSummary` | auth.gs:1320 | `email, isoStart, isoEnd` | `{ ok, data:[{ isoDate, attendance, hasWork, hrs }] }` | Own logs; 7-day window. Fills Week Off / Holiday defaults; baseline hours per attendance type. |
| `getMemberWorkLogs` | auth.gs:1372 | `targetEmpId, adminEmail, startDate, endDate` | array of work-log rows (throws) | `_isManager` only. Routes Intern targets to `_getInternWlLogs`. Optional date filter. |
| `adminSubmitWorkLog` | auth.gs:1391 | `record, targetEmpId, adminEmail` | **bare new Log_ID string**, or `{ ok:false, error }` | `_isManager`. LockService-guarded insert for a team member. |
| `adminUpdateWorkLog` | auth.gs:1442 | `logId, updates, adminEmail` | `{ ok }` (throws) | `_isManager`. Back-fills Work_Duration column if missing. |
| `getTeamWorkLogs` | auth.gs:1464 | `email, startDate, endDate` | `{ logs:[...], holidays:[...] }` (throws) | `_isManager`. Admin = all; TC/TF = `_getTeamEmpIds`. Merges Intern_Work_Log rows; returns admin holidays. |

### 15.7 Intern Work Log

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `saveInternWorkLog` | intern-work-log.gs:64 | `record, email` | `{ ok, logId }` or `{ ok:false, error }` | Caller must be role `Intern`. Upsert by Emp_ID+Date; LockService-guarded insert via `_ilNextId()`. |
| `adminSaveInternWorkLog` | intern-work-log.gs:147 | `record, targetEmpId, adminEmail` | `{ ok, logId }` or `{ ok:false, error }` | `_isManager`. Upsert into `Intern_Work_Log` for a target intern. |

### 15.8 Work Duration (Clock In/Out)

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `wdClockIn` | work-duration.gs:35 | `email` | `{ ok, sessionId, clockIn, resumed? }` or `{ ok:false, error }` | Own session. Reopens today's COMPLETED session if present; else creates new ACTIVE session. |
| `wdClockOut` | work-duration.gs:89 | `email, sessionId, customTime, reason` | `{ ok, clockOut, netMins, totalBreakMins }` or `{ ok:false, error }` | Own session. `customTime` (`'HH:MM'`) optional; auto-closes open break; recalcs net minutes; syncs Work_Log duration. |
| `wdStartBreak` | work-duration.gs:152 | `email, sessionId` | `{ ok, breakId, breakStart }` or `{ ok:false, error }` | Own session → ON_BREAK. Rejects if a break is already open. |
| `wdEndBreak` | work-duration.gs:178 | `email, sessionId` | `{ ok, breakEnd, breakMins }` or `{ ok:false, error }` | Own session → ACTIVE. Adds just-ended break to `Total_Break_Mins`. |
| `wdGetStatus` | work-duration.gs:212 | `email` | `{ ok, status, session, breaks, activity, history, totalBreakMins }` | Own data. Forces fresh read; 14-day completed history; status IDLE/ACTIVE/ON_BREAK/COMPLETED. |
| `wdEditTime` | work-duration.gs:289 | `email, startTime, endTime, breakMins, reason` | `{ ok }` or `{ ok:false, error }` | Own today session. `reason` required. Rewrites Clock_In/Out + Total_Break_Mins, appends audit note. |
| `wdEditBreak` | work-duration.gs:507 | `email, totalBreakMins` | `{ ok, totalBreakMins, netWorkMins }` or `{ ok:false, error }` | Own today session. Recalcs net minutes if completed. |
| `getTeamClockStatus` | work-duration.gs:552 | `email` | `{ ok, data:[{ empId, name, avatar, status, clockInTs, totalBreakMins, netWorkMins }] }` | `_isManager` or `_isAdmin`. Admin = all active; TC/TF = own team. Sorted active→on_break→completed→not_clocked_in. |
| `getWorkDurationsForDates` | work-duration.gs:693 | `email, startDate, endDate` | `{ ok, data:{ 'YYYY-MM-DD':'HH:MM:SS' } }` | Resolves emp by email; own durations only. |
| `getTeamWorkDurationsRange` | work-duration.gs:728 | `email, startDate, endDate` | `{ ok, data:{ 'empId:YYYY-MM-DD':'HH:MM:SS' } }` | `_isManager`. Admin = all; TC/TF = `_getTeamEmpIds`. |

> Note: auto clock-out is a **daily reset at midnight UTC (05:30 IST)** via `wdAutoClockOut` (a trigger, not a frontend call) — there is no 18-hour cap.

### 15.9 Weekly Summary & MIS Report

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `getWeeklySummary` | weekly-summary.gs:348 | `callerEmail, weekStart` | `{ ok, found, summaryId?, content?, isEdited?, generatedAt?, editedAt?, weekStart, weekEnd? }` | Own summary only (matched by email + `Week_Start`). |
| `saveWeeklySummary` | weekly-summary.gs:374 | `callerEmail, weekStart, newContent` | `{ ok }` or `{ ok:false, error }` | Own summary; sets `Is_Edited=TRUE`, records `Edited_At`/`Edited_By`. |
| `generateMyWeeklySummary` | weekly-summary.gs:400 | `callerEmail, weekStart` | `{ ok, content }` or `{ ok:false, error }` | Own summary on-demand. Aborts if week has no logs. AI call to **Gemini `gemini-2.5-flash`** (key `GEMINI_API_KEY`); upserts Weekly_Summary row. |
| `getMisSummaries` | weekly-summary.gs:456 | `callerEmail, weekStart` | `{ ok, weekStart, summaries:[{ empId, empName, email, content, isEdited, weekEnd }] }` | Gated by `_wsHasMisAccess` (MIS_Access sheet). Dedupes by Summary_ID, keeps latest-generated. |

### 15.10 Leaves & Holidays

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `submitLeaveRequest` | leaves.gs:7 | `record, email` (`leave_type/start_date/end_date/reason`) | `{ ok, leaveId }` or `{ ok:false, error }` | Own leave. Half Day → single day, `Days=0.5`; else inclusive day count. |
| `reviewLeaveRequest` | leaves.gs:48 | `leaveId, status, notes, email` | `{ ok }` or `{ ok:false, error }` | `_isManager`; non-admins limited to direct reports (`Manager_ID`). Approved leaves sync to Calendar. |
| `getMyLeaves` | leaves.gs:92 | `email` | `{ ok, leaves:[] }` or `{ ok:false, error }` | Own leaves, newest first. |
| `getPendingLeaves` | leaves.gs:105 | `email` | `{ ok, leaves:[] }` or `{ ok:false, error }` | `_isManager`. Admin = all pending; TC/TF = direct reports. |
| `addHoliday` | leaves.gs:137 | `record, email` (`name/date/description`) | `{ ok, holidayId }` or `{ ok:false, error }` | `_isAdmin` only. Creates Holidays row + Calendar event. |
| `deleteHoliday` | leaves.gs:164 | `holidayId, email` | `{ ok }` or `{ ok:false, error }` | `_isAdmin` only. Removes Calendar event + row. |
| `getHolidays` | leaves.gs:182 | `email` | `{ ok, holidays:[] }` or `{ ok:false, error }` | Any authenticated user. Dates normalised to `YYYY-MM-DD`. |
| `getCalendarData` | leaves.gs:195 | `email` | `{ ok, leaves, holidays, workLogs, ... }` | Approved leaves scoped by role (admin all / manager subordinates / self); work logs capped at 90. |

### 15.11 Dashboard & Announcements

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `getDashboardExtras` | dashboard.gs:4 | `email` | `{ ok, notices, onLeave, scores, scoreScope }` | Any authenticated user. Notice board role-gated inside `_getNotices`; scoreboard formula `done*10 + inProg*3 - overdue*5`. |
| `createAnnouncement` | dashboard.gs:229 | `record, email` (`title/message/type/priority/visibility/startDate/endDate`) | `{ ok, annId }` or `{ ok:false, error }` | `_isAdmin` only. `Target_Date`=start, `Expires_At`=end (default +7d). Visibility: Organisation / TCs & TFs / TCs Only. |
| `deleteAnnouncement` | dashboard.gs:272 | `annId, email` | `{ ok }` or `{ ok:false, error }` | `_isAdmin` only. Soft-delete (`Is_Active=FALSE`). |

### 15.12 Meetings

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `scheduleMeeting` | meet.gs:32 | `recordOrTitle, emailOrStartIso, durationMins, attendeeEmails, description, extProps` (frontend uses object form: `(record, email)`) | `{ ok, eventId, title, start, end, meetLink, htmlLink }` or `{ ok:false, error }` | Any authenticated user. Resolves `attendeeIds`/`attendeeTeams` → emails; creates Calendar event with Meet link + `sendUpdates=all`; stores shared extended properties. |
| `scheduleMeetingWithTemplate` | meet.gs:320 | `record, email` (`type:'company'\|'team'\|'custom'`) | `{ ok, ... }` or `{ ok:false, error }` | Company type → `_isAdmin`; team type → `_isManager`; custom → any. Auto-resolves audience. |
| `getMeetings` | meet.gs:499 | `email` | `{ ok, meetings:[], isAdmin, isManager, userTeam }` or `{ ok:false, error }` | Filtered by `_userCanSeeMeeting`: creator/organizer, explicit attendee by ID/team, or admin. |
| `getMeetingsForRange` | meet.gs:187 | `startDate, endDate, email` | `{ ok, meetings:[] }` or `{ ok:false, error }` | CacheService-backed (`mtg_<email>_<start>_<end>`, 10-min TTL). Used by Work Log auto-fill. |
| `cancelMeetingById` | meet.gs:530 | `calEventId, email` | `{ ok }` or `{ ok:false, error }` | Allowed if `_isAdmin` or event organizer/creator. Deletes Calendar event, audits. |

### 15.13 Directory & Presence

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `getTeamDirectory` | directory-only.gs:3 | `email` | `{ ok, employees:[], isManager, isAdmin, teamChatSpaces }` | Any authenticated user; always scoped to caller's own team. |
| `getCompanyDirectory` | directory-only.gs:43 | `email` | `{ ok, employees:[], ... }` or `{ ok:false, error }` | Any authenticated user — full active-employee list (no role restriction). |
| `setMyPresence` | presence.gs:19 | `status, email` | `{ ok }` or `{ ok:false }` | Own presence. Statuses online/away/dnd/offline; dnd/offline persisted to ScriptProperties (longer TTL). |
| `getAllPresence` | presence.gs:42 | `email` | `{ ok, presence:{ email:status } }` or `{ ok:false, error }` | Any authenticated user. Batch cache read; SP fallback for persistent statuses. |

### 15.14 Forms

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `formsGetAuthUrl` | forms.gs:11 | `email` | `{ ok, url }` or `{ ok:false, error }` | Per-user OAuth2 (KEEP_CLIENT_ID/SECRET). Returns consent URL. |
| `formsIsConnected` | forms.gs:80 | `email` | **bare boolean** | True if a `forms_rt_<email>` refresh token exists. |
| `gfListMyForms` | forms.gs:149 | `email` | `{ ok, forms:[] }` / `{ ok:false, needsAuth }` / `{ ok:false, error }` | Drive query for caller-owned Google Forms. |
| `gfPublishForm` | forms.gs:189 | `title, description, questionsJson, settingsJson, email` | `{ ok, formId, editUrl, publishedUrl }` / `{ ok:false, needsAuth\|error }` | Creates form via Forms API; saves metadata to Forms sheet. |
| `gfUpdateForm` | forms.gs:235 | `formId, title, description, questionsJson, settingsJson, email` | `{ ok, ... }` / `{ ok:false, needsAuth\|error }` | Rewrites items via batchUpdate; updates Forms sheet metadata. |
| `gfGetForm` | forms.gs:278 | `formId, email` | `{ ok, form:{ id, title, description, questions, responderUri } }` / `{ ok:false, needsAuth\|error }` | Reads form structure. |
| `gfGetResponses` | forms.gs:297 | `formId, email` | `{ ok, responses:[], count }` / `{ ok:false, needsAuth\|error }` | Maps responses to question titles. |
| `gfDeleteForm` | forms.gs:326 | `formId, email` | `{ ok }` / `{ ok:false, needsAuth\|error }` | Trashes Drive file; marks Forms sheet row inactive. |
| `gfGetSharedForms` | forms.gs:350 | `email` | `{ ok, forms:[] }` or `{ ok:false, error, forms:[] }` | Forms shared to caller (Visibility All, or Team match), Active status only, excluding own. |
| `gfGetMyFormsMeta` | forms.gs:384 | `email` | `{ ok, forms:[{ Form_ID, Status, Visibility }] }` or `{ ok:false, forms:[] }` | Sharing metadata for caller-created forms. |
| `gfSetFormSharing` | forms.gs:401 | `formId, visibility, share, email` | `{ ok, status, visibility }` or `{ ok:false, error }` | `_isManager`; only form creator or admin may change sharing. |
| ⚠ `submitFormResponse` | **NOT FOUND** | called as `(formId, JSON.stringify(answers), email)` at app.js.html:14810 | n/a | **Planned / Not implemented — broken call.** No `function submitFormResponse` exists in any `.gs` file. This `google.script.run` invocation will fail at runtime. |

### 15.15 Attachments

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `uploadAttachment` | attachments.gs:39 | `entityType, entityId, fileName, mimeType, base64Data, email` | `{ ok, id, driveFileId, viewUrl, downloadUrl, fileType, fileName }` or `{ ok:false, error }` | Any authenticated user. Uploads to Drive (ANYONE_WITH_LINK view), records Attachments row. |
| `getAttachments` | attachments.gs:84 | `entityType, entityId, email` | `{ ok, attachments:[] }` or `{ ok:false, error, attachments:[] }` | Any authenticated user. Active attachments for the entity. |
| `getAllAttachmentCounts` | attachments.gs:115 | `email` | `{ ok, counts:{ entityId:n } }` or `{ ok:false, counts:{} }` | Any authenticated user. Batch counts for list-view badges. |
| `deleteAttachment` | attachments.gs:132 | `attachmentId, email` | `{ ok }` or `{ ok:false, error }` | Uploader or `_isAdmin`. Trashes Drive file (soft-delete row). |

### 15.16 Due Date Change Requests

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `requestDueDateChange` | dueDateRequests.gs:14 | `record, email` (`entityType/entityId/entityTitle/currentDate/requestedDate/reason`) | `{ ok, direct:true }` (applied directly) or `{ ok, direct:false, requestId }` or `{ ok:false, error }` | `_isAdmin` or the entity's own assigner → `direct:true` (no request). Others → pending Due_Date_Requests row. |
| `getDueDateRequests` | dueDateRequests.gs:65 | `email` | `{ ok, requests:[] }` or `{ ok:false, error }` | Admin = all pending; others = where they are `Approver_ID`. |
| `getPendingDueDateCount` | dueDateRequests.gs:109 | `email` | `{ ok, count }` | Count of visible pending requests (badge). |
| `approveDueDateChange` | dueDateRequests.gs:121 | `requestId, email` | `{ ok }` or `{ ok:false, error }` | `_isAdmin` or the request's approver. Writes `Due_Date`(Task)/`Deadline`(Function) on the entity. |
| `rejectDueDateChange` | dueDateRequests.gs:155 | `requestId, notes, email` | `{ ok }` or `{ ok:false, error }` | `_isAdmin` or the request's approver. |

### 15.17 Migration / Import

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `migrationPreview` | migration.gs:388 | `email, sheetId, sheetName` | `{ ok, sheetName, spreadsheetName, availableTabs, totalRows, rows, skipped, unmatchedAssigners, unmatchedExecutors }` or `{ ok:false, error }` | Any authenticated user (only `getCurrentUser` — **no role gate**). Reads via Sheets REST API; fuzzy header matching. |
| `migrationImport` | migration.gs:426 | `email, sheetId, projId, rowIndices, sheetName` | `{ ok, created, subCreated, total, projId }` or `{ ok:false, error }` | Any authenticated user (**no role gate**). Inserts Function→Sub-Function→Task hierarchy for selected rows. |
| `migrationImportDirectRows` | migration.gs:467 | `email, projId, rowsData` | `{ ok, created, subCreated, total, projId }` or `{ ok:false, error }` | Any authenticated user (**no role gate**). CSV-upload path; enforces Sub-Function-needs-parent-Function. |

### 15.18 Chat Spaces

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `chatGetAuthUrl` | chatSpaces.gs:21 | `email` | `{ ok, url }` or `{ ok:false, error }` | Per-user OAuth2 (KEEP_CLIENT_ID/SECRET). Returns Chat consent URL. |
| `getChatSpaceConfig` | chatSpaces.gs:388 | `email` | `{ teams, general, connected }` (no `ok` field) | Any user. `connected` true if caller or any active SA/Admin has a Chat token. |
| `syncChatSpacesFromUI` | chatSpaces.gs:420 | `email` | `{ ok }` or `{ ok:false, error }` | `_isAdmin` only. Requires connected Chat token; runs full team/project space sync. |

### 15.19 Personal Tasks API (Todos / Notes / Ideas)

These wrap the per-user Todos/Notes/Ideas sheets behind a Google-Tasks-style interface keyed by virtual list IDs (`TASK_LIST_TODOS/NOTES/IDEAS`).

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `tasksEnsureLists` | task.gs:62 | `email` | `{ ok, lists:{ name:listId } }` or `{ ok:false, error }` | Any authenticated user. Returns the three virtual list IDs. |
| `tasksListTasks` | task.gs:73 | `tasklistId, email` | `{ ok, tasks:[] }` or `{ ok:false, error }` | Own data. Dispatches to `getTodos`/`getNotes`/`getIdeas`. |
| `tasksCreateTask` | task.gs:94 | `tasklistId, title, notes, email` | `{ ok, task }` or `{ ok:false, error }` | Own data. Inserts Todo/Note/Idea row. |
| `tasksUpdateTask` | task.gs:124 | `tasklistId, taskId, title, notes, status, email` | `{ ok, task }` or `{ ok:false, error }` | Own data. Patches Todo/Note/Idea row. |
| `tasksDeleteTask` | task.gs:173 | `tasklistId, taskId, email` | `{ ok }` or `{ ok:false, error }` | Own data. Dispatches to `deleteTodo`/`deleteNote`/`deleteIdea`. |

### 15.20 Org Chart

| Function | File | Parameters | Returns | Notes (RBAC gate / side-effects) |
|---|---|---|---|---|
| `getOrgChartData` | auth.gs:817 | (none — **no email param**) | `{ ok, employees:[{ empId, name, role, designation, team, subDept, managerId }] }` or `{ ok:false, error }` | No session check. Returns all active employees for the org chart. |

---

## Verification — GAS Functions

- [ ] Open `src/auth.gs` and confirm `submitWorkLog(record, email)` at line 1216 -> returns a bare new `Log_ID` string (not an `{ ok }` object), wraps the insert in `LockService.getScriptLock().tryLock(20000)`, and writes `Status`/`Comments` only when `_isManager(user.role)`.
- [ ] In `src/auth.gs` confirm `updateWorkLog(logId, updates, email)` at line 1294 -> gated by "own log or `_isAdmin`", and the frontend calls it as `.updateWorkLog(data.logId, updates, APP.currentUser.email)` (app.js.html:3201).
- [ ] In `src/weekly-summary.gs` confirm `getWeeklySummary(callerEmail, weekStart)` at line 348 -> returns `{ ok, found, content, isEdited, ... }` and matches rows by lowercased email + normalised `Week_Start`.
- [ ] In `src/weekly-summary.gs` confirm `generateMyWeeklySummary(callerEmail, weekStart)` at line 400 -> aborts with "No work logs found" when the week has no logs, and the AI call uses model id `gemini-2.5-flash` with `GEMINI_API_KEY`.
- [ ] In `src/weekly-summary.gs` confirm `getMisSummaries(callerEmail, weekStart)` at line 456 -> gated by `_wsHasMisAccess(user.email)` returning `{ ok:false, error:'Access denied' }` otherwise, and dedupes by `Summary_ID`.
- [ ] Grep `app.js.html` for `submitFormResponse` -> exactly one call site (line 14810) and grep all `.gs` files -> zero matching `function submitFormResponse` definitions (confirms the broken/planned call).
- [ ] In `src/work-duration.gs` confirm `wdClockOut(email, sessionId, customTime, reason)` at line 89 -> returns `{ ok, clockOut, netMins, totalBreakMins }` and there is no 18-hour cap constant (daily reset handled by the `wdAutoClockOut` trigger).
- [ ] In `src/dueDateRequests.gs` confirm `requestDueDateChange(record, email)` at line 14 -> returns `{ ok, direct:true }` when caller `_isAdmin` or is the entity's `Assigner_ID`, else creates a pending `Due_Date_Requests` row.
- [ ] In `src/migration.gs` confirm `migrationImport` (line 426) and `migrationImportDirectRows` (line 467) -> call only `getCurrentUser(email)` with no `_isManager`/`_isAdmin` gate (any authenticated user can import).
- [ ] In `src/auth.gs` confirm `getOrgChartData()` (line 817) and in `src/migration.gs` `getDeployerEmail()` (line 53) -> both take no `email` parameter and perform no session validation.


---

## 16. Known Bugs Fixed (Session History)

This section catalogs bugs that were found and fixed during development so QA can confirm they stay fixed. Every row below was cross-checked against the current `src/` source — the identifiers cited are the ones that exist in code today. Use the "## Verification — Regressions" checklist at the end to re-test each one after any deploy.

> Note: The two root reference docs named in the task brief (`LGDesk_PRD.md`, `PROJECT_CONTEXT.md`) are listed in `git status` but are **not present on disk** at the project root at verification time (root currently holds `CLAUDE.md`, `CODEX_PROMPT.md`, `LG_Desk_Migration_Quickstart.md`, `LG_Desk_User_Manual.md`, `TESTING.md`). The bugs below are therefore derived from the `CLAUDE.md` "Recent Changes" changelog and verified directly against the code.

### 16.1 Bug-fix table

| Bug | Symptom | Fix Applied | File(s) |
|---|---|---|---|
| Work-log data loss on render | Opening the weekly Work Log fired attendance `onchange` during the initial paint, dirtying every row and triggering a spurious auto-save that could overwrite real data | `WL_RENDERING` flag (declared `app.js.html:1760`) set `true` at `renderWeekLog` start (`:2014`) and `false` after chip render (`:2246`); `wlOnAttendanceChange` guards with `if (!WL_RENDERING) { wlMarkDirty(iso); _wlAutoSave(iso); }` (`:2303`). Team modal mirror: `ML_RENDERING` (`:4084`, set `:4488`/`:4718`) guards `_mlAutoSave` in the row `onchange`/`onblur` (`:4607`, `:4633`) and an early `if (ML_RENDERING) return;` (`:4775`) | `app.js.html` |
| Work-log ID collision (duplicate Log_ID) | Two concurrent saves received the same CacheService-backed ID from `generateId`, producing duplicate / overwriting rows | Insert branch wrapped in `LockService.getScriptLock()` (`auth.gs:1217`, `:1392`); new `_wlNextId()` (`auth.gs:1201`) reads the sheet directly, scans the ID column for max, returns next padded ID (called `:1224`, `:1400`). Intern log mirror: `_ilNextId()` (`intern-work-log.gs:13`, called `:94`, `:177`). Update branches (known logId) are not locked — only inserts | `auth.gs`, `intern-work-log.gs` |
| Team WL member modal opened in wrong mode | When the team view was in Month or Custom mode, opening a member's log detail still rendered a fixed 7-day Mon–Sun week, so out-of-week days (e.g. June 16–30) were never shown/fetched | Modal loop driven by `_mlDays()` (`app.js.html:4211`) which returns the correct day list for `ML_MODE` `month`/`custom`/`week`/`day`; `ML_MODE` mirrors `TL_MODE` at open (`:4108`); nav arrows hidden for month/custom; range label via `_mlRangeLabel`/`_mlDays` (`:4234`–`:4246`). `mlNav`/`mlNavToday` no longer force `week` when mode is month/custom (`:4199`, `:4207`) | `app.js.html` |
| Filter / searchable-select dropdown closed on inner scroll | Scrolling inside the open dropdown list closed it, because the global scroll listener closed on any scroll event | Scroll handler keeps the dropdown open when the scroll target is inside the open portal: `if(openDrop&&e.target&&e.target.nodeType===1&&openDrop.contains(e.target))return;` then `closeAll()` (`app.js.html:350`–`356`). Multi-select portal mirror uses the same containment check on both `mousedown` (`:630`) and `scroll` (`:636`–`639`) — closes only when the scroll/click is outside `portal`/`wrap` | `app.js.html` |
| Weekly summary "not found" (Date vs string mismatch) | `Week_Start` read back from the sheet as a `Date` object never `===`-matched the `'YYYY-MM-DD'` string the frontend sent, so lookups returned empty | `_wsNormaliseDate(val)` (`weekly-summary.gs:54`) normalises any stored value to a comparable string; applied in dedup (`:279`), `getWeeklySummary`/save lookups (`:354`, `:380`), and MIS dedup (`:465`) | `weekly-summary.gs` |
| Weekly summary showed only 1–2 bullets | AI summaries were truncated and/or read no work content because the wrong Work_Log column names were referenced and the token cap was too low | Work chips read from the real column name `'Work Update - 1st Half'` via `_wsParseWorkChips(row['Work Update - 1st Half'])` (`weekly-summary.gs:213`); `generationConfig` raised to `maxOutputTokens: 2048` with `temperature: 0.4` (`:178`). Model is `gemini-2.5-flash` keyed by Script Property `GEMINI_API_KEY` | `weekly-summary.gs` |
| Monthly member card stuck on loading spinner | Nested function declarations inside `_tlMemberMonthCards` hit GAS hoisting issues, throwing during render and leaving the spinner forever | Attendance label/order/colour maps moved to module-level constants `_TLM_ATT_LABELS` (`app.js.html:3890`), `_TLM_ATT_ORDER` (`:3901`), `_TLM_ATT_COLORS` (`:3906`); inner loops use plain indexed `for` with unique index vars; both `_tlByMember` call sites wrapped in try/catch surfacing the JS error inline instead of hanging | `app.js.html` |
| Team WL overtime (OT) under-counted | OT summed only the `Extra Hours` column, ignoring implicit overtime from Extra Full Day / Extra Half Day attendance | OT now = Σ(Extra Hours) + (Extra Full Day × 9) + (Extra Half Day × 4): `var otHrs = 0` (`app.js.html:3934`), then `otHrs += extra` (`:3944`), `if (attVal === 'Extra Full Day') otHrs += 9` (`:3945`), `if (attVal === 'Extra Half Day') otHrs += 4` (`:3946`); rounded after the loop | `app.js.html` |
| Auto-save created duplicate records / chips | No in-flight guard meant a second auto-save fired before the first returned (no logId yet) → duplicate row; and the dirty flag was cleared while a debounce was still pending → lost edits | `if (WL_SAVING[iso]) return;` guard at top of `saveWeekEntry`; same `if (ML_SAVING[iso]) return;` for `_mlSaveEntry`. Dirty cleared only when no save is pending (`if (!WL_DEBOUNCE[iso]) delete WL_DIRTY`). `onSuccess` stores returned `logId` back into `WL_DATA[iso]`; `loadMyWorkLogs` dedups duplicate-date rows keeping the richest record. `_mlSaveEntry` `onDone` no longer overwrites `work1`/`work2` with a stale snapshot (managed exclusively by `_mlAddItem`/`_mlRemoveItem`) | `app.js.html` (changelog #16, #20, #21, #30) |
| `wdEndBreak` never updated `Total_Break_Mins` | After Resume, the break display stuck at the old/manual value because only `Work_Breaks` rows and `Status: ACTIVE` were written | `wdEndBreak` now reads current `Total_Break_Mins`, adds the just-ended break, and writes `newTotalBreakMins = Math.round(existingBreakMins + bMins)` back to Work_Duration (`work-duration.gs:201`–`203`); explicit cache invalidation follows so `wdGetStatus` sees fresh data | `work-duration.gs` |
| HRS pre-fill leaked onto future days | Meeting-derived HRS values pre-filled future-dated rows because the future guard used `!isAdmin`, which is `false` for admin/TC/TF roles | Condition is now role-independent date compare: `else if (WL_AUTO_HRS[iso] && iso <= today) { hrsPreFill = String(WL_AUTO_HRS[iso]); }` (`app.js.html:2081`–`2082`). Future days (`iso > today`) never receive meeting-derived HRS | `app.js.html` |
| Work Log STATUS / Comments not settable by TC/TF | `submitWorkLog` hardcoded `Status: ''`/`Comments: ''` on new entries, discarding manager-entered status | `submitWorkLog` writes `Status: _isManager(user.role) ? (record.status || '') : ''` (`auth.gs:1244`); admin path `adminSubmitWorkLog` writes `Status: record.status || ''` (`auth.gs:1428`). `_canEditWlStatus` (= `_isManager` set) gates the editable Status/Comments in the frontend; `saveWeekEntry` adds status/comments to the new-entry record for managers | `auth.gs`, `app.js.html` |
| Auto-login silently broken (sessions never persisted) | `_sp()` was never defined, so every session call (`validateSession`, login token creation, `createSession`) threw `_sp is not a function` inside try/catch and silently failed — no token was ever written/read | `function _sp() { return PropertiesService.getScriptProperties(); }` defined at the Session Management section (`auth.gs:1859`), making `auth.gs` self-contained. Frontend `DOMContentLoaded`/`validateSession` null-guards strengthened to reject `'null'`/`'undefined'` strings and keep the token on transient errors | `auth.gs`, `app.js.html` |
| Registration "No manager assigned for this team" | When a team had no Team Captain and no default was configured, `getTeamCaptainByTeam` returned `{ok:false}` immediately, blocking registration | Multi-step fallback added in `getTeamCaptainByTeam` (`auth.gs:1525`): (1) Script Property `LGD_DEFAULT_MANAGER_EMAIL` (`:1562`); (2) any active Super Admin; (3) any active Admin; only then `{ok:false}`. Helper sets the default property (`:1592`) | `auth.gs` |
| Auto-save 30s timer dropped uncommitted textarea text | The interval auto-save saved chips only, losing text typed into the custom textarea but not yet committed | Removed in changelog #21 (30s interval replaced by 500ms per-row debounce). Earlier #18 made the timer commit `wl-cust-h1/h2` textarea content via `wlAddCustom` before saving; #16 fixed auto-save to compute `work1`/`work2` from committed chips only to avoid duplicate chips | `app.js.html` (changelog #16, #18, #21) |
| Member-log modal opened on the wrong week | Opening a member's detail unconditionally reset the anchor to the current week, ignoring the week the manager was viewing | `openMemberLogDetail` seeds `ML_ANCHOR = new Date(TL_ANCHOR || new Date())` + `ML_MODE = TL_MODE`; `loadMemberLogDetail` normalises via `_mlWeekMonday(ML_ANCHOR || new Date())` so the modal opens to the manager's viewed week | `app.js.html` (changelog #4 [#17 bug 4], #7.1) |
| CSV import: multiline quoted cells split incorrectly | A blank-line-separated URL list in a Links cell was split into a spurious extra Function row | `_parseCsv` replaced line-by-line split with an RFC-4180 character-by-character parser that respects quoted newlines | `migration.gs` / `app.js.html` (changelog #35) |
| CSV import: data-validation rejection on shorthand status | Importing rows with `WIP`, `in progress`, `stuck`, `shared` etc. triggered a Google Sheets "data validation rules" error | `normaliseStatus` (frontend) and `_migMapStatus` (backend) restricted to sheet-valid values; `WIP` → `WIP (0%-25%)`, aliases mapped to canonical statuses | `app.js.html`, `migration.gs` (changelog #35) |
| Import wrote `1899-12-30` for empty deadlines | Blank deadline fields were written as the Google Sheets epoch date | Empty deadlines sanitised — rejected unless matching a date pattern (`_migNormaliseDate`); same guard in `_migBuildEmpMap` empty-field handling | `migration.gs` (changelog #24, #34) |
| Sub-Function without parent Function imported silently | Task rows with a Sub-Function but no Function created an orphaned hierarchy | Core hierarchy rule enforced on all row types: a Sub-Function cannot exist without a parent Function on the same row; invalid rows surfaced in the preview with row number + reason | `migration.gs`, `app.js.html` (changelog #34) |
| Function dropdown blank in task edit modal | The function dropdown was empty when a task had no project, and a race set `fnSel.value` before async options loaded | `_tskLoadFunctions` reads synchronously from `APP.functions` instead of an async `getFunctions` call; when projId is empty it shows all top-level functions | `app.js.html` (changelog #33) |
| Clock-out edit validation falsely blocked active sessions | Edit-working-day save was rejected when break minutes exceeded elapsed time | `_wdSaveEditDay` validation checks `end > start` only (no longer subtracts break); success handler pre-seeds session fields and restarts the timer before reload | `app.js.html`, `work-duration.gs` (changelog #11) |
| Break duration display showed stale value after manual edit | Manual `Total_Break_Mins` overrides were ignored because the display summed only `Work_Breaks` timestamps | `wdGetStatus` returns `totalBreakMins = max(sum(Break_Mins), session.Total_Break_Mins)` (`work-duration.gs:270`–`275`, `:613`); `_wdSaveBreakEdit` seeds the value before reload; `_wdBreakMsFromTimestamps` uses stored mins as a floor and adds any ongoing break | `work-duration.gs`, `app.js.html` (changelog #9, #13) |

### 16.2 Cross-cutting patterns introduced by these fixes

- **Render guards** (`WL_RENDERING`, `ML_RENDERING`): suppress `onchange`/`onblur` auto-save during programmatic re-render.
- **In-flight + dirty-flag discipline** (`WL_SAVING`/`ML_SAVING`, `WL_DEBOUNCE`/`ML_DEBOUNCE`, `WL_DIRTY`/`ML_DIRTY`): one save in flight per row; dirty cleared only when no debounce is pending; returned `logId` written back to state.
- **Atomic ID generation under lock** (`_wlNextId`, `_ilNextId` + `LockService`): bypasses CacheService and reads the sheet for the true max ID on insert.
- **Date normalisation at boundaries** (`_wsNormaliseDate`, `_migNormaliseDate`): never compare a sheet `Date` object to a string; never write epoch junk dates.
- **Portal containment checks**: dropdowns close on outside click/scroll but never on interaction inside the portal (`portal.contains(e.target)`).

## Verification — Regressions

- [ ] Open the weekly Work Log (no edits) -> no row shows a "Saving…"/"Saved ✓" indicator and no auto-save fires on load (WL_RENDERING guard holds).
- [ ] Save two work-log entries in rapid succession for two users -> each receives a distinct `Log_ID`, no duplicate/overwritten rows (LockService + `_wlNextId`).
- [ ] Save two intern work-log entries concurrently -> distinct IDs via `_ilNextId`, no collisions.
- [ ] Switch Team Work Log to Month mode, open a member's log detail -> the modal shows the full month's days (e.g. all of June), not a single Mon–Sun week; nav arrows are hidden (`_mlDays`/`ML_MODE`).
- [ ] Open a long filter / searchable-select dropdown and scroll inside its list -> the dropdown stays open; click/scroll outside it -> it closes (portal `contains` check).
- [ ] Generate or open a weekly summary for a week whose `Week_Start` is stored as a Date -> the summary is found and displayed (not "not found") (`_wsNormaliseDate`).
- [ ] Generate a weekly summary for an employee with a full week of work updates -> 5–10 bullet points appear, not 1–2 (`'Work Update - 1st Half'` column + `maxOutputTokens: 2048`, model `gemini-2.5-flash`).
- [ ] Open the Team Work Log monthly member cards view -> cards render with OT badge + attendance breakdown, no stuck spinner (`_TLM_ATT_*` constants).
- [ ] For a member with logged Extra Full/Half Days plus Extra Hours, check the OT total -> equals Σ(Extra Hours) + EF×9 + EH×4 (`otHrs` accumulation).
- [ ] Rapidly add several chips while a save is in flight -> exactly one record per date, no duplicate chips, no lost edits (in-flight guard + dirty-flag race fix).
- [ ] Start a break, set a manual break value, then Resume -> break display reflects the updated `Total_Break_Mins` and keeps ticking, not the stale value (`wdEndBreak` writes `newTotalBreakMins`).
- [ ] As an admin/TC/TF, view a future-dated Work Log row -> the HRS field shows the placeholder, not a meeting-derived number (`WL_AUTO_HRS[iso] && iso <= today`).
- [ ] As a Team Captain/Facilitator, set a Status/Comments on a brand-new Work Log entry and save -> the Status/Comments persist (`_isManager(user.role) ? record.status : ''`).
- [ ] Log in, reload the page -> the session restores from `localStorage`/ScriptProperties without re-login (`_sp()` defined).
- [ ] Register for a team that has no Team Captain configured -> a fallback manager (default property, then Super Admin, then Admin) is assigned, not "No manager assigned" (`getTeamCaptainByTeam`).
- [ ] Open a member's Work Log detail from a Team view anchored on a past week -> the modal opens on that same week, not the current week (`ML_ANCHOR`/`TL_ANCHOR`).
- [ ] Import a CSV with a multiline quoted Links cell -> no spurious extra Function row is created (RFC-4180 parser in `_parseCsv`).
- [ ] Import a CSV using shorthand statuses (`WIP`, `in progress`, `stuck`) -> rows import without a data-validation error (`normaliseStatus`/`_migMapStatus`).
- [ ] Import a CSV with empty Deadline cells -> no `1899-12-30` dates are written (`_migNormaliseDate`).
- [ ] Import a CSV row with a Sub-Function but no Function -> the row is flagged invalid in the preview, not silently imported (hierarchy rule).
- [ ] Open the task edit modal for a task with no project -> the Function dropdown lists all top-level functions instead of being blank (`_tskLoadFunctions` synchronous).
- [ ] Edit a working day on an active session where break minutes exceed elapsed time -> the save is accepted (validation checks `end > start` only).
