import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

export async function GET() {
  try {
    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);

    // 1. Get all employees
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        department: true,
      },
    });

    // 2. Get today's time logs
    const todayLogs = await prisma.timeLog.findMany({
      where: {
        date: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      select: {
        employeeId: true,
      },
    });

    const presentEmployeeIds = new Set(todayLogs.map((log) => log.employeeId));

    // 3. Get approved leaves for today
    const activeLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: endOfToday },
        endDate: { gte: startOfToday },
      },
      select: {
        employeeId: true,
      },
    });

    const onLeaveEmployeeIds = new Set(activeLeaves.map((leave) => leave.employeeId));

    // 4. Calculate absences per department
    const departmentStats: Record<string, { total: number; present: number; absent: number; onLeave: number }> = {};

    employees.forEach((emp) => {
      const dept = emp.department || 'Unassigned';
      if (!departmentStats[dept]) {
        departmentStats[dept] = { total: 0, present: 0, absent: 0, onLeave: 0 };
      }
      
      departmentStats[dept].total++;
      
      if (presentEmployeeIds.has(emp.id)) {
        departmentStats[dept].present++;
      } else if (onLeaveEmployeeIds.has(emp.id)) {
        departmentStats[dept].onLeave++;
        departmentStats[dept].absent++; // Leaves are counted as absent from work
      } else {
        departmentStats[dept].absent++;
      }
    });

    const absentPerDepartment = Object.entries(departmentStats).map(([name, stats]) => ({
      name,
      absent: stats.absent,
      total: stats.total,
    }));

    // 5. General stats (can be expanded)
    const stats = {
      totalEmployees: employees.length,
      presentToday: presentEmployeeIds.size,
      onLeaveToday: onLeaveEmployeeIds.size,
      absentPerDepartment,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
