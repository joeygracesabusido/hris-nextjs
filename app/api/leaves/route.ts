import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    const userEmail = cookieStore.get('userEmail')?.value; // Assuming we set this on login

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { employees: true },
    });

    if (!currentUser || !currentUser.employees || currentUser.employees.length === 0) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    }

    const employee = currentUser.employees[0];

    let leaves;
    if (userRole === 'ADMIN') {
      leaves = await prisma.leaveRequest.findMany({
        include: { employee: true, approver: true },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Find leaves filed by this employee OR leaves where this employee is the manager (approver)
      leaves = await prisma.leaveRequest.findMany({
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
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
      }
      targetEmployeeId = currentUser.employees[0].id;
    }

    // Determine immediate supervisor (manager) of the target employee
    const targetEmployee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: { managerId: true },
    });

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: targetEmployeeId,
        approverId: targetEmployee?.managerId, // Set to manager if exists
        leaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        daysCount: parseFloat(daysCount),
        reason,
        status: 'PENDING',
      },
    });

    return NextResponse.json(leaveRequest, { status: 201 });
  } catch (error) {
    console.error('Error creating leave request:', error);
    return NextResponse.json({ error: 'Failed to create leave request' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, status, adminNotes } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and Status are required' }, { status: 400 });
    }

    const leaveRequest = await prisma.leaveRequest.update({
      where: { id },
      data: { 
        status, 
        adminNotes,
        updatedAt: new Date()
      },
    });

    return NextResponse.json(leaveRequest);
  } catch (error) {
    console.error('Error updating leave request:', error);
    return NextResponse.json({ error: 'Failed to update leave request' }, { status: 500 });
  }
}
