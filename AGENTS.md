# AGENTS.md - Developer Guidelines for HRIS Philippines

## Technology Stack

- **Framework**: Next.js 14 (React 18) — App Router
- **Database**: MongoDB with Prisma ORM
- **UI**: Radix UI + shadcn/ui + Tailwind CSS
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **State**: Zustand (optional)
- **Auth**: NextAuth.js v4 (cookie-based sessions)
- **Date handling**: date-fns
- **Excel/CSV**: xlsx

---

## Commands

```bash
# Development
npm run dev          # Dev server on port 3000
npm run build        # Production build
npm run start        # Production server

# Database
npm run db:push      # Push schema changes to MongoDB
npm run db:seed      # Seed database with sample data
npx prisma studio    # Open Prisma GUI

# Linting
npm run lint         # Run ESLint

# Testing (not configured yet)
# Install: npm install -D vitest @testing-library/react @testing-library/jest-dom
# Run: npx vitest run src/components/MyComponent.test.tsx
```

---

## Code Style

### General
- TypeScript with **strict mode** (no `any`; use `unknown`)
- 2 spaces indentation, single quotes, trailing commas, semicolons
- Max line length ~100 characters

### Imports (order)
1. React/Next imports
2. External libs
3. Internal imports (@/ alias)
4. Types

```typescript
import { useState, useEffect } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Employee } from '@/types'
import prisma from '@/lib/prisma'
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

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { allowedFields } = body
    // Only update allowed fields to prevent mass assignment
    const result = await prisma.employee.update({
      where: { id: body.id },
      data: { ...Object.fromEntries(allowedFields.map((f: string) => [f, body[f]])) },
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Already exists' }, { status: 409 })
    }
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
```

### Error Handling
- Always wrap async ops in try/catch
- Log errors with `console.error`
- Return meaningful messages with appropriate HTTP status codes

### Prisma
```typescript
// MongoDB uses @db.ObjectId for references
const employee = await prisma.employee.findUnique({
  where: { id },
  include: { user: true },
})
```

### Tailwind CSS
```tsx
<div className="flex items-center justify-between p-4 space-y-4">
  <button className={cn(
    "px-4 py-2 rounded-lg",
    isActive && "bg-blue-600"
  )}>
    Submit
  </button>
</div>
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

### Date Handling
```typescript
import { format, parseISO, addDays } from 'date-fns'
format(new Date(date), 'MMM dd, yyyy')
parseISO('2026-01-15')
```

---

## Project Structure

```
/app
  /(dashboard)           # Authenticated pages
    /employees/
    /time-logs/
    /payroll/
  /api                    # API routes
/components
  /ui                     # shadcn/ui components
/lib                      # Utils, prisma client, auth
/prisma
  schema.prisma
  seed.ts
/types
```

---

## Development Workflow

1. Create branch for features/fixes
2. Make changes following guidelines
3. Run `npm run lint` before committing
4. Verify with `npm run build`
5. Test in dev server

---

## Environment Variables

```env
DATABASE_URL=mongodb+srv://...
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
```

---

## Recent Fixes

### XCLS Excel Import Timezone Fix (2026-03-25)

**Issue**: Time logs imported from XCLS Excel files displayed incorrect times on Vercel deployment vs local development due to timezone handling.

**Root Cause**: 
- Backend used `Date.UTC()` to store times consistently as UTC
- Frontend `formatTime()` used `getHours()` which converts to browser's local timezone
- This caused `7:48 AM` Philippines time to display as `3:48 PM` (UTC+8 offset)

**Solution**:
- Updated `formatTime()` in `app/(dashboard)/time-logs/page.tsx:317` to use `getUTCHours()` and `getUTCMinutes()`
- Times are stored as UTC but represent Philippines local time, so display UTC hours/minutes directly

**Files Modified**:
- `app/(dashboard)/time-logs/page.tsx` - Fixed `formatTime()` function
- `app/api/time-logs/import-xcls/route.ts` - Already using `Date.UTC()` for consistent storage

### Payroll Holiday Pay Display (2026-03-25)

**Issue**: When expanding payroll records in the payslip table, holiday pay computation was not visible.

**Solution**: Added holiday pay display to the expanded payroll details section.

**Files Modified**:
- `app/(dashboard)/payroll/page.tsx:1023` - Added holiday pay row with computation note in expanded view

### Late/Undertime Computation Timezone Fix (2026-03-25)

**Issue**: Late and undertime computation was incorrect when importing XCLS Excel files. Example: Employee clocked in at 7:50 AM (10 minutes early for 8:00 AM shift) but system showed 468 minutes (7h 48m) late.

**Root Cause**: 
- Clock-in times are stored as UTC (e.g., `2026-03-23T07:50:00.000Z` represents 7:50 AM Philippines time)
- Late computation used `setHours()` which sets hours in local timezone
- This created a timezone mismatch: comparing 7:50 AM PH time vs 8:00 AM UTC (4:00 PM PH time)

**Solution**:
- Changed `setHours()` to `setUTCHours()` and `setUTCMinutes()` in late/undertime computation
- Ensures both clock-in time and scheduled shift time are compared in the same timezone (UTC)

**Files Modified**:
- `app/api/time-logs/import-xcls/route.ts:219` - Changed `setHours()` to `setUTCHours()` for scheduled time
- `app/api/time-logs/import-xcls/route.ts:229` - Changed `setHours()` to `setUTCHours()` for scheduled end time

### Frontend Lateness Display Timezone Fix (2026-03-25)

**Issue**: The "Late (7h 50m)" badge displayed incorrectly in the time logs table even after backend fix. Employee JJONATHAN SALAZAR ABRIOL (91417) clocking in at 7:50 AM showed as 7h 50m late instead of "On Time".

**Root Cause**:
- Frontend `getLatenessRemarks()` function used `setHours()` to compute scheduled start time
- This caused the same timezone mismatch as the backend issue: comparing UTC-stored clock-in time with local timezone scheduled time

**Solution**:
- Changed `setHours()` to `setUTCHours()` in `getLatenessRemarks()` function
- Ensures frontend display computation matches backend storage timezone

**Files Modified**:
- `app/(dashboard)/time-logs/page.tsx:348` - Changed `setHours()` to `setUTCHours()` in `getLatenessRemarks()` function

**Note**: Existing time log records with incorrect `lateMinutes` values need to be re-imported via XCLS import to recalculate with the fixed logic.
