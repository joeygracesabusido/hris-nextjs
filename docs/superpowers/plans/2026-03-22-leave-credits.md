# Leave Credits Feature Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automated monthly leave credit accrual system for regular employees per Philippine labor law (15 days/year = 1.25 days/month)

**Architecture:** Leave credits are accrued monthly via cron job on last day of month. Only REGULAR employees earn credits. Probationary employees earn credits retroactively once regularized.

**Tech Stack:** Next.js 14 API Routes, Prisma ORM, MongoDB, node-cron for scheduling

---

## Overview

### Business Rules
1. **Entitlement:** Only REGULAR employees earn leave credits
2. **Accrual Rate:** 1.25 days per month (15 days/year)
3. **Accrual Date:** End of every month (last day)
4. **Mid-Month Hire:** No credit for partial month; credits start on first full month end
5. **Regularization:** Probationary employees earn prorated credits from regularization date

### Philippine Labor Law Compliance
- Service Incentive Leave (SIL) under Article 95 of the Labor Code
- Applies to employees with more than 6 months of service
- 5 days minimum per year (we offer 15 days = generous benefit)

---

## File Structure

### New Files to Create
- `prisma/schema.prisma` - Add EmployeeStatus enum, LeaveCredit, LeaveCreditTransaction models
- `lib/leave-credits.ts` - Leave credit calculation utilities
- `lib/cron/leave-accrual.ts` - Monthly accrual job
- `app/api/leave-credits/route.ts` - Leave credits CRUD API
- `app/api/leave-credits/accrue/route.ts` - Trigger monthly accrual
- `app/api/leave-credits/balance/route.ts` - Get employee balance
- `app/(dashboard)/leave-credits/page.tsx` - Leave credits UI
- `types/index.ts` - Add LeaveCredit types

### Files to Modify
- `prisma/schema.prisma` - Add EmployeeStatus, LeaveCredit, LeaveCreditTransaction
- `app/api/employees/route.ts` - Handle employee regularization (optional)
- `app/(dashboard)/leaves/page.tsx` - Show available balance when filing

---

## Chunk 1: Database Schema

### Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma:1-364`

Add the following:

```prisma
// Add after Role enum (line 24)
/// Employee status enum for Philippine labor law compliance
enum EmployeeStatus {
  PROBATIONARY   // 6 months trial period
  REGULAR        // Permanently employed
}

/// Leave credit ledger types
enum LeaveCreditType {
  MONTHLY_ACCRUAL    // Monthly accrual
  ADJUSTMENT         // Manual adjustment by HR
  USED               // Deducted when leave approved
  CARRY_FORWARD      // Year-end carry over
  EXPIRED            // Unused credits that expired
}

// Add to Employee model (after isActive field ~line 72)
employeeStatus    EmployeeStatus @default(PROBATIONARY)
regularizationDate DateTime?     // Date when probationary became regular

// Add new models after Employee model
/// LeaveCredit model for tracking employee leave balances
model LeaveCredit {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  
  employeeId      String   @db.ObjectId
  employee       Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  
  leaveType       String   @default("VACATION") // VACATION, SICK
  totalDays       Float    @default(0)         // Total accrued days
  usedDays        Float    @default(0)         // Days already used
  availableDays   Float    @default(0)         // Available for use
  year            Int      // For yearly tracking
  
  transactions    LeaveCreditTransaction[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([employeeId, leaveType, year])
  @@index([employeeId])
  @@map("leavecredits")
}

/// LeaveCreditTransaction model for audit trail
model LeaveCreditTransaction {
  id              String          @id @default(auto()) @map("_id") @db.ObjectId
  
  leaveCreditId   String          @db.ObjectId
  leaveCredit     LeaveCredit     @relation(fields: [leaveCreditId], references: [id], onDelete: Cascade)
  
  type            LeaveCreditType
  days            Float           // Positive for credit, negative for debit
  balanceBefore   Float
  balanceAfter    Float
  
  description     String          // e.g., "Monthly accrual for January 2026"
  referenceId     String?         // LeaveRequest ID if type is USED
  
  createdAt       DateTime        @default(now())
  
  @@index([leaveCreditId])
  @@map("leavecredittransactions")
}
```

- [ ] **Step 1: Read current schema**

```bash
# Already read schema.prisma above
```

- [ ] **Step 2: Apply schema changes**

```bash
npm run db:push
```

