import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { 
  calculateSSS, 
  calculatePhilHealth, 
  calculatePagIBIG, 
  calculateWithholdingTax,
  calculateDailyRate,
  calculateHourlyRate
} from '@/lib/payroll';
import { cache } from '@/lib/redis';

const PAYROLL_CACHE_PREFIX = 'payroll:';

function calculateSemiMonthlySalary(monthlySalary: number, frequency: string): number {
  if (frequency === 'SEMIMONTHLY') {
    return monthlySalary / 2;
  }
  return monthlySalary;
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
    const { 
      employeeId, 
      periodStart, 
      periodEnd, 
      frequency, 
      deductions = ['sss', 'philhealth', 'pagibig', 'tax', 'cash_advance', 'sss_loan', 'pagibig_loan'] 
    } = body;

    if (!periodStart || !periodEnd || !frequency) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    const includeSSS = deductions.includes('sss');
    const includePhilHealth = deductions.includes('philhealth');
    const includePagIBIG = deductions.includes('pagibig');
    const includeTax = deductions.includes('tax');
    
    // Map frontend IDs to DB types
    const selectedAdvanceTypes = [];
    if (deductions.includes('cash_advance')) selectedAdvanceTypes.push('CASH_ADVANCE');
    if (deductions.includes('sss_loan')) selectedAdvanceTypes.push('SSS_LOAN');
    if (deductions.includes('pagibig_loan')) selectedAdvanceTypes.push('PAGIBIG_LOAN');

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

          const monthlySalary = employee.payType === 'DAILY' 
            ? (employee.dailyRate * 26) 
            : employee.basicSalary;
          const employeePayType = employee.payType || 'MONTHLY';
          const employeeDailyRate = employee.dailyRate || calculateDailyRate(monthlySalary);
          
          let periodSalary = 0;
          const dailyRate = employeeDailyRate;
          
          if (employeePayType === 'DAILY') {
            periodSalary = 0;
          } else {
            periodSalary = calculateSemiMonthlySalary(monthlySalary, frequency);
          }
          
          const hourlyRate = calculateHourlyRate(employeePayType === 'DAILY' ? employeeDailyRate * 26 : monthlySalary);
          const otPay = totalOtHours * hourlyRate * 1.25;
          
          const leaveDays = leaves.reduce((sum, leave) => sum + leave.daysCount, 0);
          
          const workDaysInPeriod = countWorkingDays(startDate, endDate);
          const expectedWorkDays = Math.max(0, workDaysInPeriod - leaveDays);
          
          const daysWithTimeLog = timeLogs.filter(log => log.clockIn !== null).length;
          
          let grossPay = 0;
          let otherDeductions = 0;
          
          if (employeePayType === 'DAILY') {
            grossPay = (daysWithTimeLog * dailyRate) + otPay;
          } else {
            const absentDays = Math.max(0, expectedWorkDays - daysWithTimeLog);
            const absenceDeduction = absentDays * dailyRate;
            const lateDeduction = (totalLates / 60) * hourlyRate;
            const undertimeDeduction = (totalUndertime / 60) * hourlyRate;
            otherDeductions = absenceDeduction + lateDeduction + undertimeDeduction;
            grossPay = periodSalary + otPay - otherDeductions;
          }

          // Using lib/payroll functions for 2026 rates
          const sss = includeSSS ? calculateSSS(monthlySalary) : { employeeShare: 0, employerShare: 0 };
          const philHealth = includePhilHealth ? calculatePhilHealth(monthlySalary) : { employeeShare: 0, employerShare: 0 };
          const pagIbig = includePagIBIG ? calculatePagIBIG(monthlySalary) : { employeeShare: 0, employerShare: 0 };
          
          const totalGovDeductions = sss.employeeShare + philHealth.employeeShare + pagIbig.employeeShare;
          const taxableIncome = grossPay - totalGovDeductions;
          const withholdingTax = includeTax ? calculateWithholdingTax(taxableIncome, frequency) : 0;
          
          // Fetch active advances for this employee if selected by type
          const activeAdvances = selectedAdvanceTypes.length > 0 ? await prisma.advance.findMany({
            where: {
              employeeId: employee.id,
              status: 'ACTIVE',
              remainingBalance: { gt: 0 },
              type: { in: selectedAdvanceTypes }
            }
          }) : [];

          let totalAdvanceDeductions = 0;
          const advancePaymentsData = [];

          for (const advance of activeAdvances) {
            // Only deduct up to what's remaining
            const deduction = Math.min(advance.deductionAmount, advance.remainingBalance);
            if (deduction > 0) {
              totalAdvanceDeductions += deduction;
              advancePaymentsData.push({
                advanceId: advance.id,
                amount: deduction,
                balanceAfter: advance.remainingBalance - deduction,
                notes: `Deducted from payroll for ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
              });
            }
          }

          const totalDeductions = totalGovDeductions + withholdingTax + otherDeductions + totalAdvanceDeductions;
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
              otherDeductions: otherDeductions + totalAdvanceDeductions, // Include advances in other deductions for simple storage
              totalDeductions,
              netPay,
              status: 'PROCESSED',
              processedAt: new Date(),
            },
          });

          // Create advance payment records and update advance balances
          for (const paymentData of advancePaymentsData) {
            await prisma.advancePayment.create({
              data: {
                ...paymentData,
                payrollId: payroll.id,
                paymentDate: new Date()
              }
            });

            await prisma.advance.update({
              where: { id: paymentData.advanceId },
              data: {
                remainingBalance: paymentData.balanceAfter,
                status: paymentData.balanceAfter <= 0 ? 'FULLY_PAID' : 'ACTIVE'
              }
            });
          }

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

    const monthlySalary = employee.payType === 'DAILY' 
      ? (employee.dailyRate * 26) 
      : employee.basicSalary;
    const employeePayType = employee.payType || 'MONTHLY';
    const employeeDailyRate = employee.dailyRate || calculateDailyRate(monthlySalary);
    
    let periodSalary = 0;
    const dailyRate = employeeDailyRate;
    
    if (employeePayType === 'DAILY') {
      periodSalary = 0;
    } else {
      periodSalary = calculateSemiMonthlySalary(monthlySalary, frequency);
    }
    
    const hourlyRate = calculateHourlyRate(employeePayType === 'DAILY' ? employeeDailyRate * 26 : monthlySalary);
    const otPay = totalOtHours * hourlyRate * 1.25;

    const leaveDays = leaves.reduce((sum, leave) => sum + leave.daysCount, 0);

    const workDaysInPeriod = countWorkingDays(startDate, endDate);
    const expectedWorkDays = Math.max(0, workDaysInPeriod - leaveDays);

    const daysWithTimeLog = timeLogs.filter(log => log.clockIn !== null).length;
    
    let grossPay = 0;
    let otherDeductions = 0;
    let absenceDeduction = 0;
    let lateDeduction = 0;
    let undertimeDeduction = 0;
    let absentDays = 0;
    
    if (employeePayType === 'DAILY') {
      grossPay = (daysWithTimeLog * dailyRate) + otPay;
    } else {
      absentDays = Math.max(0, expectedWorkDays - daysWithTimeLog);
      absenceDeduction = absentDays * dailyRate;
      lateDeduction = (totalLates / 60) * hourlyRate;
      undertimeDeduction = (totalUndertime / 60) * hourlyRate;
      otherDeductions = absenceDeduction + lateDeduction + undertimeDeduction;
      grossPay = periodSalary + otPay - otherDeductions;
    }

    // Using lib/payroll functions for 2026 rates
    const sss = includeSSS ? calculateSSS(monthlySalary) : { employeeShare: 0, employerShare: 0 };
    const philHealth = includePhilHealth ? calculatePhilHealth(monthlySalary) : { employeeShare: 0, employerShare: 0 };
    const pagIbig = includePagIBIG ? calculatePagIBIG(monthlySalary) : { employeeShare: 0, employerShare: 0 };

    const totalGovDeductions = sss.employeeShare + philHealth.employeeShare + pagIbig.employeeShare;

    const taxableIncome = grossPay - totalGovDeductions;
    const withholdingTax = includeTax ? calculateWithholdingTax(taxableIncome, frequency) : 0;

    // Fetch active advances for this employee if selected by type
    const activeAdvances = selectedAdvanceTypes.length > 0 ? await prisma.advance.findMany({
      where: {
        employeeId,
        status: 'ACTIVE',
        remainingBalance: { gt: 0 },
        type: { in: selectedAdvanceTypes }
      }
    }) : [];

    let totalAdvanceDeductions = 0;
    const advancePaymentsData = [];

    for (const advance of activeAdvances) {
      const deduction = Math.min(advance.deductionAmount, advance.remainingBalance);
      if (deduction > 0) {
        totalAdvanceDeductions += deduction;
        advancePaymentsData.push({
          advanceId: advance.id,
          amount: deduction,
          balanceAfter: advance.remainingBalance - deduction,
          notes: `Deducted from payroll for ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
        });
      }
    }

    const totalDeductions = totalGovDeductions + withholdingTax + otherDeductions + totalAdvanceDeductions;
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
        otherDeductions: otherDeductions + totalAdvanceDeductions,
        totalDeductions,
        netPay,
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    // Create advance payment records and update advance balances
    for (const paymentData of advancePaymentsData) {
      await prisma.advancePayment.create({
        data: {
          ...paymentData,
          payrollId: payroll.id,
          paymentDate: new Date()
        }
      });

      await prisma.advance.update({
        where: { id: paymentData.advanceId },
        data: {
          remainingBalance: paymentData.balanceAfter,
          status: paymentData.balanceAfter <= 0 ? 'FULLY_PAID' : 'ACTIVE'
        }
      });
    }

    // Invalidate payroll and advances cache
    try {
      await cache.delByPattern(`${PAYROLL_CACHE_PREFIX}*`);
      await cache.delByPattern('advances:*');
    } catch (cacheErr) {
      console.error('Failed to invalidate caches:', cacheErr);
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

    const where: Record<string, number | string> = {};

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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const payrollId = searchParams.get('id');

    if (!payrollId) {
      return NextResponse.json({ error: 'Payroll ID is required' }, { status: 400 });
    }

    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
    });

    if (!payroll) {
      return NextResponse.json({ error: 'Payroll not found' }, { status: 404 });
    }

    await prisma.payroll.delete({
      where: { id: payrollId },
    });

    // Invalidate cache
    try {
      await cache.delByPattern(`${PAYROLL_CACHE_PREFIX}*`);
    } catch (cacheErr) {
      console.error('Failed to invalidate payroll cache:', cacheErr);
    }

    return NextResponse.json({ message: 'Payroll deleted successfully' });
  } catch (error) {
    console.error('Error deleting payroll:', error);
    return NextResponse.json({ error: 'Failed to delete payroll' }, { status: 500 });
  }
}
