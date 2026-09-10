# AGENTS.md - Developer Guidelines for IJESoft HRIS

## Technology Stack

- **Framework**: Next.js 14 (React 18) — App Router
- **Database**: MongoDB with Prisma ORM
- **UI**: Radix UI + shadcn/ui + Tailwind CSS (futuristic dark glass theme, see `app/globals.css` utilities)
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **Auth**: Cookie-based (custom implementation) + NextAuth Google OAuth bridged to app cookies
- **Date handling**: date-fns
- **Excel/CSV**: xlsx

---

## Commands

```bash
# Development
npm run dev          # Dev server on port 3000
npm run build        # Production build
npm run start        # Production server
npm run lint         # Run ESLint

# Database
npm run db:push      # Push schema changes to MongoDB
npm run db:seed      # Seed database with sample data
npx prisma studio    # Open Prisma GUI

# Scripts
npm run leave-accrual    # Run monthly leave accrual
npm run link-users       # Link users to employees by email
```

---

## Code Style

### General
- TypeScript with **strict mode** (no `any`; use `unknown` or specific types)
- 2 spaces indentation, single quotes, trailing commas, semicolons
- Max line length ~100 characters
- Export functions/components at top level (no default exports)

### Imports (order)
1. React/Next imports
2. External libs
3. Internal imports (@/ alias)
4. Type imports at bottom

```typescript
import { useState, useEffect } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Employee } from '@/types'
```

### Naming
- **Components/files**: PascalCase (`EmployeeCard.tsx`) or kebab-case for pages (`employees/page.tsx`)
- **Variables/functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Interfaces/Types**: PascalCase (no `I` prefix)

### React Components
```typescript
'use client'

interface Props {
  employee: Employee
  onSelect: (id: string) => void
}

export function EmployeeCard({ employee, onSelect }: Props) {
  const [loading, setLoading] = useState(false)
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold">{employee.fullName}</h3>
    </div>
  )
}
```

### API Routes
```typescript
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const employees = await prisma.employee.findMany({
      where: id ? { id } : {},
    })
    return NextResponse.json(employees)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
```

---

## Key Patterns

### Error Handling
- Always wrap async operations in try/catch
- Log errors with `console.error('Context:', error)`
- Return meaningful error messages with appropriate HTTP status codes
- Check for Prisma errors: `error instanceof Prisma.PrismaClientKnownRequestError`

### Role-Based Access Control
Use `hasAdminAccess()` from `@/lib/auth-helpers` and `getEmployeeIdForUser()` from `@/lib/user-employee-link`:

```typescript
import { hasAdminAccess } from '@/lib/auth-helpers'
import { getEmployeeIdForUser } from '@/lib/user-employee-link'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('userRole')?.value
  const userEmail = cookieStore.get('userEmail')?.value

  // Admin/HR/MANAGER see all data
  if (hasAdminAccess(userRole || '')) {
    // Return all records
  } else {
    // EMPLOYEE sees only their own data
    const linkedEmployeeId = await getEmployeeIdForUser(userEmail || '', userRole || '')
    // Filter by employeeId
  }
}
```

### Date Handling (Manila Timezone)
**CRITICAL**: Always use Manila timezone for time-related operations:

```typescript
const MANILA_TIMEZONE = 'Asia/Manila'

function getManilaNow(): Date {
  const now = new Date()
  return new Date(now.toLocaleString('en-US', { timeZone: MANILA_TIMEZONE }))
}

// For date queries
function getManilaToday(): { start: Date; end: Date } {
  const now = getManilaNow()
  return {
    start: startOfDay(now),
    end: endOfDay(now),
  }
}

// Display: Use getUTCHours/getUTCMinutes for Philippines time
const hours = date.getUTCHours()
const minutes = date.getUTCMinutes()
```

### Prisma (MongoDB)
```typescript
// MongoDB uses @db.ObjectId for references
const employee = await prisma.employee.findUnique({
  where: { id },
  include: { user: true },
})
```

### Zod Validation
```typescript
const Schema = z.object({
  fullName: z.string().min(1, 'Required'),
  employeeNumber: z.number().int().positive(),
})

const result = Schema.safeParse(body)
if (!result.success) {
  return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
}
```

---

## Project Structure

