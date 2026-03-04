export const runtime = "edge";

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface ImportTimeLog {
  employeeNumber: string;
  date: string;
  clockIn: string;
  clockOut: string;
  notes?: string;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as ImportTimeLog[];

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'File is empty or has no valid data' },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const row of data) {
      try {
        if (!row.employeeNumber || !row.date) {
          results.failed++;
          results.errors.push(`Row skipped: missing employee number or date`);
          continue;
        }

        const employee = await prisma.employee.findFirst({
          where: { employeeNumber: parseInt(String(row.employeeNumber)) },
        });

        if (!employee) {
          results.failed++;
          results.errors.push(`Employee not found: ${row.employeeNumber}`);
          continue;
        }

        const dateStr = row.date;
        const dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime())) {
          results.failed++;
          results.errors.push(`Invalid date for employee ${row.employeeNumber}: ${row.date}`);
          continue;
        }

        const dateStart = new Date(dateObj);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(dateObj);
        dateEnd.setDate(dateEnd.getDate() + 1);
        dateEnd.setHours(0, 0, 0, 0);

        const existingLog = await prisma.timeLog.findFirst({
          where: {
            employeeId: employee.id,
            date: {
              gte: dateStart,
              lt: dateEnd,
            },
          },
        });

        let clockInTime: Date | null = null;
        let clockOutTime: Date | null = null;

        if (row.clockIn) {
          const clockInDate = new Date(dateObj);
          const [clockInHours, clockInMinutes] = String(row.clockIn).split(':').map(Number);
          if (!isNaN(clockInHours) && !isNaN(clockInMinutes)) {
            clockInDate.setHours(clockInHours, clockInMinutes, 0, 0);
            clockInTime = clockInDate;
          }
        }

        if (row.clockOut) {
          const clockOutDate = new Date(dateObj);
          const [clockOutHours, clockOutMinutes] = String(row.clockOut).split(':').map(Number);
          if (!isNaN(clockOutHours) && !isNaN(clockOutMinutes)) {
            clockOutDate.setHours(clockOutHours, clockOutMinutes, 0, 0);
            clockOutTime = clockOutDate;
          }
        }

        let workHours = 0;
        if (clockInTime && clockOutTime) {
          workHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
          workHours = Math.round(workHours * 100) / 100;
        }

        if (existingLog) {
          await prisma.timeLog.update({
            where: { id: existingLog.id },
            data: {
              clockIn: clockInTime || existingLog.clockIn,
              clockOut: clockOutTime || existingLog.clockOut,
              workHours: workHours || existingLog.workHours,
              notes: row.notes || existingLog.notes,
              isEdited: true,
            },
          });
        } else {
          await prisma.timeLog.create({
            data: {
              employeeId: employee.id,
              date: dateObj,
              clockIn: clockInTime,
              clockOut: clockOutTime,
              workHours,
              notes: row.notes || '',
            },
          });
        }

        results.success++;
      } catch (rowError) {
        results.failed++;
        results.errors.push(`Error processing row: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      message: `Import completed: ${results.success} successful, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    console.error('Error importing time logs:', error);
    return NextResponse.json(
      { error: 'Failed to import time logs' },
      { status: 500 }
    );
  }
}