Expected: Schema pushed successfully

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add employee status and leave credits schema"
```

---

## Chunk 2: Type Definitions

### Task 2: Add Leave Credit Types

**Files:**
- Modify: `types/index.ts:266`

Add at end of file:

```typescript
// ============================================================================
// Leave Credit Types (Philippine Labor Law Compliance)
// ============================================================================

export type EmployeeStatus = 'PROBATIONARY' | 'REGULAR'

export type LeaveCreditType = 'MONTHLY_ACCRUAL' | 'ADJUSTMENT' | 'USED' | 'CARRY_FORWARD' | 'EXPIRED'

export interface LeaveCredit {
  id: string
  employeeId: string
  leaveType: string
  totalDays: number
  usedDays: number
  availableDays: number
  year: number
  createdAt: Date
  updatedAt: Date
}

export interface LeaveCreditWithEmployee extends LeaveCredit {
  employee: {
    id: string
    fullName: string
    employeeId: string
    hireDate: Date
    employeeStatus: EmployeeStatus
  }
}

export interface LeaveCreditTransaction {
  id: string
  leaveCreditId: string
  type: LeaveCreditType
  days: number
  balanceBefore: number
  balanceAfter: number
  description: string
  referenceId?: string
  createdAt: Date
}

export interface LeaveCreditBalance {
  employeeId: string
  leaveType: string
  available: number
  used: number
  total: number
  year: number
}
```

- [ ] **Step 1: Update types/index.ts**
- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add leave credit type definitions"
```

---

## Chunk 3: Leave Credit Utilities

### Task 3: Create Leave Credit Calculation Module

**Files:**
- Create: `lib/leave-credits.ts`

```typescript
import prisma from '@/lib/prisma'

const MONTHLY_ACCRUAL_DAYS = 1.25 // 15 days / 12 months
const MAX_CARRY_OVER_DAYS = 15    // Max days to carry over per year

export interface AccrualResult {
  success: boolean
  accrued: number
  employeeId: string
  error?: string
}

/**
 * Calculate leave credit accrual for an employee
 * Rules:
 * 1. Only REGULAR employees earn credits
 * 2. Accrual happens at end of each month
 * 3. If hired mid-month, no partial accrual
 */
export async function calculateMonthlyAccrual(
  employeeId: string,
  year: number,
  month: number
): Promise<AccrualResult> {
  try {
    // Get employee details
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        hireDate: true,
        regularizationDate: true,
        employeeStatus: true,
        isActive: true,
      },
    })

    if (!employee) {
      return { success: false, accrued: 0, employeeId, error: 'Employee not found' }
    }

    // Only regular employees earn credits
    if (employee.employeeStatus !== 'REGULAR') {
      return { success: false, accrued: 0, employeeId, error: 'Employee is not regular' }
    }

    // Employee must be active
    if (!employee.isActive) {
      return { success: false, accrued: 0, employeeId, error: 'Employee is inactive' }
    }

    // Determine effective start date for accrual
    const accrualStartDate = employee.regularizationDate || employee.hireDate
    
    // Check if employee completed first full month
    // Accrual only happens after first full month
    const firstMonthEnd = new Date(year, month, 0) // Last day of month
    const firstMonthStart = new Date(year, month - 1, 1)
    
    // If hired after the 1st of the month, they don't get that month's accrual
    if (accrualStartDate > firstMonthStart) {
      return { 
        success: false, 
        accrued: 0, 
        employeeId, 
        error: 'Employee hired mid-month - no accrual until next month' 
      }
    }

    // Check if already accrued for this month/year
    const existingTransaction = await prisma.leaveCreditTransaction.findFirst({
      where: {
        leaveCredit: { employeeId },
        type: 'MONTHLY_ACCRUAL',
        description: { contains: `${getMonthName(month)} ${year}` },
      },
    })

    if (existingTransaction) {
      return { success: false, accrued: 0, employeeId, error: 'Already accrued for this month' }
    }

    // Get or create leave credit record for this year
    let leaveCredit = await prisma.leaveCredit.findUnique({
      where: {
        employeeId_leaveType_year: {
          employeeId,
          leaveType: 'VACATION',
          year,
        },
      },
    })

    if (!leaveCredit) {
      leaveCredit = await prisma.leaveCredit.create({
        data: {
          employeeId,
          leaveType: 'VACATION',
          year,
          totalDays: 0,
          usedDays: 0,
          availableDays: 0,
        },
      })
    }

    // Perform accrual in transaction
    const result = await prisma.$transaction(async (tx) => {
      const prevBalance = leaveCredit!.availableDays
      const newBalance = prevBalance + MONTHLY_ACCRUAL_DAYS

      // Create transaction record
      await tx.leaveCreditTransaction.create({
        data: {
          leaveCreditId: leaveCredit!.id,
          type: 'MONTHLY_ACCRUAL',
          days: MONTHLY_ACCRUAL_DAYS,
          balanceBefore: prevBalance,
          balanceAfter: newBalance,
          description: `Monthly accrual for ${getMonthName(month)} ${year}`,
        },
      })

      // Update leave credit balance
      const updated = await tx.leaveCredit.update({
        where: { id: leaveCredit!.id },
        data: {
          totalDays: { increment: MONTHLY_ACCRUAL_DAYS },
          availableDays: { increment: MONTHLY_ACCRUAL_DAYS },
        },
      })

      return updated
    })

    return { success: true, accrued: MONTHLY_ACCRUAL_DAYS, employeeId }
  } catch (error) {
    console.error('Error calculating monthly accrual:', error)
    return { success: false, accrued: 0, employeeId, error: 'Internal error' }
  }
}

/**
 * Get available leave balance for an employee
 */
export async function getLeaveBalance(
  employeeId: string,
  year: number = new Date().getFullYear()
): Promise<{ vacation: number; sick: number }> {
  const credits = await prisma.leaveCredit.findMany({
    where: { employeeId, year },
  })

  const vacation = credits.find(c => c.leaveType === 'VACATION')?.availableDays || 0
  const sick = credits.find(c => c.leaveType === 'SICK')?.availableDays || 0

  return { vacation, sick }
}

/**
 * Deduct leave when approved
 */
export async function deductLeave(
  employeeId: string,
  leaveType: string,
  days: number,
  leaveRequestId: string,
  year: number = new Date().getFullYear()
): Promise<boolean> {
  try {
    const leaveCredit = await prisma.leaveCredit.findUnique({
      where: {
        employeeId_leaveType_year: { employeeId, leaveType, year },
      },
    })

    if (!leaveCredit || leaveCredit.availableDays < days) {
      return false
    }

    await prisma.$transaction(async (tx) => {
      // Create deduction transaction
      await tx.leaveCreditTransaction.create({
        data: {
          leaveCreditId: leaveCredit.id,
          type: 'USED',
          days: -days,
          balanceBefore: leaveCredit.availableDays,
          balanceAfter: leaveCredit.availableDays - days,
          description: `Leave used - Request ID: ${leaveRequestId}`,
          referenceId: leaveRequestId,
        },
      })

      // Update balance
      await tx.leaveCredit.update({
        where: { id: leaveCredit.id },
        data: {
          usedDays: { increment: days },
          availableDays: { decrement: days },
        },
      })
    })

    return true
  } catch (error) {
    console.error('Error deducting leave:', error)
    return false
  }
}

function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[month - 1]
}
```

