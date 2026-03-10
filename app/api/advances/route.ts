import { NextResponse } from 'next/server';
import { PrismaClient } from "@prisma/client";
import { cookies } from 'next/headers';
import { cache } from '@/lib/redis';

// Use a fresh client if the singleton is stale
const localPrisma = new PrismaClient();
const ADVANCES_CACHE_PREFIX = 'advances:';

// Helper to get the model safely
function getAdvanceModel(p: unknown) {
  return p.advance || p.Advance || p.advances;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const advanceId = searchParams.get('id');

    const advanceModel = getAdvanceModel(localPrisma);
    if (!advanceModel) throw new Error('Advance model not found in Prisma client');

    if (advanceId) {
      const advance = await advanceModel.findUnique({
        where: { id: advanceId },
        include: { 
          employee: true,
          payments: {
            orderBy: { paymentDate: 'desc' },
            include: { payroll: true }
          }
        },
      });
      return NextResponse.json(advance);
    }

    const cacheKey = `${ADVANCES_CACHE_PREFIX}${employeeId || 'all'}`;
    try {
      const cachedData = await cache.get(cacheKey);
      if (cachedData) return NextResponse.json(cachedData);
    } catch (err) {
      console.error('Redis GET error:', err);
    }

    const where: Record<string, string> = {};
    if (employeeId) where.employeeId = employeeId;

    const advances = await advanceModel.findMany({
      where,
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
    });

    try {
      await cache.set(cacheKey, advances, 1800); // Cache for 30 mins
    } catch (err) {
      console.error('Redis SET error:', err);
    }

    return NextResponse.json(advances);
  } catch (error: unknown) {
    console.error('Error fetching advances:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to fetch advances', details: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('POST /api/advances - Request body:', body);
    
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { employeeId, type, totalAmount, deductionAmount } = body;

    if (!employeeId || !type || !totalAmount || !deductionAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const advanceModel = getAdvanceModel(localPrisma);
    if (!advanceModel) throw new Error('Advance model not found in Prisma client at runtime');

    const advance = await advanceModel.create({
      data: {
        employeeId,
        type,
        totalAmount: parseFloat(totalAmount),
        remainingBalance: parseFloat(totalAmount),
        deductionAmount: parseFloat(deductionAmount),
        status: 'ACTIVE',
      },
    });

    // Invalidate cache
    try {
      await cache.delByPattern(`${ADVANCES_CACHE_PREFIX}*`);
    } catch (err) {
      console.error('Redis DEL error:', err);
    }

    return NextResponse.json(advance, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating advance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: 'Failed to create advance',
      details: errorMessage
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await localPrisma.advance.delete({
      where: { id },
    });

    // Invalidate cache
    try {
      await cache.delByPattern(`${ADVANCES_CACHE_PREFIX}*`);
    } catch (err) {
      console.error('Redis DEL error:', err);
    }

    return NextResponse.json({ message: 'Advance deleted successfully' });
  } catch (error) {
    console.error('Error deleting advance:', error);
    return NextResponse.json({ error: 'Failed to delete advance' }, { status: 500 });
  }
}
