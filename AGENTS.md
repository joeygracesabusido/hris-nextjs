# AGENTS.md - Developer Guidelines for HRIS Philippines

## Technology Stack

- **Framework**: Next.js 14 (React 18) — App Router
- **Database**: MongoDB with Prisma ORM
- **UI**: Radix UI + shadcn/ui + Tailwind CSS
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **State**: Zustand (optional)
- **Auth**: Cookie-based (custom implementation)
- **Date handling**: date-fns
- **Excel/CSV**: xlsx
- **Caching**: Redis (ioredis)

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

### Error Handling
- Always wrap async ops in try/catch
- Log errors with `console.error('Context:', error)`
- Return meaningful messages with appropriate HTTP status codes
- Check for Prisma errors: `error instanceof Prisma.PrismaClientKnownRequestError`

### Role-Based Access Control
**CRITICAL**: Use `hasAdminAccess()` from `@/lib/auth-helpers` for role checks:

```typescript
import { hasAdminAccess } from '@/lib/auth-helpers'

// Admin roles (ADMIN, HR, MANAGER) can see all data
if (hasAdminAccess(userRole || '')) {
  // Return all records
}

// EMPLOYEE role only sees their own data
else {
  // Filter by linked employee ID
}
```

For filtering, use `getEmployeeIdForUser()` from `@/lib/user-employee-link`:
```typescript
import { getEmployeeIdForUser } from '@/lib/user-employee-link'

const linkedEmployeeId = await getEmployeeIdForUser(userEmail, userRole || '')
const records = await prisma.timeLog.findMany({
  where: linkedEmployeeId ? { employeeId: linkedEmployeeId } : {},
})
```

### Prisma
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

### Date Handling
```typescript
import { format, parseISO, startOfDay, endOfDay } from 'date-fns'

format(new Date(date), 'MMM dd, yyyy')
parseISO('2026-01-15')

// Timezone: Store as UTC, display as Philippines time (UTC+8)
// Use getUTCHours()/setUTCHours() for time computations
```

---

## Project Structure

```
/app
  /(dashboard)           # Authenticated pages (route group)
    /employees/
    /time-logs/
    /payroll/
  /api                    # API routes
/components
  /ui                     # shadcn/ui components
/lib                      # Utils, prisma client, auth helpers
/prisma
  schema.prisma
  seed.ts
/scripts                  # Database scripts
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
REDIS_URL=redis://localhost:6379  # Optional, caching disabled if not set
```

---

## Key Patterns

### Cache Invalidation
```typescript
import { cache } from '@/lib/redis'

// Set cache
await cache.set(cacheKey, data, 600)  // 10 minutes

// Invalidate pattern
await cache.delByPattern(`${CACHE_PREFIX}*`)
```

### Date Range Queries
```typescript
import { startOfDay, endOfDay, parseISO } from 'date-fns'

const start = startOfDay(parseISO(startDate))
const end = endOfDay(parseISO(endDate))

const records = await prisma.timeLog.findMany({
  where: {
    date: { gte: start, lte: end },
  },
})
```
