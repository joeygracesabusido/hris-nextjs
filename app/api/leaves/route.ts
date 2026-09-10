import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { cache } from '@/lib/redis';
import { getUserWithEmployee } from '@/lib/user-employee-link';
import { hasAdminAccess } from '@/lib/auth-helpers';
import { PHILIPPINE_LEAVE_CODES, getLeaveTypeDef } from '@/lib/ph-standards';

const LEAVES_CACHE_PREFIX = 'leaves:';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with auto-linked employee
    const result = await getUserWithEmployee(userEmail);

    if (!result || !result.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { user, employee } = result;

    const cacheKey = `${LEAVES_CACHE_PREFIX}${user.role}:${user.email}`;
    try {
      const cachedLeaves = await cache.get(cacheKey);
      if (cachedLeaves) {
        return NextResponse.json(cachedLeaves);
      }
    } catch (cacheErr) {
      console.error('Failed to get from leaves cache:', cacheErr);
    }

    let leaves;
    // If admin role, return all leaves
    if (hasAdminAccess(user.role)) {
      leaves = await prisma.leaveRequest.findMany({
        include: { employee: true, approver: true },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      if (!employee) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
      }

      // EMPLOYEE role only sees their own leaves
      leaves = await prisma.leaveRequest.findMany({
        where: {
          employeeId: employee.id,
        },
        include: { employee: true, approver: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Cache for 10 minutes
    try {
      await cache.set(cacheKey, leaves, 600);
    } catch (cacheErr) {
      console.error('Failed to set leaves cache:', cacheErr);
    }

    return NextResponse.json(leaves);
  } catch (error) {
    console.error('Error fetching leaves:', error);
    return NextResponse.json({ error: 'Failed to fetch leaves' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { leaveType, startDate, endDate, reason, daysCount, employeeId: providedEmployeeId } = body;

    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with auto-linked employee
    const result = await getUserWithEmployee(userEmail);

    if (!result || !result.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { user, employee } = result;

    let targetEmployeeId: string;

    // If admin role provides an employeeId, use it. Otherwise use the currentUser's employee record.
    if (hasAdminAccess(user.role)) {
      targetEmployeeId = providedEmployeeId || employee?.id;
    } else {
      // EMPLOYEE role can only file leave for themselves
      if (!employee) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
      }
      targetEmployeeId = employee.id;
    }

    // Determine immediate supervisor (manager) of the target employee
    const targetEmployee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: { managerId: true },
    });

    // Validate against PH statutory leave types (DOLE / RA 11210 / RA 8187 / RA 11861 / RA 9262 / RA 9710)
    const normalizedType = String(leaveType || '').toUpperCase();
    if (!PHILIPPINE_LEAVE_CODES.includes(normalizedType as never)) {
      return NextResponse.json(
        { error: `Invalid leave type. Must be one of: ${PHILIPPINE_LEAVE_CODES.join(', ')}` },
        { status: 400 }
      );
    }

    const days = parseFloat(daysCount);
    if (!Number.isFinite(days) || days <= 0) {
      return NextResponse.json({ error: 'daysCount must be a positive number' }, { status: 400 });
    }

    const def = getLeaveTypeDef(normalizedType);
    if (def?.statutoryDays && days > def.statutoryDays) {
      return NextResponse.json(
        { error: `${def.label} exceeds statutory maximum of ${def.statutoryDays} days (${def.law})` },
        { status: 400 }
      );
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: targetEmployeeId,
        approverId: targetEmployee?.managerId, // Set to manager if exists
        leaveType: normalizedType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        daysCount: days,
        reason,
        status: 'PENDING',
      },
    });

    // Invalidate leaves cache
    try {
      await cache.delByPattern(`${LEAVES_CACHE_PREFIX}*`);
    } catch (cacheErr) {
      console.error('Failed to invalidate leaves cache:', cacheErr);
    }

    return NextResponse.json(leaveRequest, { status: 201 });
  } catch (error) {
    console.error('Error creating leave request:', error);
    return NextResponse.json({ error: 'Failed to create leave request' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, adminNotes } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and Status are required' }, { status: 400 });
    }

    // Get user with auto-linked employee
    const result = await getUserWithEmployee(userEmail);

    if (!result || !result.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { user } = result;

    // Fetch the leave request to check approver
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    // Only Admin can update the status
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Only admins can review leave requests.' }, { status: 403 });
    }

    const updatedLeaveRequest = await prisma.leaveRequest.update({
      where: { id },
      data: { 
        status, 
        adminNotes,
        updatedAt: new Date()
      },
    });

    // Invalidate leaves cache
    try {
      await cache.delByPattern(`${LEAVES_CACHE_PREFIX}*`);
    } catch (cacheErr) {
      console.error('Failed to invalidate leaves cache:', cacheErr);
    }

    return NextResponse.json(leaveRequest);
  } catch (error) {
    console.error('Error updating leave request:', error);
    return NextResponse.json({ error: 'Failed to update leave request' }, { status: 500 });
  }
}
