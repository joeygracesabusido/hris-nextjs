import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface TouchlinkLog {
  employeeId: string;
  dateTime: Date;
  status: number;
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

    const text = await file.text();
    const lines = text.trim().split('\n');
    
    if (lines.length === 0) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    const parseTouchlinkLine = (line: string): TouchlinkLog | null => {
      const fields = line.trim().split(/\t+/);
      
      if (fields.length < 2) return null;

      const userId = fields[0].trim();
      const dateTimeStr = fields[1].trim();

      if (!userId || !dateTimeStr) return null;

      const dateTime = new Date(dateTimeStr);
      if (isNaN(dateTime.getTime())) return null;

      const status = fields[2] ? parseInt(fields[2], 10) : 0;

      return {
        employeeId: userId,
        dateTime,
        status,
      };
    };

    const groupedLogs: Map<string, TouchlinkLog[]> = new Map();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const log = parseTouchlinkLine(line);
      
      if (!log) {
        results.failed++;
        results.errors.push(`Line ${i + 1}: Invalid format`);
        continue;
      }

      const key = `${log.employeeId}_${log.dateTime.toISOString().split('T')[0]}`;
      if (!groupedLogs.has(key)) {
        groupedLogs.set(key, []);
      }
      groupedLogs.get(key)!.push(log);
    }

    for (const [key, logs] of groupedLogs) {
      const [employeeId] = key.split('_');
      
      try {
        const employee = await prisma.employee.findFirst({
          where: { 
            OR: [
              { employeeNumber: parseInt(employeeId, 10) },
              { employeeId: employeeId }
            ]
          },
        });

        if (!employee) {
          results.failed += logs.length;
          results.errors.push(`Employee not found for ID "${employeeId}"`);
          continue;
        }

        logs.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
        const firstLog = logs[0];
        const lastLog = logs[logs.length - 1];

        const dateNormalized = new Date(firstLog.dateTime);
        dateNormalized.setHours(0, 0, 0, 0);

        const dateStart = new Date(dateNormalized);
        const dateEnd = new Date(dateNormalized);
        dateEnd.setDate(dateEnd.getDate() + 1);

        const existingLog = await prisma.timeLog.findFirst({
          where: {
            employeeId: employee.id,
            date: {
              gte: dateStart,
              lt: dateEnd,
            },
          },
        });

        if (existingLog) {
          const hasClockIn = existingLog.clockIn !== null;
          const hasClockOut = existingLog.clockOut !== null;

          const updateData: Record<string, unknown> = {
            isEdited: true,
            notes: 'Imported from Touchlink biometric device',
          };

          if (!hasClockIn) {
            updateData.clockIn = firstLog.dateTime;
          }
          if (!hasClockOut && logs.length > 1) {
            updateData.clockOut = lastLog.dateTime;
            
            if (firstLog.dateTime && lastLog.dateTime) {
              const hoursWorked = (lastLog.dateTime.getTime() - firstLog.dateTime.getTime()) / (1000 * 60 * 60);
              updateData.workHours = Math.round(hoursWorked * 100) / 100;
            }
          }

          await prisma.timeLog.update({
            where: { id: existingLog.id },
            data: updateData,
          });
        } else {
          const clockIn = firstLog.dateTime;
          const clockOut = logs.length > 1 ? lastLog.dateTime : null;
          
          let workHours = 0;
          if (clockIn && clockOut) {
            workHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
            workHours = Math.round(workHours * 100) / 100;
          }

          await prisma.timeLog.create({
            data: {
              employeeId: employee.id,
              date: dateNormalized,
              clockIn,
              clockOut,
              workHours,
              isEdited: true,
              notes: 'Imported from Touchlink biometric device',
            },
          });
        }
        results.success++;
      } catch (rowError) {
        results.failed += logs.length;
        results.errors.push(`Error processing logs for employee "${employeeId}": ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      message: `Import completed: ${results.success} successful, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    console.error('Error importing biometric data:', error);
    return NextResponse.json(
      { error: 'Failed to import biometric data' },
      { status: 500 }
    );
  }
}
