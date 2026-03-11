import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay, parseISO, isValid } from 'date-fns';
import { cookies } from 'next/headers';

interface PrismaError extends Error {
  code?: string;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const start = parseISO(startDate);
    const end = parseISO(endDate);

    if (!isValid(start) || !isValid(end)) {
      return NextResponse.json({ error: 'Invalid date format provided' }, { status: 400 });
    }

    const startOfRange = startOfDay(start);
    const endOfRange = endOfDay(end);

    if (!prisma) throw new Error('Prisma client not initialized');

    // If not admin or manager, filter to only show the logged-in employee's schedule
    let employeeFilter = {};
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        include: { employees: true },
      });

      if (!user || !user.employees || user.employees.length === 0) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
      }

      employeeFilter = { id: user.employees[0].id };
    }

    // 1. Fetch Employees
    const employees = await prisma.employee.findMany({
      where: { isActive: true, ...(userRole !== 'ADMIN' && userRole !== 'MANAGER' ? employeeFilter : {}) },
      select: {
        id: true,
        fullName: true,
        position: true,
        department: true,
      },
      orderBy: { fullName: 'asc' },
    });

    // If employee, only fetch their schedules
    let scheduleEmployeeFilter = {};
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        include: { employees: true },
      });
      if (user && user.employees && user.employees.length > 0) {
        scheduleEmployeeFilter = { employeeId: user.employees[0].id };
      }
    }

    // 2. Fetch Schedules
    const schedules = await prisma.shiftSchedule.findMany({
      where: {
        date: {
          gte: startOfRange,
          lte: endOfRange,
        },
        ...scheduleEmployeeFilter,
      },
      include: {
        shift: true,
      },
    });

    return NextResponse.json({ 
      employees: employees || [], 
      schedules: schedules || [] 
    });
  } catch (error: unknown) {
    console.error('[Schedules API] Critical GET Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = error instanceof Error ? (error as PrismaError).code : undefined;
    return NextResponse.json({
      error: 'Failed to fetch schedules',
      details: errorMessage,
      code: errorCode,
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Handle bulk update
    if (Array.isArray(body)) {
      const results = [];
      for (const item of body) {
        const { employeeId, shiftId, date } = item;
        const parsedDate = startOfDay(new Date(date));
        const schedule = await prisma.shiftSchedule.upsert({
          where: {
            employeeId_date: { employeeId, date: parsedDate },
          },
          update: { shiftId },
          create: { employeeId, shiftId, date: parsedDate },
          include: { shift: true },
        });
        results.push(schedule);
      }
      return NextResponse.json(results);
    }

    // Handle single update
    const { employeeId, shiftId, date } = body;
    if (!employeeId || !shiftId || !date) {
      return NextResponse.json({ error: 'employeeId, shiftId, and date are required' }, { status: 400 });
    }

    const parsedDate = startOfDay(new Date(date));
    const schedule = await prisma.shiftSchedule.upsert({
      where: {
        employeeId_date: { employeeId, date: parsedDate },
      },
      update: { shiftId },
      create: { employeeId, shiftId, date: parsedDate },
      include: { shift: true },
    });

    return NextResponse.json(schedule);
  } catch (error: unknown) {
    console.error('[Schedules API] Critical POST Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to update schedule', details: errorMessage }, { status: 500 });
  }
}
