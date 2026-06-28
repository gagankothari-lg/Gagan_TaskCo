# LG Desk — Production Build Reference
> Stack: NestJS 10 + PostgreSQL/Neon + Next.js 14 | Design: Dark Command
> Read this file at the start of EVERY session. All rules live here.

## Tech Stack
| Layer | Technology |
|---|---|
| Database | PostgreSQL on Neon (serverless, free tier) |
| ORM | Prisma 5 |
| Backend | NestJS 10, TypeScript strict mode |
| Auth | Passport.js + @nestjs/jwt + bcrypt (rounds=12) |
| Validation | class-validator + class-transformer |
| Frontend | Next.js 14 App Router, TypeScript strict mode |
| UI | Tailwind CSS v3 + shadcn/ui + Lucide React (no emoji, no MUI icons) |
| Data Fetching | TanStack Query v5 |
| Forms | React Hook Form v7 + Zod v3 |
| Background Jobs | @nestjs/schedule (cron — no BullMQ, no Redis) |
| Email | Resend SDK |
| File Storage | Google Drive API (googleapis npm) |
| AI | Gemini 2.5 Flash via fetch (weekly summaries only) |
| Package Manager | pnpm |
| Deployment | Vercel (web) + Railway (api) |

## Monorepo Structure
```
lgdesk/
├── apps/
│   ├── api/                    # NestJS — port 3001
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── prisma/
│   │   │   ├── common/         # guards, interceptors, decorators, utils
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── tasks/
│   │   │   ├── projects/
│   │   │   ├── functions/      # WorkFunction (not 'function' — reserved word)
│   │   │   ├── work-log/
│   │   │   ├── work-duration/
│   │   │   ├── leaves/
│   │   │   ├── meetings/
│   │   │   ├── dashboard/
│   │   │   ├── directory/
│   │   │   ├── announcements/
│   │   │   ├── notes/          # todos + notes + ideas (personal)
│   │   │   ├── attachments/
│   │   │   ├── ddr/
│   │   │   └── weekly-summary/
│   │   └── prisma/schema.prisma
│   └── web/                    # Next.js — port 3000
│       └── src/
│           ├── app/
│           │   ├── (auth)/     # login, forgot-password
│           │   └── (dashboard)/
│           ├── components/
│           │   ├── ui/         # shadcn/ui
│           │   └── modules/    # per-feature components
│           ├── lib/
│           │   ├── api.ts
│           │   ├── auth.ts
│           │   └── design-tokens.ts
│           └── hooks/
└── packages/
    └── types/
        └── src/index.ts
```

## Six Roles
```typescript
export const ALL_ROLES    = ['Super Admin','Admin','Team Captain','Team Facilitator','Team Member','Intern'] as const
export const ADMIN_ROLES  = ['Super Admin','Admin'] as const
export const MANAGER_ROLES= ['Super Admin','Admin','Team Captain','Team Facilitator'] as const
export const isAdmin  = (role: string) => ADMIN_ROLES.includes(role as any)
export const isManager= (role: string) => MANAGER_ROLES.includes(role as any)
```

## API Response Shape — enforced by ResponseInterceptor
```typescript
// Success:
{ ok: true, data: <payload> }
// Error:
{ ok: false, error: "<human-readable string>" }
// HTTP: 200 GET | 201 POST | 400 validation | 401 unauth | 403 forbidden | 404 notfound | 409 conflict | 500 server
```

## ID Formats (5-digit zero-padded, auto-incremented)
```
TSK-XXXXX  PRJ-XXXXX  FN-XXXXX  EMP-XXXXX  WL-XXXXX
IWL-XXXXX  DDR-XXXXX  MTG-XXXXX  LV-XXXXX  UPD-XXXXX
ATT-XXXXX  REG-XXXXX
```

ID generation helper (in `common/utils/id.utils.ts`):
```typescript
async generateId(model: string, idField: string, prefix: string): Promise<string> {
  const last = await this.prisma[model].findFirst({ orderBy: { createdAt: 'desc' } })
  if (!last) return `${prefix}-00001`
  const n = parseInt(last[idField].split('-').pop())
  return `${prefix}-${String(n + 1).padStart(5, '0')}`
}
```

## Array Fields — Storage Pattern
Arrays stored as comma-separated strings in DB, always returned as string[] in API:
```typescript
const parseIds = (s: string): string[] => s ? s.split(',').filter(Boolean) : []
const joinIds  = (a: string[]): string => a.filter(Boolean).join(',')
// DB: assigneeIds = "EMP-00001,EMP-00002"
// API: assigneeIds = ["EMP-00001","EMP-00002"]
```

