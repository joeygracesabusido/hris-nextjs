import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { buildRoleBasedWhereClause } from '@/lib/auth-helpers';

const MANILA_TIMEZONE = 'Asia/Manila';

function getManilaNow(): Date {
  const now = new Date();
  const manilaTime = new Date(now.toLocaleString('en-US', { timeZone: MANILA_TIMEZONE }));
  return manilaTime;
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

// Get active office location
async function getActiveOfficeLocation() {
  try {
    const location = await prisma.officeLocation.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return location;
  } catch (error) {
    console.error('Error fetching office location:', error);
    return null;
  }
}

// Validate GPS location against office geofence
async function validateGPS(latitude: number, longitude: number) {
  const officeLocation = await getActiveOfficeLocation();
  
  // If no office location is set, allow by default
  if (!officeLocation) {
    return { valid: true, distance: 0 };
  }

  const distance = calculateDistance(
    latitude,
    longitude,
    officeLocation.latitude,
    officeLocation.longitude
  );

  return {
    valid: distance <= officeLocation.radius,
    distance,
    radius: officeLocation.radius,
  };
}

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

    // Build role-based where clause
    const where = await buildRoleBasedWhereClause(userEmail, userRole || '', employeeIdParam ?? undefined);

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

    // Fetch all active holidays
    const holidays = await prisma.holiday.findMany({
      where: { isActive: true, branchId: null },
    })
    const holidayMap = new Map(
      holidays.map(h => [new Date(h.date).toLocaleDateString(), h])
    );

    const formattedLogs = await Promise.all(timeLogs.map(async (log) => {
      const emp = employeeMap.get(log.employeeId);
      const logDateStr = new Date(log.date).toLocaleDateString();
      const holiday = holidayMap.get(logDateStr) || null;
      
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
        holiday,
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
    const { employeeId, type, latitude, longitude } = body;

    if (!employeeId || !type) {
      return NextResponse.json({ error: 'Employee ID and type are required' }, { status: 400 });
    }

    // Validate GPS location if provided
    let gpsValid = true;
    let gpsDistance = 0;
    let gpsRadius = 0;
    
    if (latitude !== undefined && longitude !== undefined) {
      const gpsResult = await validateGPS(latitude, longitude);
      gpsValid = gpsResult.valid;
      gpsDistance = gpsResult.distance;
      gpsRadius = gpsResult.radius ?? 0;
    } else {
      // If no GPS provided, check if office location is configured
      const officeLocation = await getActiveOfficeLocation();
      if (officeLocation) {
        return NextResponse.json(
          { error: 'GPS location is required. Please enable location services.' },
          { status: 400 }
        );
      }
    }

    // Reject if outside geofence
    if (!gpsValid) {
      return NextResponse.json(
        { 
          error: `You must be within ${gpsRadius} meters of the office to ${type}. Current distance: ${Math.round(gpsDistance)} meters` 
        },
        { status: 403 }
      );
    }

    const now = getManilaNow();
    const { start: todayStart, end: todayEnd } = getManilaToday();

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
        const scheduledTime = new Date(now.getTime());
        scheduledTime.setHours(sHour, sMin, 0, 0);
        
        const diffMs = now.getTime() - scheduledTime.getTime();
        if (diffMs > 60000) { // More than 1 minute late
          lateMinutes = Math.floor(diffMs / 60000);
        }
      }

      if (existingLog) {
        await prisma.timeLog.update({
          where: { id: existingLog.id },
          data: { 
            clockIn: now, 
            lateMinutes,
            clockInLatitude: latitude,
            clockInLongitude: longitude,
          },
        });
      } else {
        await prisma.timeLog.create({
          data: {
            employeeId,
            date: now,
            clockIn: now,
            lateMinutes,
            clockInLatitude: latitude,
            clockInLongitude: longitude,
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
          clockOutLatitude: latitude,
          clockOutLongitude: longitude,
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

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Time log ID is required' }, { status: 400 });
    }

    await prisma.timeLog.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Time log deleted successfully' });
  } catch (error) {
    console.error('Error deleting time log:', error);
    return NextResponse.json({ error: 'Failed to delete time log' }, { status: 500 });
  }
}

const UpdateTimeLogSchema = z.object({
  id: z.string().min(1, 'Time log ID is required'),
  // Calendar day (Manila) in YYYY-MM-DD format — editable in the Edit dialog
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  // Wall-clock times (Manila) in HH:MM format; empty string clears the value
  clockIn: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time').or(z.literal('')),
  clockOut: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time').or(z.literal('')),
  notes: z.string().max(500).optional(),
});

function toManilaDayKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: MANILA_TIMEZONE });
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: unknown = await request.json();
    const parsed = UpdateTimeLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { id, date, clockIn, clockOut, notes } = parsed.data;

    const existing = await prisma.timeLog.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Time log not found' }, { status: 404 });
    }

    if (clockIn === '' && clockOut !== '') {
      return NextResponse.json(
        { error: 'Clock in is required when clock out is set' },
        { status: 400 }
      );
    }

    const [year, month, day] = date.split('-').map(Number);
    // Noon UTC anchor keeps the calendar day stable across timezones
    // (same convention as the XCLS import).
    const newDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

    const buildWallTime = (hhmm: string): Date => {
      const [h, m] = hhmm.split(':').map(Number);
      // Times are stored as UTC but represent Philippines local time,
      // matching the XCLS import convention and the frontend display
      // (which reads UTC hours directly as Manila time).
      return new Date(Date.UTC(year, month - 1, day, h, m, 0, 0));
    };

    const newClockIn = clockIn !== '' ? buildWallTime(clockIn) : null;
    const newClockOut = clockOut !== '' ? buildWallTime(clockOut) : null;

    if (newClockIn && newClockOut && newClockOut.getTime() <= newClockIn.getTime()) {
      return NextResponse.json(
        { error: 'Clock out must be after clock in' },
        { status: 400 }
      );
    }

    // Duplicate-day guard: the schema unique key is on the exact timestamp,
    // so compare Manila calendar days against the employee's other logs.
    const siblings = await prisma.timeLog.findMany({
      where: { employeeId: existing.employeeId, NOT: { id } },
      select: { id: true, date: true },
    });
    const clash = siblings.find((sib) => toManilaDayKey(new Date(sib.date)) === date);
    if (clash) {
      return NextResponse.json(
        { error: 'Another time log already exists for this employee on the selected date' },
        { status: 409 }
      );
    }

    let workHours = 0;
    if (newClockIn && newClockOut) {
      workHours = Math.round(((newClockOut.getTime() - newClockIn.getTime()) / 3600000) * 100) / 100;
    }

    const updated = await prisma.timeLog.update({
      where: { id },
      data: {
        date: newDate,
        clockIn: newClockIn,
        clockOut: newClockOut,
        workHours,
        notes: notes ?? existing.notes,
        isEdited: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating time log:', error);
    return NextResponse.json({ error: 'Failed to update time log' }, { status: 500 });
  }
}
