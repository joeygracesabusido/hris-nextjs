import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { hasAdminAccess } from '@/lib/auth-helpers';
import { calculate13thMonthPay, splitTaxableBonus } from '@/lib/ph-standards';

/**
 * GET /api/payroll/thirteenth-month?year=2026&employeeId=all
 * Standard 13th-month pay per PD 851:
 *   13th month = total basic salary earned in the calendar year / 12
 *   Tax-exempt up to P90,000 combined with other bonuses.
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value || '';
    if (!hasAdminAccess(userRole)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get('year') || new Date().getFullYear());
    const employeeId = searchParams.get('employeeId') || 'all';
    const otherBonuses = Number(searchParams.get('bonuses') || 0);

    const employees = await prisma.employee.findMany({
      where: employeeId === 'all' ? { isActive: true } : { id: employeeId },
      select: { id: true, fullName: true, employeeId: true, basicSalary: true, payType: true, dailyRate: true },
    });

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const results = [];
    for (const emp of employees) {
      const payrolls = await prisma.payroll.findMany({
        where: { employeeId: emp.id, periodStart: { gte: yearStart }, periodEnd: { lte: yearEnd } },
        select: { basicSalary: true, grossPay: true },
      });

      // Prefer summed basicSalary from processed payrolls; fall back to pro-rated monthly salary.
      const totalBasic = payrolls.length > 0
        ? payrolls.reduce((s, p) => s + (p.basicSalary || 0), 0)
        : 0;

      const fallbackMonthly = emp.payType === 'DAILY' ? (emp.dailyRate || 0) * 26 : emp.basicSalary || 0;
      const estimatedAnnual = totalBasic > 0 ? totalBasic : fallbackMonthly * 12;

      const thirteenth = calculate13thMonthPay(estimatedAnnual);
      const { exempt, taxable } = splitTaxableBonus(thirteenth + otherBonuses);

      results.push({
        employeeId: emp.id,
        employeeCode: emp.employeeId,
        fullName: emp.fullName,
        totalBasicEarned: Math.round(estimatedAnnual * 100) / 100,
        thirteenthMonthPay: thirteenth,
        otherBonuses,
        exemptAmount: exempt,
        taxableAmount: taxable,
        basedOnActualPayrolls: payrolls.length > 0,
      });
    }

    return NextResponse.json({ year, ceiling: 90000, results });
  } catch (error) {
    console.error('Error computing 13th month:', error);
    return NextResponse.json({ error: 'Failed to compute 13th month pay' }, { status: 500 });
  }
}
