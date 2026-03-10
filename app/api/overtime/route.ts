import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { cache } from '@/lib/redis';

const OVERTIME_CACHE_PREFIX = 'overtime:';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cacheKey = `${OVERTIME_CACHE_PREFIX}${userRole}:${userEmail}`;
    try {
      const cachedOvertime = await cache.get(cacheKey);
      if (cachedOvertime) {
        return NextResponse.json(cachedOvertime);
      }
    } catch (cacheErr) {
      console.error('Failed to get from overtime cache:', cacheErr);
    }

    let overtime;
    // If admin, return all overtime requests
    if (userRole === 'ADMIN') {
      overtime = await prisma.overtimeRequest.findMany({
        include: { employee: true, approver: true },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // For non-admin users, find their employee record
      const currentUser = await prisma.user.findUnique({
        where: { email: userEmail },
        include: { employees: true },
      });

      if (!currentUser || !currentUser.employees || currentUser.employees.length === 0) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
      }

      const employee = currentUser.employees[0];

      // Find overtime filed by this employee OR overtime where this employee is the manager (approver)
      overtime = await prisma.overtimeRequest.findMany({
        where: {
          OR: [
            { employeeId: employee.id },
            { approverId: employee.id },
          ],
        },
        include: { employee: true, approver: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Cache for 10 minutes
    try {
      await cache.set(cacheKey, overtime, 600);
    } catch (cacheErr) {
      console.error('Failed to set overtime cache:', cacheErr);
    }

    return NextResponse.json(overtime);
  } catch (error) {
    console.error('Error fetching overtime:', error);
    return NextResponse.json({ error: 'Failed to fetch overtime' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('POST /api/overtime - Request body:', body);
    const { date, hours, reason, employeeId: providedEmployeeId } = body;

    if (!date || !hours || !reason) {
      return NextResponse.json({ error: 'Date, hours, and reason are required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    const userRole = cookieStore.get('userRole')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { employees: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let targetEmployeeId: string;

    // If Admin provides an employeeId, use it. Otherwise use the currentUser's employee record.
    if (userRole === 'ADMIN' && providedEmployeeId) {
      targetEmployeeId = providedEmployeeId;
    } else {
      if (!currentUser.employees || currentUser.employees.length === 0) {
        return NextResponse.json({ error: 'Employee record not found for current user' }, { status: 404 });
      }
      targetEmployeeId = currentUser.employees[0].id;
    }

    console.log('POST /api/overtime - Target employee ID:', targetEmployeeId);

    // Validate targetEmployeeId format (should be 24-character hex for MongoDB)
    if (!/^[0-9a-fA-F]{24}$/.test(targetEmployeeId)) {
      return NextResponse.json({ error: 'Invalid employee selection' }, { status: 400 });
    }

    // Determine immediate supervisor (manager) of the target employee
    const targetEmployee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: { managerId: true },
    });

    if (!targetEmployee) {
      return NextResponse.json({ error: 'Target employee not found' }, { status: 404 });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const overtimeRequest = await prisma.overtimeRequest.create({
      data: {
        employeeId: targetEmployeeId,
        approverId: targetEmployee?.managerId, // Set to manager if exists
        date: parsedDate,
        hours: parseFloat(hours),
        reason,
        status: 'PENDING',
      },
    });

    // Invalidate overtime cache
    try {
      await cache.delByPattern(`${OVERTIME_CACHE_PREFIX}*`);
    } catch (cacheErr) {
      console.error('Failed to invalidate overtime cache:', cacheErr);
    }

    return NextResponse.json(overtimeRequest, { status: 201 });
  } catch (error: any) {
    console.error('Error creating overtime request:', error);
    return NextResponse.json({ 
      error: 'Failed to create overtime request',
      details: error.message 
    }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, status, adminNotes } = body;

    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Only admins can review overtime.' }, { status: 403 });
    }

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and Status are required' }, { status: 400 });
    }

    const overtimeRequest = await prisma.overtimeRequest.update({
      where: { id },
      data: { 
        status, 
        adminNotes,
        updatedAt: new Date()
      },
    });

    // Invalidate overtime cache
    try {
      await cache.delByPattern(`${OVERTIME_CACHE_PREFIX}*`);
    } catch (cacheErr) {
      console.error('Failed to invalidate overtime cache:', cacheErr);
    }

    return NextResponse.json(overtimeRequest);
  } catch (error) {
    console.error('Error updating overtime request:', error);
    return NextResponse.json({ error: 'Failed to update overtime request' }, { status: 500 });
  }
}
