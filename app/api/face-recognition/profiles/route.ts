import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get('isLoggedIn')?.value === 'true';

    if (!isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const faceProfiles = await prisma.employeeFace.findMany({
      where: {
        employee: {
          isActive: true,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
            employeeId: true,
            department: true,
            position: true,
          },
        },
      },
    });

    const formatted = faceProfiles.map((fp) => ({
      id: fp.id,
      employeeId: fp.employeeId,
      fullName: fp.employee.fullName,
      employeeNumber: fp.employee.employeeNumber,
      employeeCode: fp.employee.employeeId,
      department: fp.employee.department,
      position: fp.employee.position,
      photoUrl: fp.photoUrl,
      descriptor: fp.descriptor,
      registeredAt: fp.registeredAt,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching face profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enrolled face profiles' },
      { status: 500 }
    );
  }
}
