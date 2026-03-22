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

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { year, month } = body

    const targetYear = year || new Date().getFullYear()
    const targetMonth = month || new Date().getMonth() + 1

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
