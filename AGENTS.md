# AGENTS.md - Developer Guidelines for HRIS Philippines

## Overview

This is a Next.js 14 application with MongoDB, Prisma ORM, and React. It's a Human Resource Information System tailored for Philippine labor laws.

## Technology Stack

- **Framework**: Next.js 14 (React 18)
- **Database**: MongoDB with Prisma ORM
- **UI**: Radix UI + shadcn/ui components + Tailwind CSS
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **State**: Zustand (optional)
- **Auth**: NextAuth.js v4 (cookie-based sessions)

---

## Build, Lint, and Test Commands

```bash
# Development
npm run dev              # Start dev server on port 3000
npm run build            # Production build
npm run start            # Start production server

# Database
npm run db:push          # Push schema changes to database
npm run db:seed          # Seed database with sample data
npx prisma studio        # Open Prisma database GUI

# Linting
npm run lint             # Run ESLint
```

### Running a Single Test

There are currently **no tests** in this project. To add tests:

```bash
# Install testing dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom

# Run tests
npm run test             # Requires test script in package.json
npx vitest run          # Run all tests once
npx vitest run src/components/MyComponent.test.tsx  # Single file

# With coverage
npx vitest run --coverage
```

---

## Code Style Guidelines

### General Principles

1. **Use TypeScript** - All code should be written in TypeScript
2. **Strict mode** - TypeScript strict mode is enabled in tsconfig.json
3. **No `any`** - Avoid `any` type; use `unknown` if type is truly unknown

### Imports

```typescript
// Order: 1. React/Next imports 2. External libs 3. Internal imports 4. Types

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Employee, TimeLog } from '@/types'

// Use @ alias for absolute imports (configured in tsconfig.json)
import prisma from '@/lib/prisma'
```

### Naming Conventions

- **Components**: PascalCase (`TimeLogsPage`, `EmployeeTable`)
- **Files**: kebab-case for pages (`time-logs/page.tsx`), PascalCase for components
- **Variables/functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Interfaces**: PascalCase with `I` prefix optional (prefer without: `Employee`, not `IEmployee`)
- **Types**: PascalCase

```typescript
// Good
const employeeList: Employee[] = []
const fetchEmployees = async () => {}
const TIME_LOG_STATUS = 'active'

// Avoid
const emp = []
const get_data = async () => {}
```

### Formatting

- Use **2 spaces** for indentation
- Use **single quotes** for strings
- Add **trailing commas** in objects/arrays
- Use **semicolons**
- Maximum line length: ~100 characters

```typescript
// Good
export async function getEmployeeById(id: string) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { user: true },
  })
  return employee
}

// Avoid
export async function getEmployeeById(id:string){
const employee=await prisma.employee.findUnique({where:{id},include:{user:true}})
return employee}
```

### React Components

```typescript
'use client'  // Required for components using hooks

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface EmployeeCardProps {
  employee: Employee
  onSelect: (id: string) => void
}

export function EmployeeCard({ employee, onSelect }: EmployeeCardProps) {
  const [loading, setLoading] = useState(false)

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold">{employee.fullName}</h3>
      <Button onClick={() => onSelect(employee.id)}>Select</Button>
    </div>
  )
}
```

### API Routes (Next.js App Router)

```typescript
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/employees
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')

    const employees = await prisma.employee.findMany({
      where: employeeId ? { id: employeeId } : {},
    })

    return NextResponse.json(employees)
  } catch (error) {
    console.error('Error fetching employees:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}

// POST /api/employees
export async function POST(request: Request) {
  try {
    const body = await request.json()
    // Validate with Zod, process, save to DB
    return NextResponse.json({ message: 'Created' }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    )
  }
}
```

### Error Handling

- Always wrap async operations in try/catch
- Log errors with `console.error` for debugging
- Return meaningful error messages to clients
- Use appropriate HTTP status codes

```typescript
// Good
try {
  const result = await prisma.employee.create({ data })
  return NextResponse.json(result)
} catch (error) {
  console.error('Create employee error:', error)
  return NextResponse.json(
    { error: 'Failed to create employee' },
    { status: 500 }
  )
}

// With known error types
if (error instanceof Prisma.PrismaClientKnownRequestError) {
  if (error.code === 'P2002') {
    return NextResponse.json(
      { error: 'Employee already exists' },
      { status: 409 }
    )
  }
}
```

### Database (Prisma)

```typescript
// Querying
const employee = await prisma.employee.findUnique({
  where: { id: employeeId },
  include: { user: true },
})

// Creating
const newEmployee = await prisma.employee.create({
  data: {
    fullName: 'John Doe',
    employeeNumber: 1001,
  },
})

// Updating
await prisma.timeLog.update({
  where: { id: logId },
  data: { clockOut: new Date() },
})

// Use @db.ObjectId for MongoDB references
// employeeId String @db.ObjectId
```

### Tailwind CSS

```tsx
// Use utility classes consistently
<div className="flex items-center justify-between p-4 space-y-4">
  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
    Submit
  </button>
</div>

// For conditional classes, use clsx or cn()
<button className={cn(
  "px-4 py-2 rounded-lg",
  isActive && "bg-blue-600",
  isDisabled && "opacity-50 cursor-not-allowed"
)}>
```

### Zod Validation

```typescript
import { z } from 'zod'

const EmployeeSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  employeeNumber: z.number().int().positive(),
  email: z.string().email(),
  department: z.enum(['IT', 'HR', 'Finance', 'Operations']),
})

type EmployeeInput = z.infer<typeof EmployeeSchema>

// In API route
const body = await request.json()
const result = EmployeeSchema.safeParse(body)
if (!result.success) {
  return NextResponse.json(
    { error: result.error.flatten() },
    { status: 400 }
  )
}
```

---

## Project Structure

```
/app
  /(dashboard)         # Authenticated pages
    /time-logs/
    /employees/
    /payroll/
  /api                 # API routes
    /time-logs/
      route.ts         # GET, POST
      import/
        route.ts       # Import endpoint
/components
  /ui                  # shadcn/ui components
  /forms               # Form components
/lib                   # Utilities, prisma client, auth
/prisma
  schema.prisma        # Database schema
  seed.ts              # Seed data
/types                 # TypeScript types
```

---

## Common Patterns

### Authentication (Cookie-based)

```typescript
// Read auth cookies (client-side)
const cookies = document.cookie.split(';').reduce((acc, cookie) => {
  const [key, value] = cookie.trim().split('=')
  acc[key] = value
  return acc
}, {} as Record<string, string>)

const isLoggedIn = cookies.isLoggedIn === 'true'
const userRole = cookies.userRole
```

### Date Handling

```typescript
import { format, parseISO, addDays } from 'date-fns'

// Format for display
const formatted = format(new Date(date), 'MMM dd, yyyy')

// Parse ISO string
const date = parseISO('2026-01-15')

// Date calculations
const nextDay = addDays(date, 1)
```

### File Uploads (Excel/CSV)

```typescript
import * as XLSX from 'xlsx'

export async function parseExcelFile(file: File) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet)
  return data
}
```

---

## Development Workflow

1. Create a new branch for features/fixes
2. Make changes following these guidelines
3. Run `npm run lint` before committing
4. Test the build: `npm run build`
5. Verify changes work in development

---

## Environment Variables

```env
# .env.local (never commit)
DATABASE_URL=mongodb+srv://...
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
```
