import prisma from '@/lib/prisma'

const MONTHLY_ACCRUAL_DAYS = 1.25
const MONTHLY_SICK_ACCRUAL_DAYS = 1.25

export interface AccrualResult {
  success: boolean
  accrued: number
  employeeId: string
  error?: string
}

export async function calculateMonthlyAccrual(
  employeeId: string,
  year: number,
  month: number
): Promise<AccrualResult> {
  try {
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

    if (employee.employeeStatus !== 'REGULAR') {
      return { success: false, accrued: 0, employeeId, error: 'Employee is not regular' }
    }

    if (!employee.isActive) {
      return { success: false, accrued: 0, employeeId, error: 'Employee is inactive' }
    }

    const accrualStartDate = employee.regularizationDate || employee.hireDate
    
    const firstMonthStart = new Date(year, month - 1, 1)
    
    if (accrualStartDate > firstMonthStart) {
      return { 
        success: false, 
        accrued: 0, 
        employeeId, 
        error: 'Employee hired mid-month - no accrual until next month' 
      }
    }

    // Standard PH company practice: 15 VL + 15 SL per year for regulars
    // (exceeds 5-day SIL minimum under Labor Code Art. 95).
    const accrualPlan = [
      { leaveType: 'VACATION', days: MONTHLY_ACCRUAL_DAYS },
      { leaveType: 'SICK', days: MONTHLY_SICK_ACCRUAL_DAYS },
    ] as const

    let totalAccrued = 0

    for (const plan of accrualPlan) {
      const existingForType = await prisma.leaveCreditTransaction.findFirst({
        where: {
          leaveCredit: { employeeId, leaveType: plan.leaveType },
          type: 'MONTHLY_ACCRUAL',
          description: { contains: `${getMonthName(month)} ${year}` },
        },
      })

      if (existingForType) continue

      let leaveCredit = await prisma.leaveCredit.findUnique({
        where: {
          employeeId_leaveType_year: {
            employeeId,
            leaveType: plan.leaveType,
            year,
          },
        },
      })

      if (!leaveCredit) {
        leaveCredit = await prisma.leaveCredit.create({
          data: {
            employeeId,
            leaveType: plan.leaveType,
            year,
            totalDays: 0,
            usedDays: 0,
            availableDays: 0,
          },
        })
      }

      try {
        await prisma.$transaction(async (tx) => {
          const startOfMonth = new Date(year, month - 1, 1)
          const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999)

          const existingInTx = await tx.leaveCreditTransaction.findFirst({
            where: {
              leaveCreditId: leaveCredit!.id,
              type: 'MONTHLY_ACCRUAL',
              createdAt: { gte: startOfMonth, lte: endOfMonth },
            },
          })

          if (existingInTx) {
            throw new Error('DUPLICATE_ACCRUAL')
          }

          const currentCredit = await tx.leaveCredit.findUnique({
            where: { id: leaveCredit!.id },
          })

          if (!currentCredit) {
            throw new Error('CREDIT_NOT_FOUND')
          }

          const prevBalance = currentCredit.availableDays
          const newBalance = prevBalance + plan.days

          await tx.leaveCreditTransaction.create({
            data: {
              leaveCreditId: leaveCredit!.id,
              type: 'MONTHLY_ACCRUAL',
              days: plan.days,
              balanceBefore: prevBalance,
              balanceAfter: newBalance,
              description: `Monthly accrual for ${getMonthName(month)} ${year}`,
            },
          })

          await tx.leaveCredit.update({
            where: { id: leaveCredit!.id },
            data: {
              totalDays: { increment: plan.days },
              availableDays: { increment: plan.days },
            },
          })
        })

        totalAccrued += plan.days
      } catch (txError) {
        // Skip duplicate race for this type, continue with the other type
        console.error(`Accrual skipped for ${plan.leaveType}:`, txError)
      }
    }

    if (totalAccrued === 0) {
      return { success: false, accrued: 0, employeeId, error: 'Already accrued for this month' }
    }

    return { success: true, accrued: totalAccrued, employeeId }
  } catch (error) {
    console.error('Error calculating monthly accrual:', error)
    return { success: false, accrued: 0, employeeId, error: 'Internal error' }
  }
}

export async function getLeaveBalance(
  employeeId: string,
  year: number = new Date().getFullYear()
): Promise<{ vacation: number; sick: number }> {
  const credits = await prisma.leaveCredit.findMany({
    where: { employeeId, year },
  })

  const vacation = credits.find((c: { leaveType: string; availableDays: number }) => c.leaveType === 'VACATION')?.availableDays || 0
  const sick = credits.find((c: { leaveType: string; availableDays: number }) => c.leaveType === 'SICK')?.availableDays || 0

  return { vacation, sick }
}

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
