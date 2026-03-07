import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, periodStart, periodEnd, frequency } = body;

    if (!employeeId || !periodStart || !periodEnd || !frequency) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    const timeLogs = await prisma.timeLog.findMany({
      where: {
        employeeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
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

    const approvedTimeLogs = timeLogs.filter((log: any) => log.otStatus === 'APPROVED');
    const approvedLeaves = leaves.filter((leave: any) => leave.leaveType === 'BUSINESS_TRIP');

    const totalOtHours = approvedTimeLogs.reduce((sum: number, log: any) => sum + (log.otHours || 0), 0);
    const totalWorkHours = timeLogs.reduce((sum: number, log: any) => sum + (log.workHours || 0), 0);
    const daysWorked = timeLogs.filter((log: any) => log.clockIn).length;
    const workDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const leaveDays = approvedLeaves.reduce((sum: number, leave: any) => sum + leave.daysCount, 0);
    const actualWorkDays = workDays - leaveDays;

    const daysInMonth = frequency === 'WEEKLY' ? 7 : frequency === 'SEMIMONTHLY' ? 15 : 30;
    const basicSalary = employee.basicSalary;
    const dailyRate = basicSalary / 26;
    const hourlyRate = dailyRate / 8;

    const otPay = totalOtHours * hourlyRate * 1.25;
    const grossPay = basicSalary + otPay;

    const sssEmployee = calculateSSS(basicSalary);
    const philHealthEmployee = calculatePhilHealth(basicSalary);
    const pagIbigEmployee = calculatePagIBIG(basicSalary);

    const totalDeductions = sssEmployee + philHealthEmployee + pagIbigEmployee;
    const taxableIncome = grossPay - totalDeductions;
    const withholdingTax = calculateWithholdingTax(taxableIncome, frequency);

    const netPay = grossPay - totalDeductions - withholdingTax;

    const payroll = await prisma.payroll.create({
      data: {
        employeeId,
        month: startDate.getMonth() + 1,
        year: startDate.getFullYear(),
        periodStart: startDate,
        periodEnd: endDate,
        basicSalary,
        workDays: actualWorkDays,
        daysWorked: daysWorked,
        otHours: totalOtHours,
        otPay,
        grossPay,
        sssEmployee,
        sssEmployer: sssEmployee * 1.41,
        philhealthEmployee: philHealthEmployee,
        philhealthEmployer: philHealthEmployee,
        pagibigEmployee: pagIbigEmployee,
        pagibigEmployer: pagIbigEmployee,
        withholdingTax,
        totalDeductions: totalDeductions + withholdingTax,
        netPay,
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Payroll computed successfully',
      payroll,
      details: {
        employee,
        timeLogs: timeLogs.length,
        approvedLeaves: leaves.length,
        totalOtHours,
        deductions: {
          sss: sssEmployee,
          philHealth: philHealthEmployee,
          pagIbig: pagIbigEmployee,
          withholdingTax,
        },
      },
    });
  } catch (error) {
    console.error('Error computing payroll:', error);
    return NextResponse.json(
      { error: 'Failed to compute payroll' },
      { status: 500 }
    );
  }
}

function calculateSSS(salary: number): number {
  const sssTable = [
    { min: 0, max: 4250, share: 180 },
    { min: 4250, max: 4975, share: 202.5 },
    { min: 4975, max: 5700, share: 225 },
    { min: 5700, max: 6425, share: 247.5 },
    { min: 6425, max: 7150, share: 270 },
    { min: 7150, max: 7875, share: 292.5 },
    { min: 7875, max: 8600, share: 315 },
    { min: 8600, max: 9325, share: 337.5 },
    { min: 9325, max: 10050, share: 360 },
    { min: 10050, max: 10775, share: 382.5 },
    { min: 10775, max: 11500, share: 405 },
    { min: 11500, max: 12225, share: 427.5 },
    { min: 12225, max: 12950, share: 450 },
    { min: 12950, max: 13675, share: 472.5 },
    { min: 13675, max: 14400, share: 495 },
    { min: 14400, max: 15125, share: 517.5 },
    { min: 15125, max: 15850, share: 540 },
    { min: 15850, max: 16575, share: 562.5 },
    { min: 16575, max: 17300, share: 585 },
    { min: 17300, max: 18025, share: 607.5 },
    { min: 18025, max: 18750, share: 630 },
    { min: 18750, max: 19475, share: 652.5 },
    { min: 19475, max: 20200, share: 675 },
    { min: 20200, max: 20925, share: 697.5 },
    { min: 20925, max: 21650, share: 720 },
    { min: 21650, max: 22375, share: 742.5 },
    { min: 22375, max: 23100, share: 765 },
    { min: 23100, max: 23825, share: 787.5 },
    { min: 23825, max: 24550, share: 810 },
    { min: 24550, max: 25275, share: 832.5 },
    { min: 25275, max: 26000, share: 855 },
    { min: 26000, max: 26725, share: 877.5 },
    { min: 26725, max: 27450, share: 900 },
    { min: 27450, max: 28175, share: 922.5 },
    { min: 28175, max: 28900, share: 945 },
    { min: 28900, max: 29625, share: 967.5 },
    { min: 29625, max: 30350, share: 990 },
    { min: 30350, max: 31075, share: 1012.5 },
    { min: 31075, max: 31800, share: 1035 },
    { min: 31800, max: 32525, share: 1057.5 },
    { min: 32525, max: 33250, share: 1080 },
    { min: 33250, max: 33975, share: 1102.5 },
    { min: 33975, max: 34700, share: 1125 },
    { min: 34700, max: 35425, share: 1147.5 },
    { min: 35425, max: 36150, share: 1170 },
    { min: 36150, max: 36875, share: 1192.5 },
    { min: 36875, max: 37600, share: 1215 },
    { min: 37600, max: 38325, share: 1237.5 },
    { min: 38325, max: 39050, share: 1260 },
    { min: 39050, max: 39775, share: 1282.5 },
    { min: 39775, max: 40500, share: 1305 },
    { min: 40500, max: 41225, share: 1327.5 },
    { min: 41225, max: 41950, share: 1350 },
    { min: 41950, max: 42675, share: 1372.5 },
    { min: 42675, max: 43400, share: 1395 },
    { min: 43400, max: 44125, share: 1417.5 },
    { min: 44125, max: 44850, share: 1440 },
    { min: 44850, max: 45575, share: 1462.5 },
    { min: 45575, max: 46300, share: 1485 },
    { min: 46300, max: 47025, share: 1507.5 },
    { min: 47025, max: 47750, share: 1530 },
    { min: 47750, max: 48475, share: 1552.5 },
    { min: 48475, max: 49200, share: 1575 },
    { min: 49200, max: 49925, share: 1597.5 },
    { min: 49925, max: 50650, share: 1620 },
    { min: 50650, max: 51375, share: 1642.5 },
    { min: 51375, max: 52100, share: 1665 },
    { min: 52100, max: 52825, share: 1687.5 },
    { min: 52825, max: 53550, share: 1710 },
    { min: 53550, max: 54275, share: 1732.5 },
    { min: 54275, max: 55000, share: 1755 },
    { min: 55000, max: 55725, share: 1777.5 },
    { min: 55725, max: 56450, share: 1800 },
    { min: 56450, max: 57175, share: 1822.5 },
    { min: 57175, max: 57900, share: 1845 },
    { min: 57900, max: 58625, share: 1867.5 },
    { min: 58625, max: 59350, share: 1890 },
    { min: 59350, max: 60075, share: 1912.5 },
    { min: 60075, max: 60800, share: 1935 },
    { min: 60800, max: 61525, share: 1957.5 },
    { min: 61525, max: 62250, share: 1980 },
    { min: 62250, max: 62975, share: 2002.5 },
    { min: 62975, max: 63700, share: 2025 },
    { min: 63700, max: 64425, share: 2047.5 },
    { min: 64425, max: 65150, share: 2070 },
    { min: 65150, max: 65875, share: 2092.5 },
    { min: 65875, max: 66600, share: 2115 },
    { min: 66600, max: 67325, share: 2137.5 },
    { min: 67325, max: 68050, share: 2160 },
    { min: 68050, max: 68775, share: 2182.5 },
    { min: 68775, max: 69500, share: 2205 },
    { min: 69500, max: 70225, share: 2227.5 },
    { min: 70225, max: 70950, share: 2250 },
    { min: 70950, max: 71675, share: 2272.5 },
    { min: 71675, max: 72400, share: 2295 },
    { min: 72400, max: 73125, share: 2317.5 },
    { min: 73125, max: 73850, share: 2340 },
    { min: 73850, max: 74575, share: 2362.5 },
    { min: 74575, max: 75300, share: 2385 },
    { min: 75300, max: 76025, share: 2407.5 },
    { min: 76025, max: 76750, share: 2430 },
    { min: 76750, max: 77475, share: 2452.5 },
    { min: 77475, max: 78200, share: 2475 },
    { min: 78200, max: 78925, share: 2497.5 },
    { min: 78925, max: 79650, share: 2520 },
    { min: 79650, max: 80375, share: 2542.5 },
    { min: 80375, max: 81100, share: 2565 },
    { min: 81100, max: 81825, share: 2587.5 },
    { min: 81825, max: 82550, share: 2610 },
    { min: 82550, max: 83275, share: 2632.5 },
    { min: 83275, max: 84000, share: 2655 },
    { min: 84000, max: 84725, share: 2677.5 },
    { min: 84725, max: 85450, share: 2700 },
    { min: 85450, max: 86175, share: 2722.5 },
    { min: 86175, max: 86900, share: 2745 },
    { min: 86900, max: 87625, share: 2767.5 },
    { min: 87625, max: 88350, share: 2790 },
    { min: 88350, max: 89075, share: 2812.5 },
    { min: 89075, max: 89800, share: 2835 },
    { min: 89800, max: 90525, share: 2857.5 },
    { min: 90525, max: 91250, share: 2880 },
    { min: 91250, max: 91975, share: 2902.5 },
    { min: 91975, max: 92700, share: 2925 },
    { min: 92700, max: 93425, share: 2947.5 },
    { min: 93425, max: 94150, share: 2970 },
    { min: 94150, max: 94875, share: 2992.5 },
    { min: 94875, max: 95600, share: 3015 },
    { min: 95600, max: 96325, share: 3037.5 },
    { min: 96325, max: 97050, share: 3060 },
    { min: 97050, max: 97775, share: 3082.5 },
    { min: 97775, max: 98500, share: 3105 },
    { min: 98500, max: 99225, share: 3127.5 },
    { min: 99225, max: 99950, share: 3150 },
    { min: 99950, max: 100675, share: 3172.5 },
    { min: 100675, max: 101400, share: 3195 },
    { min: 101400, max: 102125, share: 3217.5 },
  ];

  const bracket = sssTable.find(s => salary >= s.min && salary <= s.max);
  return bracket ? bracket.share : 3195;
}

function calculatePhilHealth(salary: number): number {
  const floor = 10000;
  const ceiling = 100000;
  const monthlySalary = Math.max(floor, Math.min(ceiling, salary));
  return Math.round(monthlySalary * 0.025);
}

function calculatePagIBIG(salary: number): number {
  const floor = 1000;
  const ceiling = 5000;
  const monthlySalary = Math.max(floor, Math.min(ceiling, salary));
  return Math.round(monthlySalary * 0.02);
}

function calculateWithholdingTax(monthlySalary: number, frequency: string): number {
  const divisor = frequency === 'WEEKLY' ? 4 : frequency === 'SEMIMONTHLY' ? 2 : 1;
  const salary = monthlySalary / divisor;

  if (salary < 6250) return 0;
  if (salary < 10417) return (salary - 6250) * 0.05;
  if (salary < 14583) return (salary - 10417) * 0.10 + 208.33;
  if (salary < 20833) return (salary - 14583) * 0.15 + 625;
  if (salary < 31250) return (salary - 20833) * 0.20 + 1562.50;
  if (salary < 47917) return (salary - 31250) * 0.25 + 3645.83;
  if (salary < 81250) return (salary - 47917) * 0.30 + 7770.83;
  if (salary < 125000) return (salary - 81250) * 0.32 + 17770.83;
  if (salary < 250000) return (salary - 125000) * 0.35 + 32020.83;
  if (salary < 500000) return (salary - 250000) * 0.40 + 75770.83;
  if (salary < 750000) return (salary - 500000) * 0.45 + 175770.83;
  if (salary < 1000000) return (salary - 750000) * 0.50 + 288270.83;
  if (salary < 2010000) return (salary - 1000000) * 0.55 + 413270.83;
  return (salary - 2010000) * 0.60 + 968270.83;
}
