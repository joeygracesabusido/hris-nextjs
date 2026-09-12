import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { hasAdminAccess } from '@/lib/auth-helpers';
import { getEmployeeIdForUser } from '@/lib/user-employee-link';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value || '';
    const userEmail = cookieStore.get('userEmail')?.value || '';
    const isLoggedIn = cookieStore.get('isLoggedIn')?.value === 'true';

    if (!isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { employeeId, descriptor, photoUrl } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
      return NextResponse.json(
        { error: 'A valid 128-dimensional facial descriptor vector is required' },
        { status: 400 }
      );
    }

    // Role check: Admin/HR can register anyone; Employee can only register their own linked employee
    if (!hasAdminAccess(userRole)) {
      const linkedEmployeeId = await getEmployeeIdForUser(userEmail, userRole);
      if (linkedEmployeeId !== employeeId) {
        return NextResponse.json(
          { error: 'You are only authorized to register your own face profile' },
          { status: 403 }
        );
      }
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, fullName: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Upsert face profile
    const faceProfile = await prisma.employeeFace.upsert({
      where: { employeeId },
      update: {
        descriptor,
        photoUrl: photoUrl || null,
        updatedAt: new Date(),
      },
      create: {
        employeeId,
        descriptor,
        photoUrl: photoUrl || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Face profile enrolled successfully for ${employee.fullName}`,
      faceProfile: {
        id: faceProfile.id,
        employeeId: faceProfile.employeeId,
        registeredAt: faceProfile.registeredAt,
        hasPhoto: !!faceProfile.photoUrl,
      },
    });
  } catch (error) {
    console.error('Error registering face profile:', error);
    return NextResponse.json(
      { error: 'Failed to register face profile' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value || '';
    const userEmail = cookieStore.get('userEmail')?.value || '';
    const isLoggedIn = cookieStore.get('isLoggedIn')?.value === 'true';

    if (!isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    // Role check
    if (!hasAdminAccess(userRole)) {
      const linkedEmployeeId = await getEmployeeIdForUser(userEmail, userRole);
      if (linkedEmployeeId !== employeeId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    await prisma.employeeFace.deleteMany({
      where: { employeeId },
    });

    return NextResponse.json({
      success: true,
      message: 'Face profile removed successfully',
    });
  } catch (error) {
    console.error('Error removing face profile:', error);
    return NextResponse.json(
      { error: 'Failed to remove face profile' },
      { status: 500 }
    );
  }
}
