import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cache } from '@/lib/redis';

const EMPLOYEES_CACHE_KEY = 'employees:all';

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      fullName, email, position, department, basicSalary, dailyRate, payType,
      payrollFrequency, managerId, hireDate, tin, sssNo, philhealthNo, pagibigNo, bankName, bankAccountNo,
    } = body;

    const maxEmployee = await prisma.employee.findFirst({ 
      orderBy: { employeeNumber: 'desc' },
      where: { NOT: { employeeNumber: null } }
    });
    
    const nextNumber = (maxEmployee?.employeeNumber || 0) + 1;
    const employeeId = `EMP-${String(nextNumber).padStart(4, '0')}`;

    const employee = await prisma.employee.create({
      data: {
        employeeNumber: nextNumber,
        fullName, email,
        employeeId,
        position, department,
        payType: payType || 'MONTHLY',
        basicSalary: parseFloat(basicSalary || '0'),
        dailyRate: parseFloat(dailyRate || '0'),
        payrollFrequency,
        managerId: managerId || null,
        hireDate: new Date(hireDate),
        tin: tin || '', sssNo: sssNo || '', philhealthNo: philhealthNo || '', pagibigNo: pagibigNo || '',
        bankName: bankName || '', bankAccountNo: bankAccountNo || '',
        isActive: true,
      },
    });

    await cache.del(EMPLOYEES_CACHE_KEY);
    return NextResponse.json({ message: 'Employee created successfully', employee }, { status: 201 });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'Failed to create employee', details: String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });

    const updateData: any = {};
    const allowedFields = [
      'fullName', 'email', 'position', 'department', 'basicSalary', 'dailyRate', 'payType',
      'payrollFrequency', 'managerId', 'hireDate', 'tin', 'sssNo', 'philhealthNo', 
      'pagibigNo', 'bankName', 'bankAccountNo', 'isActive'
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        if (field === 'basicSalary' || field === 'dailyRate') {
          updateData[field] = parseFloat(String(body[field]));
        } else if (field === 'hireDate') {
          updateData[field] = new Date(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    });

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
    });

    await cache.del(EMPLOYEES_CACHE_KEY);
    return NextResponse.json({ message: 'Employee updated successfully', employee }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: 'Failed to update employee', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    await prisma.employee.delete({ where: { id } });
    await cache.del(EMPLOYEES_CACHE_KEY);
    return NextResponse.json({ message: 'Employee deleted successfully' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}
