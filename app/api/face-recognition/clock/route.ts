import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';
import { cookies } from 'next/headers';

const MANILA_TIMEZONE = 'Asia/Manila';

function getManilaNow(): Date {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: MANILA_TIMEZONE }));
}

function getManilaToday(): { start: Date; end: Date } {
  const now = getManilaNow();
  return {
    start: startOfDay(now),
    end: endOfDay(now),
  };
}

// Haversine formula to calculate distance between two GPS coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get('isLoggedIn')?.value === 'true';

    if (!isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      employeeId,
      type = 'auto', // 'auto' | 'clockIn' | 'clockOut'
      confidence,
      photo,
      latitude,
      longitude,
    } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        fullName: true,
        employeeId: true,
        employeeNumber: true,
        department: true,
        position: true,
        isActive: true,
      },
    });

    if (!employee || !employee.isActive) {
      return NextResponse.json(
        { error: 'Employee not found or inactive' },
        { status: 404 }
      );
    }

    // Optional GPS check if office location is set and coordinates provided
    const officeLocation = await prisma.officeLocation.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (officeLocation && latitude !== undefined && longitude !== undefined) {
      const distance = calculateDistance(
        latitude,
        longitude,
        officeLocation.latitude,
        officeLocation.longitude
      );
      if (distance > officeLocation.radius) {
        return NextResponse.json(
          {
            error: `Outside office geofence: ${Math.round(distance)}m away (limit ${officeLocation.radius}m)`,
          },
          { status: 403 }
        );
      }
    }

    const now = getManilaNow();
    const { start: todayStart, end: todayEnd } = getManilaToday();

    const existingLog = await prisma.timeLog.findFirst({
      where: {
        employeeId,
        date: { gte: todayStart, lte: todayEnd },
      },
    });

    // Resolve action if type is 'auto'
    let action = type;
    if (type === 'auto') {
      if (!existingLog || !existingLog.clockIn) {
        action = 'clockIn';
      } else if (!existingLog.clockOut) {
        action = 'clockOut';
      } else {
        return NextResponse.json({
          status: 'ALREADY_COMPLETED',
          message: `${employee.fullName} has already completed attendance (Clock In & Out) for today.`,
          employee,
          timeLog: existingLog,
        });
      }
    }

    const formatDisplayTime = (d: Date) => {
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    };

    if (action === 'clockIn') {
      if (existingLog && existingLog.clockIn) {
        return NextResponse.json(
          { error: `${employee.fullName} has already clocked in today` },
          { status: 400 }
        );
      }

      // Check shift lateness
      let lateMinutes = 0;
      const schedule = await prisma.shiftSchedule.findFirst({
        where: {
          employeeId,
          date: { gte: todayStart, lte: todayEnd },
        },
        include: { shift: true },
      });

      if (schedule?.shift && !schedule.shift.isOff && schedule.shift.startTime !== '-') {
        const [sHour, sMin] = schedule.shift.startTime.split(':').map(Number);
        const scheduledTime = new Date(now.getTime());
        scheduledTime.setHours(sHour, sMin, 0, 0);

        const diffMs = now.getTime() - scheduledTime.getTime();
        if (diffMs > 60000) {
          lateMinutes = Math.floor(diffMs / 60000);
        }
      }

      let log;
      if (existingLog) {
        log = await prisma.timeLog.update({
          where: { id: existingLog.id },
          data: {
            clockIn: now,
            lateMinutes,
            clockInMethod: 'FACIAL',
            clockInPhoto: photo || undefined,
            confidence: confidence || undefined,
            clockInLatitude: latitude,
            clockInLongitude: longitude,
          },
        });
      } else {
        log = await prisma.timeLog.create({
          data: {
            employeeId,
            date: now,
            clockIn: now,
            lateMinutes,
            clockInMethod: 'FACIAL',
            clockInPhoto: photo || undefined,
            confidence: confidence || undefined,
            clockInLatitude: latitude,
            clockInLongitude: longitude,
          },
        });
      }

      const timeStr = formatDisplayTime(now);
      return NextResponse.json({
        success: true,
        action: 'clockIn',
        message: `Welcome, ${employee.fullName}! Clock in recorded at ${timeStr}.`,
        employee,
        timeLog: log,
        timeString: timeStr,
        lateMinutes,
      });
    }

    if (action === 'clockOut') {
      if (!existingLog || !existingLog.clockIn) {
        return NextResponse.json(
          { error: `${employee.fullName} has not clocked in yet today` },
          { status: 400 }
        );
      }
      if (existingLog.clockOut) {
        return NextResponse.json(
          { error: `${employee.fullName} has already clocked out today` },
          { status: 400 }
        );
      }

      const clockInTime = new Date(existingLog.clockIn);
      const hoursWorked = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      const log = await prisma.timeLog.update({
        where: { id: existingLog.id },
        data: {
          clockOut: now,
          workHours: Math.round(hoursWorked * 100) / 100,
          clockOutMethod: 'FACIAL',
          clockOutPhoto: photo || undefined,
          confidence: confidence || undefined,
          clockOutLatitude: latitude,
          clockOutLongitude: longitude,
        },
      });

      const timeStr = formatDisplayTime(now);
      return NextResponse.json({
        success: true,
        action: 'clockOut',
        message: `Goodbye, ${employee.fullName}! Clock out recorded at ${timeStr}. (${hoursWorked.toFixed(1)} hrs worked)`,
        employee,
        timeLog: log,
        timeString: timeStr,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
      });
    }

    return NextResponse.json({ error: 'Invalid action type' }, { status: 400 });
  } catch (error) {
    console.error('Error recording facial attendance:', error);
    return NextResponse.json(
      { error: 'Failed to record facial attendance' },
      { status: 500 }
    );
  }
}

// Fetch today's recent facial time logs for the live kiosk feed
export async function GET() {
  try {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get('isLoggedIn')?.value === 'true';

    if (!isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { start: todayStart, end: todayEnd } = getManilaToday();

    const todayLogs = await prisma.timeLog.findMany({
      where: {
        date: { gte: todayStart, lte: todayEnd },
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeId: true,
            department: true,
            position: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json(todayLogs);
  } catch (error) {
    console.error('Error fetching today facial logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
