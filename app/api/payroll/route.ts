import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { 
  calculateSSS, 
  calculatePhilHealth, 
  calculatePagIBIG, 
  calculateHourlyRate as libCalculateHourlyRate 
} from '@/lib/payroll';
import { cache } from '@/lib/redis';

const PAYROLL_CACHE_PREFIX = 'payroll:';

function calculateWithholdingTax(monthlyTaxableIncome: number) {
  const BIR_TAX_TABLE_2026 = [
    { min: 0, max: 20833, baseTax: 0, percentage: 0, threshold: 0 },
    { min: 20833.01, max: 33332, baseTax: 0, percentage: 20, threshold: 20833 },
    { min: 33332.01, max: 66665, baseTax: 2500, percentage: 25, threshold: 33332 },
    { min: 66665.01, max: 166664, baseTax: 10833.25, percentage: 30, threshold: 66665 },
    { min: 166664.01, max: 416664, baseTax: 40833.25, percentage: 32, threshold: 166664 },
    { min: 416664.01, max: 999999999, baseTax: 121333.25, percentage: 35, threshold: 416664 },
  ];
  const bracket = BIR_TAX_TABLE_2026.find(b => monthlyTaxableIncome >= b.min && monthlyTaxableIncome <= b.max);
  if (!bracket || bracket.percentage === 0) return 0;
  const excess = monthlyTaxableIncome - bracket.threshold;
  return Math.max(0, bracket.baseTax + (excess * bracket.percentage / 100));
}

function calculateSemiMonthlySalary(monthlySalary: number, frequency: string): number {
  if (frequency === 'SEMIMONTHLY') {
    return monthlySalary / 2;
  }
  return monthlySalary;
}

// Fixed to 26 days as per user requirement
function calculateDailyRate(monthlySalary: number): number {
  return monthlySalary / 26;
}

function calculateHourlyRate(monthlySalary: number): number {
  return calculateDailyRate(monthlySalary) / 8;
}

