import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ONE_DAY = 60 * 60 * 24

/**
 * POST /api/auth/google-sync
 * Bridges a NextAuth Google session to this app's cookie auth
 * (isLoggedIn / userId / userRole / userEmail / userName).
 * Enforces the same approval rules as password login.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No Google session found' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
    })

    if (!user) {
      return NextResponse.json({ error: 'User record not found' }, { status: 404 })
    }

    if (user.status === 'FOR_APPROVAL') {
      return NextResponse.json(
        { error: 'Your account is pending approval. Please contact the administrator.' },
        { status: 403 }
      )
    }

    if (user.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Your account has been rejected. Please contact the administrator.' },
        { status: 403 }
      )
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockUntil: null },
    })

    const response = NextResponse.json({
      message: 'Google login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    })

    response.cookies.set('isLoggedIn', 'true', { path: '/', maxAge: ONE_DAY })
    response.cookies.set('userId', user.id, { path: '/', maxAge: ONE_DAY })
    response.cookies.set('userRole', user.role, { path: '/', maxAge: ONE_DAY })
    response.cookies.set('userEmail', user.email, { path: '/', maxAge: ONE_DAY })
    response.cookies.set('userName', encodeURIComponent(user.name || ''), {
      path: '/',
      maxAge: ONE_DAY,
    })

    return response
  } catch (error) {
    console.error('Google sync error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
