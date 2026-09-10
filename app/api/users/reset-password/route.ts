import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let suffix = '';
  for (let i = 0; i < 10; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `Ije-${suffix}`;
}

/**
 * POST /api/users/reset-password
 * Admin/HR resets a user's password. Body: { userId, newPassword? }
 * If newPassword is omitted, a temporary password is generated and
 * returned once — the admin relays it to the employee out-of-band.
 * HR cannot reset passwords of ADMIN accounts.
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const callerRole = cookieStore.get('userRole')?.value;

    if (!callerRole || !['ADMIN', 'HR'].includes(callerRole)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin or HR access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, newPassword } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (target.role === 'ADMIN' && callerRole !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can reset another admin password' },
        { status: 403 }
      );
    }

    let plainPassword = typeof newPassword === 'string' ? newPassword.trim() : '';
    const generated = !plainPassword;
    if (generated) {
      plainPassword = generateTempPassword();
    }

    if (plainPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        failedAttempts: 0,
        lockUntil: null,
      },
    });

    return NextResponse.json({
      message: `Password reset for ${target.email}`,
      tempPassword: plainPassword,
      generated,
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
