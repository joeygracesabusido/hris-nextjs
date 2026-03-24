import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const dateFormat = formData.get('dateFormat') as string;

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

    const parseZKTecoDate = (dateStr: string, format: string): Date | null => {
      if (!dateStr) return null;
      
      try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          let year: number, month: number, day: number;
          
          if (format === 'yyyy-mm-dd') {
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[2], 10);
          } else if (format === 'mm-dd-yyyy') {
            month = parseInt(parts[0], 10) - 1;
            day = parseInt(parts[1], 10);
            year = parseInt(parts[2], 10);
          } else { // dd-mm-yyyy
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            year = parseInt(parts[2], 10);
          }
          
          const date = new Date(year, month, day);
          if (isNaN(date.getTime())) return null;
          return date;
        }
        return null;
      } catch {
        return null;
      }
    };

    const parseZKTecoTime = (timeStr: string): Date | null => {
      if (!timeStr) return null;
      
      try {
        const parts = timeStr.split(':');
        if (parts.length === 2) {
          const hours = parseInt(parts[0], 10);
          const minutes = parseInt(parts[1], 10);
          if (!isNaN(hours) && !isNaN(minutes)) {
            const date = new Date();
            date.setHours(hours, minutes, 0, 0);
            return date;
          }
        }
        return null;
      } catch {
        return null;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      try {
        const fields = line.split('\t');
        
        if (fields.length < 3) {
          results.failed++;
          results.errors.push(`Line ${i + 1}: Invalid format - insufficient fields`);
          continue;
        }

        const userId = fields[0].trim();
        const dateStr = fields[1].trim();
        const timeStr = fields[2].trim();

        if (!userId || !dateStr || !timeStr) {
          results.failed++;
          results.errors.push(`Line ${i + 1}: Missing required fields`);
          continue;
        }

        const dateObj = parseZKTecoDate(dateStr, dateFormat);
        if (!dateObj) {
          results.failed++;
          results.errors.push(`Line ${i + 1}: Invalid date format "${dateStr}"`);
          continue;
        }

        const timeObj = parseZKTecoTime(timeStr);
        if (!timeObj) {
          results.failed++;
          results.errors.push(`Line ${i + 1}: Invalid time format "${timeStr}"`);
          continue;
        }

        const employee = await prisma.employee.findFirst({
          where: { 
            OR: [
              { employeeNumber: parseInt(userId) },
              { employeeId: userId }
            ]
          },
        });

        if (!employee) {
          results.failed++;
          results.errors.push(`Line ${i + 1}: Employee not found for ID "${userId}"`);
          continue;
        }

        const dateNormalized = new Date(dateObj);
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

        const clockInTime = new Date(dateNormalized);
        clockInTime.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);

        if (existingLog) {
          if (!existingLog.clockIn) {
            await prisma.timeLog.update({
              where: { id: existingLog.id },
              data: {
                clockIn: clockInTime,
                isEdited: true,
                notes: 'Imported from biometric device',
              },
            });
          }
          results.success++;
        } else {
          await prisma.timeLog.create({
            data: {
              employeeId: employee.id,
              date: dateNormalized,
              clockIn: clockInTime,
              isEdited: true,
              notes: 'Imported from biometric device',
            },
          });
          results.success++;
        }
      } catch (rowError) {
        results.failed++;
        results.errors.push(`Line ${i + 1}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
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
