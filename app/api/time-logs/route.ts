import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    const where = employeeId ? { employeeId } : {};

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

    const formattedLogs = timeLogs.map(log => {
      const emp = employeeMap.get(log.employeeId);
      return {
        ...log,
        employee: emp ? {
          fullName: emp.fullName,
          employeeId: emp.employeeId,
        } : { fullName: 'Unknown', employeeId: 'N/A' },
      };
    });

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
      return NextResponse.json(
        { error: 'Employee ID and type are required' },
        { status: 400 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingLog = await prisma.timeLog.findFirst({
      where: {
        employeeId,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (type === 'clockIn') {
      if (existingLog && existingLog.clockIn) {
        return NextResponse.json(
          { error: 'You have already clocked in today' },
          { status: 400 }
        );
      }

      if (existingLog) {
        await prisma.timeLog.update({
          where: { id: existingLog.id },
          data: { clockIn: new Date() },
        });
        return NextResponse.json(
          { message: 'Clock in recorded successfully' },
          { status: 200 }
        );
      }

      await prisma.timeLog.create({
        data: {
          employeeId,
          date: new Date(),
          clockIn: new Date(),
        },
      });

      return NextResponse.json(
        { message: 'Clock in recorded successfully' },
        { status: 201 }
      );
    }

    if (type === 'clockOut') {
      if (!existingLog) {
        return NextResponse.json(
          { error: 'You have not clocked in today' },
          { status: 400 }
        );
      }

      if (existingLog.clockOut) {
        return NextResponse.json(
          { error: 'You have already clocked out today' },
          { status: 400 }
        );
      }

      const clockInTime = existingLog.clockIn ? new Date(existingLog.clockIn) : new Date();
      const clockOutTime = new Date();
      const hoursWorked = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      await prisma.timeLog.update({
        where: { id: existingLog.id },
        data: {
          clockOut: clockOutTime,
          workHours: Math.round(hoursWorked * 100) / 100,
        },
      });

      return NextResponse.json(
        { message: 'Clock out recorded successfully' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: 'Invalid type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error recording time log:', error);
    return NextResponse.json(
      { error: 'Failed to record time log' },
      { status: 500 }
    );
  }
}