## Design System: Dark Command
```typescript
// apps/web/src/lib/design-tokens.ts
export const tokens = {
  colors: {
    bg:              '#0D1117',
    sidebar:         '#161B22',
    header:          '#161B22',
    card:            '#21262D',
    border:          '#30363D',
    text:            '#E6EDF3',
    textSec:         '#8B949E',
    accent:          '#58A6FF',
    accentBg:        'rgba(88,166,255,0.1)',
    success:         '#3FB950',
    warning:         '#E3B341',
    danger:          '#F85149',
    sidebarText:     'rgba(230,237,243,0.5)',
    sidebarTextActive:'#E6EDF3',
    sidebarActive:   'rgba(255,255,255,0.07)',
  },
  radius: { sm:'3px', md:'6px', lg:'10px', pill:'9999px' },
  font: {
    sans: 'Inter, system-ui, -apple-system, sans-serif',
    mono: "'Courier New', Courier, monospace", // task IDs and codes only
  },
}
```

Tailwind shorthand for Dark Command:
- Page bg:      `bg-[#0D1117]`
- Sidebar:      `bg-[#161B22]`
- Card:         `bg-[#21262D] border border-[#30363D]`
- Primary text: `text-[#E6EDF3]`
- Muted text:   `text-[#8B949E]`
- Accent:       `text-[#58A6FF]` / `bg-[#58A6FF]`
- Accent bg:    `bg-[rgba(88,166,255,0.1)]`
- Success:      `text-[#3FB950]`
- Warning:      `text-[#E3B341]`
- Danger:       `text-[#F85149]`
- Border:       `border-[#30363D]`
- Radius:       `rounded-[6px]` (default), `rounded-[10px]` (modals)
- Task IDs:     `font-mono text-[#8B949E] text-xs`
- Sidebar width: `w-48` (192px)
- Header height: `h-13` (52px)

## 22 Critical Business Rules — Never Violate
```
1.  passwordHash NEVER in any API response
2.  assignerId / ownerId NEVER from request body — always from JWT
3.  isAdmin  = ['Super Admin', 'Admin'] ONLY
4.  isManager = ['Super Admin', 'Admin', 'Team Captain', 'Team Facilitator'] ONLY
5.  Scoreboard: Math.max(0, done×10 + inProgress×3 − overdue×5)  [logs term = 0]
6.  Task overdue: dueDate < TODAY AND status NOT in ['Done','Cancelled'] AND dueDate NOT NULL
7.  Half Day leave: startDate MUST equal endDate, days MUST equal 0.5
8.  Net_Work_Mins = gross_minutes − totalBreakMins  (totalBreakMins is CUMULATIVE)
9.  Auto clock-out fires at midnight-UTC (05:30 IST) — NOT an 18-hour elapsed cap
10. totalBreakMins grows on every end-break — NEVER replaced or reset
11. Intern logs → InternWorkLog table ONLY; TM/TC/TF/Admin → WorkLog ONLY
12. MIS Report: ONLY users in MisAccess table may call getMisSummaries
13. DDR: non-assigners submit request; assigners/admins change date directly
14. Task IDs: TSK-XXXXX (5-digit). Never 4-digit.
15. Announcements: visibility and expiresAt are proper DB columns
16. Role re-validated from DB on EVERY privileged action (never trust JWT role alone)
17. Attachment soft-delete: isDeleted=true — file stays in Google Drive
18. WeeklySummary content: newline-delimited bullets, NO leading "• " character
19. weekStart: always normalized to Monday (date-fns startOfWeek({weekStartsOn:1}))
20. bcrypt rounds=12 for all passwords. No SHA-256+salt.
21. Meetings: DB is source of truth. Google Calendar = invite layer only.
22. TM self-assign functions: allowed only when assigneeIds is empty OR = [their own empId]
```

## Out of Scope — Do NOT Build
- AI Summary Reports via Claude API
- Google Forms module
- Google Chat Spaces module
- Data migration from GAS/Google Sheets
- Docker / containerisation
- Google OAuth login

## Common Pitfalls — Avoid
- Never use raw SQL — Prisma only
- Never return passwordHash — omit via Prisma select or manual delete
- Never create test files unless a test prompt explicitly requests them
- Never modify prisma/schema.prisma unless the current prompt says to
- Never import from '@prisma/client' directly — use PrismaService only
- Never hardcode empId in services — always use @CurrentUser() from JWT
- Performance: use virtual scrolling (react-virtual) for lists > 50 items
- Performance: use TanStack Query staleTime ≥ 30s for reference data (roles, teams)
