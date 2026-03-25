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
