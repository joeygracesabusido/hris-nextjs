import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[Shifts API] Starting GET request...');
    
    // The prisma client in lib/prisma.ts now self-heals if models are missing
    const shifts = await prisma.shift.findMany();
    console.log(`[Shifts API] Successfully fetched ${shifts.length} shifts`);
    
    return NextResponse.json(shifts);
  } catch (error: any) {
    console.error('[Shifts API] CRITICAL ERROR:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch shifts', 
      details: error.message,
      code: error.code
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, startTime, endTime, color, isOff } = body;

    if (!name || !startTime || !endTime) {
      return NextResponse.json({ error: 'Name, startTime, and endTime are required' }, { status: 400 });
    }

    const shift = await prisma.shift.create({
      data: {
        name,
        startTime,
        endTime,
        color: color || 'bg-blue-100 border-blue-500 text-blue-700',
        isOff: isOff || false,
      },
    });

    return NextResponse.json(shift);
  } catch (error: any) {
    console.error('[Shifts API] POST Error:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A shift with this name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create shift', details: error.message }, { status: 500 });
  }
}