function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) { // Not Sunday or Saturday
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, periodStart, periodEnd, frequency } = body;

    if (!periodStart || !periodEnd || !frequency) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    if (employeeId === 'all') {
      const employees = await prisma.employee.findMany();
      
      const results = [];
      const errors = [];

      for (const employee of employees) {
        try {
          const existingPayroll = await prisma.payroll.findFirst({
            where: {
              employeeId: employee.id,
              periodStart: { gte: startDate },
              periodEnd: { lte: endDate },
            },
          });

          if (existingPayroll) {
            errors.push({ employee: employee.fullName, error: 'Payroll already exists for this period' });
            continue;
          }

          const timeLogs = await prisma.timeLog.findMany({
            where: {
              employeeId: employee.id,
              date: { gte: startDate, lte: endDate },
            },
          });

          const leaves = await prisma.leaveRequest.findMany({
            where: {
              employeeId: employee.id,
              status: 'APPROVED',
              startDate: { lte: endDate },
              endDate: { gte: startDate },
            },
          });

          const approvedOvertimeLogs = timeLogs.filter(log => log.otStatus === 'APPROVED' && log.otHours > 0);
          const totalLogOtHours = approvedOvertimeLogs.reduce((sum, log) => sum + log.otHours, 0);

          const approvedOtRequests = await prisma.overtimeRequest.findMany({
            where: {
              employeeId: employee.id,
              status: 'APPROVED',
              date: { gte: startDate, lte: endDate },
            },
          });
          const totalRequestOtHours = approvedOtRequests.reduce((sum, req) => sum + req.hours, 0);

          const totalOtHours = totalLogOtHours + totalRequestOtHours;
          const totalLates = timeLogs.reduce((sum, log) => sum + (log.lateMinutes || 0), 0);
          const totalUndertime = timeLogs.reduce((sum, log) => sum + (log.undertimeMinutes || 0), 0);

          const monthlySalary = employee.basicSalary;
          const periodSalary = calculateSemiMonthlySalary(monthlySalary, frequency);
          const dailyRate = calculateDailyRate(monthlySalary);
          const hourlyRate = calculateHourlyRate(monthlySalary);
          const leaveDays = leaves.reduce((sum, leave) => sum + leave.daysCount, 0);
          
          // Use countWorkingDays to exclude weekends from the period calculation
          const workDaysInPeriod = countWorkingDays(startDate, endDate);
          const expectedWorkDays = Math.max(0, workDaysInPeriod - leaveDays);
          
          const daysWithTimeLog = timeLogs.filter(log => log.clockIn !== null).length;
          const absentDays = Math.max(0, expectedWorkDays - daysWithTimeLog);
          const absenceDeduction = absentDays * dailyRate;
          const lateDeduction = (totalLates / 60) * hourlyRate;
          const undertimeDeduction = (totalUndertime / 60) * hourlyRate;
          const otPay = totalOtHours * hourlyRate * 1.25;
          const grossPay = periodSalary + otPay;

          // Using lib/payroll functions for 2026 rates
          const sss = calculateSSS(monthlySalary);
          const philHealth = calculatePhilHealth(monthlySalary);
          const pagIbig = calculatePagIBIG(monthlySalary);
          
          const totalGovDeductions = sss.employeeShare + philHealth.employeeShare + pagIbig.employeeShare;
          const otherDeductions = absenceDeduction + lateDeduction + undertimeDeduction;
          const taxableIncome = grossPay - totalGovDeductions;
          const withholdingTax = calculateWithholdingTax(taxableIncome);
          const totalDeductions = totalGovDeductions + withholdingTax + otherDeductions;
          const netPay = grossPay - totalDeductions;

          const payroll = await prisma.payroll.create({
            data: {
              employeeId: employee.id,
              month: startDate.getMonth() + 1,
              year: startDate.getFullYear(),
              periodStart: startDate,
              periodEnd: endDate,
              basicSalary: periodSalary,
              workDays: expectedWorkDays,
              daysWorked: daysWithTimeLog,
              otHours: totalOtHours,
              otPay,
              grossPay,
              sssEmployee: sss.employeeShare,
              sssEmployer: sss.employerShare,
              philhealthEmployee: philHealth.employeeShare,
              philhealthEmployer: philHealth.employerShare,
              pagibigEmployee: pagIbig.employeeShare,
              pagibigEmployer: pagIbig.employerShare,
              withholdingTax,
              otherDeductions,
              totalDeductions,
              netPay,
              status: 'PROCESSED',
              processedAt: new Date(),
            },
          });

          results.push({
            payroll,
            employee: {
              id: employee.id,
              fullName: employee.fullName,
              employeeNumber: employee.employeeNumber,
              position: employee.position,
              department: employee.department,
            },
            netPay,
          });
        } catch (empError) {
          errors.push({ employee: employee.fullName, error: 'Failed to compute payroll' });
        }
      }

      return NextResponse.json({
        message: `Payroll computed for ${results.length} employees`,
        totalEmployees: employees.length,
        successCount: results.length,
        errorCount: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const existingPayroll = await prisma.payroll.findFirst({
      where: {
        employeeId,
        periodStart: { gte: startDate },
        periodEnd: { lte: endDate },
      },
    });

    if (existingPayroll) {
      return NextResponse.json(
        { error: 'Payroll already exists for this period. Use update to modify.' },
        { status: 409 }
      );
    }

    const timeLogs = await prisma.timeLog.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
    });

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    const approvedOvertimeLogs = timeLogs.filter(log => log.otStatus === 'APPROVED' && log.otHours > 0);
    const totalLogOtHours = approvedOvertimeLogs.reduce((sum, log) => sum + log.otHours, 0);

    const approvedOtRequests = await prisma.overtimeRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        date: { gte: startDate, lte: endDate },
      },
    });
    const totalRequestOtHours = approvedOtRequests.reduce((sum, req) => sum + req.hours, 0);

    const totalOtHours = totalLogOtHours + totalRequestOtHours;

    const totalLates = timeLogs.reduce((sum, log) => sum + (log.lateMinutes || 0), 0);
    const totalUndertime = timeLogs.reduce((sum, log) => sum + (log.undertimeMinutes || 0), 0);

    const monthlySalary = employee.basicSalary;
    const periodSalary = calculateSemiMonthlySalary(monthlySalary, frequency);

    const dailyRate = calculateDailyRate(monthlySalary);
    const hourlyRate = calculateHourlyRate(monthlySalary);

    const leaveDays = leaves.reduce((sum, leave) => sum + leave.daysCount, 0);

    // Use countWorkingDays to exclude weekends from the period calculation
    const workDaysInPeriod = countWorkingDays(startDate, endDate);
    const expectedWorkDays = Math.max(0, workDaysInPeriod - leaveDays);

    const daysWithTimeLog = timeLogs.filter(log => log.clockIn !== null).length;
    const absentDays = Math.max(0, expectedWorkDays - daysWithTimeLog);
    const absenceDeduction = absentDays * dailyRate;

    const lateDeduction = (totalLates / 60) * hourlyRate;
    const undertimeDeduction = (totalUndertime / 60) * hourlyRate;

    const otPay = totalOtHours * hourlyRate * 1.25;

    const grossPay = periodSalary + otPay;

    // Using lib/payroll functions for 2026 rates
    const sss = calculateSSS(monthlySalary);
    const philHealth = calculatePhilHealth(monthlySalary);
    const pagIbig = calculatePagIBIG(monthlySalary);

    const totalGovDeductions = sss.employeeShare + philHealth.employeeShare + pagIbig.employeeShare;
    const otherDeductions = absenceDeduction + lateDeduction + undertimeDeduction;

    const taxableIncome = grossPay - totalGovDeductions;
    const withholdingTax = calculateWithholdingTax(taxableIncome);

    const totalDeductions = totalGovDeductions + withholdingTax + otherDeductions;
    const netPay = grossPay - totalDeductions;

    const payroll = await prisma.payroll.create({
      data: {
        employeeId,
        month: startDate.getMonth() + 1,
        year: startDate.getFullYear(),
        periodStart: startDate,
        periodEnd: endDate,
        basicSalary: periodSalary,
        workDays: expectedWorkDays,
        daysWorked: daysWithTimeLog,
        otHours: totalOtHours,
        otPay,
        grossPay,
        sssEmployee: sss.employeeShare,
        sssEmployer: sss.employerShare,
        philhealthEmployee: philHealth.employeeShare,
        philhealthEmployer: philHealth.employerShare,
        pagibigEmployee: pagIbig.employeeShare,
        pagibigEmployer: pagIbig.employerShare,
        withholdingTax,
        otherDeductions,
        totalDeductions,
        netPay,
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    // Invalidate payroll cache
    try {
      await cache.delByPattern(`${PAYROLL_CACHE_PREFIX}*`);
    } catch (cacheErr) {
      console.error('Failed to invalidate payroll cache:', cacheErr);
    }

    return NextResponse.json({
      message: 'Payroll computed successfully',
      payroll,
      details: {
        employee: {
          id: employee.id,
          fullName: employee.fullName,
          employeeNumber: employee.employeeNumber,
          position: employee.position,
          department: employee.department,
          basicSalary: employee.basicSalary,
          payrollFrequency: employee.payrollFrequency,
        },
        period: {
          periodStart: startDate,
          periodEnd: endDate,
          frequency,
        },
        earnings: {
          baseSalary: periodSalary,
          overtimePay: otPay,
          grossPay,
        },
        deductions: {
          absences: absenceDeduction,
          lates: lateDeduction,
          undertime: undertimeDeduction,
          sss: sss.employeeShare,
          philHealth: philHealth.employeeShare,
          pagIbig: pagIbig.employeeShare,
          withholdingTax,
          totalDeductions,
        },
        totals: {
          totalOtHours,
          leaveDays,
          absentDays,
          lateMinutes: totalLates,
          undertimeMinutes: totalUndertime,
        },
        netPay,
      },
    });
  } catch (error) {
    console.error('Error computing payroll:', error);
    return NextResponse.json({ error: 'Failed to compute payroll' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    const cacheKey = `${PAYROLL_CACHE_PREFIX}${employeeId || 'all'}:${month || 'all'}:${year || 'all'}`;
    
    try {
      const cachedPayrolls = await cache.get(cacheKey);
      if (cachedPayrolls) {
        return NextResponse.json(cachedPayrolls);
      }
    } catch (cacheErr) {
      console.error('Failed to get from payroll cache:', cacheErr);
    }

    const where: any = {};

    if (employeeId) where.employeeId = employeeId;
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);

    const payrolls = await prisma.payroll.findMany({
      where,
      include: { employee: true },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    // Cache for 30 minutes
    try {
      await cache.set(cacheKey, payrolls, 1800);
    } catch (cacheErr) {
      console.error('Failed to set payroll cache:', cacheErr);
    }

    return NextResponse.json(payrolls);
  } catch (error) {
    console.error('Error fetching payrolls:', error);
    return NextResponse.json({ error: 'Failed to fetch payrolls' }, { status: 500 });
  }
}
