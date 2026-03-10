import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay, parseISO, isValid } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
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

    // 1. Fetch Employees
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        position: true,
        department: true,
      },
      orderBy: { fullName: 'asc' },
    });

    // 2. Fetch Schedules
    const schedules = await prisma.shiftSchedule.findMany({
      where: {
        date: {
          gte: startOfRange,
          lte: endOfRange,
        },
      },
      include: {
        shift: true,
      },
    });

    return NextResponse.json({ 
      employees: employees || [], 
      schedules: schedules || [] 
    });
  } catch (error: any) {
    console.error('[Schedules API] Critical GET Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch schedules', 
      details: error.message,
      code: error.code,
      stack: error.stack
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
  } catch (error: any) {
    console.error('[Schedules API] Critical POST Error:', error);
    return NextResponse.json({ error: 'Failed to update schedule', details: error.message }, { status: 500 });
  }
}