- [ ] **Step 1: Create lib/leave-credits.ts**
- [ ] **Step 2: Run lint check**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add lib/leave-credits.ts
git commit -m "feat: add leave credit calculation utilities"
```

---

## Chunk 4: API Endpoints

### Task 4: Create Leave Credits API

**Files:**
- Create: `app/api/leave-credits/route.ts`

```typescript
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { getLeaveBalance } from '@/lib/leave-credits'

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const userEmail = cookieStore.get('userEmail')?.value

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { employees: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const year = searchParams.get('year') || String(new Date().getFullYear())

    // Admin can view any employee, others only their own
    if (user.role === 'ADMIN') {
      const targetId = employeeId || user.employees?.[0]?.id
      
      const credits = await prisma.leaveCredit.findMany({
        where: { employeeId: targetId, year: parseInt(year) },
        include: { transactions: { orderBy: { createdAt: 'desc' } } },
      })
      
      return NextResponse.json(credits)
    } else {
      if (!user.employees || user.employees.length === 0) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
      }

      const credits = await prisma.leaveCredit.findMany({
        where: { 
          employeeId: user.employees[0].id, 
          year: parseInt(year) 
        },
        include: { transactions: { orderBy: { createdAt: 'desc' } } },
      })
      
      return NextResponse.json(credits)
    }
  } catch (error) {
    console.error('Error fetching leave credits:', error)
    return NextResponse.json({ error: 'Failed to fetch leave credits' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const userEmail = cookieStore.get('userEmail')?.value

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    })

    // Only admin can manually adjust credits
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { employeeId, leaveType, days, description } = body

    // Get or create leave credit
    const year = new Date().getFullYear()
    let leaveCredit = await prisma.leaveCredit.findUnique({
      where: {
        employeeId_leaveType_year: { employeeId, leaveType, year },
      },
    })

    if (!leaveCredit) {
      leaveCredit = await prisma.leaveCredit.create({
        data: { employeeId, leaveType, year, totalDays: 0, usedDays: 0, availableDays: 0 },
      })
    }

    const isAddition = days > 0
    const newBalance = isAddition 
      ? leaveCredit.availableDays + Math.abs(days)
      : Math.max(0, leaveCredit.availableDays - Math.abs(days))

    const transaction = await prisma.$transaction(async (tx) => {
      await tx.leaveCreditTransaction.create({
        data: {
          leaveCreditId: leaveCredit!.id,
          type: 'ADJUSTMENT',
          days,
          balanceBefore: leaveCredit!.availableDays,
          balanceAfter: newBalance,
          description: description || `Manual adjustment: ${days > 0 ? '+' : ''}${days} days`,
        },
      })

      return tx.leaveCredit.update({
        where: { id: leaveCredit!.id },
        data: {
          totalDays: isAddition ? { increment: Math.abs(days) } : leaveCredit.totalDays,
          availableDays: newBalance,
        },
      })
    })

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('Error adjusting leave credits:', error)
    return NextResponse.json({ error: 'Failed to adjust leave credits' }, { status: 500 })
  }
}
```

- Create: `app/api/leave-credits/balance/route.ts`

```typescript
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { getLeaveBalance } from '@/lib/leave-credits'

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const userEmail = cookieStore.get('userEmail')?.value

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { employees: true },
    })

    if (!user || !user.employees?.[0]) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId') || user.employees[0].id
    const year = searchParams.get('year') || String(new Date().getFullYear())

    // Non-admin can only check their own balance
    if (user.role !== 'ADMIN' && employeeId !== user.employees[0].id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const balance = await getLeaveBalance(employeeId, parseInt(year))

    return NextResponse.json({
      employeeId,
      year: parseInt(year),
      vacation: balance.vacation,
      sick: balance.sick,
    })
  } catch (error) {
    console.error('Error fetching balance:', error)
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 })
  }
}
```

- Create: `app/api/leave-credits/accrue/route.ts`

```typescript
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { calculateMonthlyAccrual } from '@/lib/leave-credits'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const userEmail = cookieStore.get('userEmail')?.value

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    })

    // Only admin can trigger accrual
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { year, month } = body

    const targetYear = year || new Date().getFullYear()
    const targetMonth = month || new Date().getMonth() + 1

    // Get all regular employees
    const regularEmployees = await prisma.employee.findMany({
      where: { 
        employeeStatus: 'REGULAR',
        isActive: true,
      },
      select: { id: true, fullName: true },
    })

    const results = []
    for (const emp of regularEmployees) {
      const result = await calculateMonthlyAccrual(emp.id, targetYear, targetMonth)
      results.push({
        employeeId: emp.id,
        employeeName: emp.fullName,
        ...result,
      })
    }

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return NextResponse.json({
      message: `Accrual completed`,
      summary: { total: results.length, successful, failed },
      details: results,
    })
  } catch (error) {
    console.error('Error running accrual:', error)
    return NextResponse.json({ error: 'Failed to run accrual' }, { status: 500 })
  }
}
```

- [ ] **Step 1: Create app/api/leave-credits/route.ts**
- [ ] **Step 2: Create app/api/leave-credits/balance/route.ts**
- [ ] **Step 3: Create app/api/leave-credits/accrue/route.ts**
- [ ] **Step 4: Run lint check**

```bash
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add app/api/leave-credits/
git commit -m "feat: add leave credits API endpoints"
```

---

## Chunk 5: Leave Credits UI

### Task 5: Create Leave Credits Dashboard Page

**Files:**
- Create: `app/(dashboard)/leave-credits/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Plus, RefreshCw, Calendar, TrendingUp, History, AlertCircle } from 'lucide-react'
import { format } from 'date-fns/format'
import type { LeaveCredit, LeaveCreditTransaction, LeaveCreditBalance } from '@/types'