```
/app
  /(auth)                # Public pages: login, register, forgot-password, sync (OAuth landing)
  /(dashboard)           # Authenticated pages (route group)
    /employees/
    /time-logs/
    /payroll/
    /users/              # Includes admin password-reset modal
  /api                    # API routes
    /auth/[...nextauth]/  # NextAuth handler (Google OAuth, JWT — NO PrismaAdapter)
    /auth/google-sync/    # Bridges NextAuth session -> app cookies
    /users/reset-password/ # Admin/HR password reset
    /payroll/thirteenth-month/ # PD 851 13th-month computation
/components
  /ui                     # shadcn/ui components
  session-provider.tsx    # Client NextAuth SessionProvider (wraps app in layout.tsx)
/lib
  ph-standards.ts         # PH statutory source of truth (leaves, OT, holidays, 13th month)
/prisma
  schema.prisma
  seed.ts
/scripts                  # Database scripts
```

---

## Environment Variables

```env
DATABASE_URL=mongodb+srv://...
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379  # Optional
# Google SSO — create a Web OAuth client at console.cloud.google.com/apis/credentials
# with redirect URI http://localhost:3000/api/auth/callback/google (+ prod domain)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

---

## Implemented Features (do not regress)

### Branding & Theme
- Product name is **IJESoft HRIS** (page title, login, sidebar, reports). Do not reintroduce "NEXUS" branding.
- Futuristic dark glass theme: `app/globals.css` provides `.glass`, `.glass-strong`,
  `.text-gradient`, `.bg-grid`, `.glow-ring`, `.card-hover` plus `animate-float/aurora/spin-slow/orbit/grid-pan/fade-up/pulse-glow`.

### Philippine Payroll Standards (`lib/ph-standards.ts` is the source of truth)
- SSS: 15% MSC (5/10 split) + employer EC (P10 if MSC ≤ 14,500 else P30); WISP note for MSC > 20,000.
  Semimonthly runs split monthly shares in half (`prorateStatutoryForFrequency`) — never deduct full-month SSS/PhilHealth/Pag-IBIG per cut-off.
- OT dedup: same-date `TimeLog.otHours` + `OvertimeRequest.hours` count once (prefer TimeLog).
- Holidays: `REGULAR` +100% premium if worked (day-before presence required), `SPECIAL`/`SPECIAL_NON_WORK` +30% if worked, 0 if unworked. Official list lives in `lib/holidays.ts`.
- TRAIN tax bases use BIR values (8,541.80 / 33,541.80 / 183,541.80); semimonthly doubles income to find bracket then halves tax.
- 13th month: `GET /api/payroll/thirteenth-month?year=&employeeId=` → annual basic/12, P90K exempt split (PD 851).
- Leave accrual: regulars accrue **both** VACATION 1.25 + SICK 1.25/mo (15/15/yr, exceeds 5-day SIL minimum).
- Leave filing validates against `PHILIPPINE_LEAVE_CODES` + statutory maxima (e.g. Paternity ≤ 7d) in `POST /api/leaves`.

### Auth Flows
- Password login (`POST /api/login`) and Google SSO both end in the same app cookies
  (`isLoggedIn/userId/userRole/userEmail/userName`); dashboard layout and `middleware.ts` check `isLoggedIn`.
- Google flow: Login button → `signIn('google', { callbackUrl: '/auth/sync' })` → NextAuth callback → `/auth/sync` page calls `POST /api/auth/google-sync` → `/dashboard`.
  First-time Google users are auto-provisioned as `EMPLOYEE`/`FOR_APPROVAL`; sync enforces approval like password login.
- NextAuth uses **JWT only — no PrismaAdapter** (schema has no Account/Session models). `middleware.ts` must keep `/api/auth/*`, `/auth/sync`, `/login`, `/register`, `/forgot-password` public.
- Password recovery is **admin-driven, no email**: `POST /api/users/reset-password` (ADMIN/HR; HR cannot reset ADMINs; clears lockout; auto-generates `Ije-…` temp password when omitted). Users page has the reset modal; `/forgot-password` is an instructions page.

### Pending DB Migration (schema staged, client not regenerated)
`prisma/schema.prisma` adds: extended `EmployeeStatus` (CONTRACTUAL/RESIGNED/TERMINATED/RETIRED/AWOL),
Employee 201-file fields, `TimeLog` night-diff fields, `Payroll` breakdown fields (`regularHolidayPay/specialHolidayPay/sssEC/taxableIncome/nightDiff*`).
`POST /api/payroll` intentionally does NOT write the new Payroll fields yet. To enable:
1. Stop the dev server (Windows locks the query-engine DLL during `prisma generate`)
2. Run `npx prisma generate`, then `npm run db:push`
3. Re-add the new fields to the two `prisma.payroll.create` calls in `app/api/payroll/route.ts`

---

## Development Workflow

1. Create branch for features/fixes
2. Make changes following guidelines
3. Run `npm run lint` before committing
4. Verify with `npm run build`
5. Test in dev server
