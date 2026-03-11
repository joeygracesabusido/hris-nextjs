import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeIdParam = searchParams.get('employeeId');

    const where: Record<string, unknown> = {};

    // If not admin, filter to only show the logged-in employee's data
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        include: { employees: true },
      });

      if (!user || !user.employees || user.employees.length === 0) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
      }

      where.employeeId = user.employees[0].id;
    } else if (employeeIdParam) {
      where.employeeId = employeeIdParam;
    }

    const timeLogs = await prisma.timeLog.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const employeeIds = Array.from(new Set(timeLogs.map(log => log.employeeId)));
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, fullName: true, employeeId: true },
    });
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

    const formattedLogs = await Promise.all(timeLogs.map(async (log) => {
      const emp = employeeMap.get(log.employeeId);
      
      const schedule = await prisma.shiftSchedule.findFirst({
        where: {
          employeeId: log.employeeId,
          date: {
            gte: startOfDay(new Date(log.date)),
            lte: endOfDay(new Date(log.date)),
          }
        },
        include: {
          shift: true
        }
      });

      return {
        ...log,
        shift: schedule?.shift || null,
        employee: emp ? {
          fullName: emp.fullName,
          employeeId: emp.employeeId,
        } : { fullName: 'Unknown', employeeId: 'N/A' },
      };
    }));

    return NextResponse.json(formattedLogs);
  } catch (error) {
    console.error('Error fetching time logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, type } = body;

    if (!employeeId || !type) {
      return NextResponse.json({ error: 'Employee ID and type are required' }, { status: 400 });
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const existingLog = await prisma.timeLog.findFirst({
      where: {
        employeeId,
        date: { gte: todayStart, lte: todayEnd },
      },
    });

    if (type === 'clockIn') {
      if (existingLog && existingLog.clockIn) {
        return NextResponse.json({ error: 'You have already clocked in today' }, { status: 400 });
      }

      // Calculate lateness if a shift is assigned
      let lateMinutes = 0;
      const schedule = await prisma.shiftSchedule.findFirst({
        where: {
          employeeId,
          date: { gte: todayStart, lte: todayEnd },
        },
        include: { shift: true }
      });

      if (schedule?.shift && !schedule.shift.isOff && schedule.shift.startTime !== '-') {
        const [sHour, sMin] = schedule.shift.startTime.split(':').map(Number);
        const scheduledTime = new Date(now);
        scheduledTime.setHours(sHour, sMin, 0, 0);
        
        const diffMs = now.getTime() - scheduledTime.getTime();
        if (diffMs > 60000) { // More than 1 minute late
          lateMinutes = Math.floor(diffMs / 60000);
        }
      }

      if (existingLog) {
        await prisma.timeLog.update({
          where: { id: existingLog.id },
          data: { clockIn: now, lateMinutes },
        });
      } else {
        await prisma.timeLog.create({
          data: {
            employeeId,
            date: now,
            clockIn: now,
            lateMinutes,
          },
        });
      }
      return NextResponse.json({ message: 'Clock in recorded successfully' });
    }

    if (type === 'clockOut') {
      if (!existingLog) {
        return NextResponse.json({ error: 'You have not clocked in today' }, { status: 400 });
      }
      if (existingLog.clockOut) {
        return NextResponse.json({ error: 'You have already clocked out today' }, { status: 400 });
      }

      const clockInTime = new Date(existingLog.clockIn!);
      const hoursWorked = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      await prisma.timeLog.update({
        where: { id: existingLog.id },
        data: {
          clockOut: now,
          workHours: Math.round(hoursWorked * 100) / 100,
        },
      });

      return NextResponse.json({ message: 'Clock out recorded successfully' });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Error recording time log:', error);
    return NextResponse.json({ error: 'Failed to record time log' }, { status: 500 });
  }
}