export default function LeaveCreditsPage() {
  const [credits, setCredits] = useState<LeaveCredit[]>([])
  const [balance, setBalance] = useState<LeaveCreditBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [showAccrueModal, setShowAccrueModal] = useState(false)
  const [accrueResult, setAccrueResult] = useState<any>(null)
  const [accrueLoading, setAccrueLoading] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const getCookies = () => {
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=')
        acc[key] = value
        return acc
      }, {} as Record<string, string>)
      return { role: cookies.userRole || '', loggedIn: cookies.isLoggedIn === 'true' }
    }
    
    const { role, loggedIn } = getCookies()
    if (!loggedIn) {
      window.location.href = '/login'
      return
    }
    setUserRole(role)
    fetchCredits()
    fetchBalance()
  }, [selectedYear])

  const fetchCredits = async () => {
    try {
      const res = await fetch(`/api/leave-credits?year=${selectedYear}`, { credentials: 'include' })
      const data = await res.json()
      if (Array.isArray(data)) setCredits(data)
    } catch (err) {
      console.error('Failed to fetch credits:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchBalance = async () => {
    try {
      const res = await fetch(`/api/leave-credits/balance?year=${selectedYear}`, { credentials: 'include' })
      const data = await res.json()
      setBalance(data)
    } catch (err) {
      console.error('Failed to fetch balance:', err)
    }
  }

  const runMonthlyAccrual = async () => {
    setAccrueLoading(true)
    try {
      const now = new Date()
      const res = await fetch('/api/leave-credits/accrue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ year: now.getFullYear(), month: now.getMonth() + 1 }),
      })
      const data = await res.json()
      setAccrueResult(data)
      if (data.summary?.successful > 0) {
        fetchCredits()
        fetchBalance()
      }
    } catch (err) {
      console.error('Failed to run accrual:', err)
    } finally {
      setAccrueLoading(false)
    }
  }

  const isAdmin = userRole === 'ADMIN'
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i)

  const selectedCredit = credits[0]
  const transactions = selectedCredit?.transactions || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Credits</h1>
          <p className="text-gray-500">Track and manage employee leave accruals</p>
        </div>
        <div className="flex gap-3">
          {isAdmin && (
            <button
              onClick={() => setShowAccrueModal(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <TrendingUp className="w-5 h-5" />
              Run Monthly Accrual
            </button>
          )}
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Vacation Leave</p>
              <p className="text-2xl font-bold">{balance?.vacation?.toFixed(2) || '0.00'} days</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-50 rounded-lg">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Sick Leave</p>
              <p className="text-2xl font-bold">{balance?.sick?.toFixed(2) || '0.00'} days</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Available</p>
              <p className="text-2xl font-bold">
                {((balance?.vacation || 0) + (balance?.sick || 0)).toFixed(2)} days
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        <div className="p-4 border-b flex items-center justify-between bg-gray-50/50">
          <h2 className="font-semibold text-gray-900">Credit History</h2>
          <div className="flex gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={fetchCredits}
              className="p-2 hover:bg-white rounded-lg border text-gray-500"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <History className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-medium">No transactions found</p>
            <p className="text-sm mt-1">Credits will appear after monthly accrual runs</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((tx: LeaveCreditTransaction) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {format(new Date(tx.createdAt), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tx.type === 'MONTHLY_ACCRUAL' ? 'bg-green-100 text-green-700' :
                        tx.type === 'USED' ? 'bg-red-100 text-red-700' :
                        tx.type === 'ADJUSTMENT' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {tx.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-sm font-medium ${
                      tx.days > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {tx.days > 0 ? '+' : ''}{tx.days.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {tx.balanceAfter.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {tx.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Accrual Modal */}
      {showAccrueModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Run Monthly Accrual</h2>
            </div>
            <div className="p-6 space-y-4">
              {!accrueResult ? (
                <>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
                      <p className="text-sm text-yellow-800">
                        This will accrue <strong>1.25 days</strong> for all regular employees 
                        who have completed their first full month of service.
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Month: {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </p>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800">
                      <strong>Successful:</strong> {accrueResult.summary?.successful}
                    </p>
                    <p className="text-sm text-green-800">
                      <strong>Skipped:</strong> {accrueResult.summary?.failed}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex gap-3">
              <button
                onClick={() => { setShowAccrueModal(false); setAccrueResult(null) }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              {!accrueResult && (
                <button
                  onClick={runMonthlyAccrual}
                  disabled={accrueLoading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {accrueLoading ? 'Processing...' : 'Run Accrual'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 1: Create app/(dashboard)/leave-credits/page.tsx**
- [ ] **Step 2: Run build check**

```bash
npm run build 2>&1 | head -50
```

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/leave-credits/page.tsx
git commit -m "feat: add leave credits dashboard UI"
```

---

## Chunk 6: Integrate with Leave Request (Show Balance)

### Task 6: Update Leave Page to Show Available Balance

**Files:**
- Modify: `app/(dashboard)/leaves/page.tsx`

Add a balance display section in the File Leave Modal.

```typescript
// Add after the stats summary section (around line 248), add:

// Fetch balance for leave filing
const [leaveBalance, setLeaveBalance] = useState({ vacation: 0, sick: 0 })

const fetchLeaveBalance = async () => {
  try {
    const res = await fetch('/api/leave-credits/balance', { credentials: 'include' })
    const data = await res.json()
    if (data.vacation !== undefined) {
      setLeaveBalance({ vacation: data.vacation || 0, sick: data.sick || 0 })
    }
  } catch (err) {
    console.error('Failed to fetch balance:', err)
  }
}

useEffect(() => {
  if (showModal) fetchLeaveBalance()
}, [showModal])
```

Then update the modal form (around line 409) to add balance display:

```tsx
<div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
  <div>
    <p className="text-xs text-gray-500">Vacation Available</p>
    <p className="text-lg font-bold text-green-600">{leaveBalance.vacation.toFixed(2)} days</p>
  </div>
  <div>
    <p className="text-xs text-gray-500">Sick Leave Available</p>
    <p className="text-lg font-bold text-orange-600">{leaveBalance.sick.toFixed(2)} days</p>
  </div>
</div>
```

- [ ] **Step 1: Update app/(dashboard)/leaves/page.tsx**
- [ ] **Step 2: Test the integration**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/leaves/page.tsx
git commit -m "feat: show leave balance when filing leave request"
```

---

## Chunk 7: Cron Job for Automated Accrual (Optional Enhancement)

### Task 7: Create Cron Job Script

**Files:**
- Create: `scripts/run-leave-accrual.ts`

```typescript
/**
 * Leave Accrual Cron Job
 * Run this script on the last day of every month via cron/scheduler
 * 
 * Usage: npx ts-node scripts/run-leave-accrual.ts
 */

import prisma from '../lib/prisma'
import { calculateMonthlyAccrual } from '../lib/leave-credits'

async function runMonthlyAccrual() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  
  console.log(`Starting leave accrual for ${now.toLocaleString('default', { month: 'long' })} ${year}`)
  
  const regularEmployees = await prisma.employee.findMany({
    where: { 
      employeeStatus: 'REGULAR',
      isActive: true,
    },
    select: { id: true, fullName: true },
  })
  
  console.log(`Found ${regularEmployees.length} regular employees`)
  
  let successCount = 0
  let failCount = 0
  
  for (const emp of regularEmployees) {
    const result = await calculateMonthlyAccrual(emp.id, year, month)
    if (result.success) {
      successCount++
      console.log(`✓ ${emp.fullName}: +${result.accrued} days`)
    } else {
      failCount++
      console.log(`○ ${emp.fullName}: ${result.error}`)
    }
  }
  
  console.log(`\nAccrual complete: ${successCount} succeeded, ${failCount} skipped/failed`)
}

runMonthlyAccrual()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Accrual job failed:', err)
    process.exit(1)
  })
```

- [ ] **Step 1: Create scripts/run-leave-accrual.ts**
- [ ] **Step 2: Update package.json with script**

Add to scripts section:
```json
"leave-accrual": "npx ts-node scripts/run-leave-accrual.ts"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/run-leave-accrual.ts package.json
git commit -m "feat: add cron job script for monthly leave accrual"
```

---

## Summary

### Features Implemented
1. **Database Schema** - EmployeeStatus enum, LeaveCredit and LeaveCreditTransaction models
2. **Type Definitions** - Full TypeScript types for leave credits
3. **Calculation Utilities** - Logic for monthly accrual, balance tracking, deduction
4. **API Endpoints** - GET/POST credits, balance check, manual accrual trigger
5. **Dashboard UI** - Leave credits page with transaction history
6. **Leave Integration** - Show available balance when filing leave
7. **Cron Script** - Optional script for automated monthly accrual

### Philippine Labor Law Compliance
- Implements Service Incentive Leave (SIL) per Article 95 of the Labor Code
- 15 days/year (1.25/month) - exceeds minimum 5-day requirement
- Tracks all transactions for audit trail
- Supports both vacation and sick leave

### Next Steps After Approval
1. Update Employee model to add `employeeStatus` and `regularizationDate` fields
2. Run `npm run db:push` to apply schema changes
3. Set up monthly cron job on server

---

**Plan ready for review. Approve to proceed with implementation?**
