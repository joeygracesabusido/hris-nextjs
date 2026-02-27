import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      fullName,
      email,
      position,
      department,
      basicSalary,
      hireDate,
      tin,
      sssNo,
      philhealthNo,
      pagibigNo,
      bankName,
      bankAccountNo,
    } = body;

    if (!fullName || !email || !position || !department || !basicSalary || !hireDate) {
      return NextResponse.json(
        { error: 'Required fields are missing' },
        { status: 400 }
      );
    }

    const existingEmployee = await prisma.employee.findUnique({
      where: { email },
    });

    if (existingEmployee) {
      return NextResponse.json(
        { error: 'Employee with this email already exists' },
        { status: 400 }
      );
    }

    const lastEmployee = await prisma.employee.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const nextNumber = lastEmployee && lastEmployee.employeeNumber 
      ? lastEmployee.employeeNumber + 1 
      : 1;

    const employee = await prisma.employee.create({
      data: {
        employeeNumber: nextNumber,
        fullName,
        email,
        employeeId: `EMP-${String(nextNumber).padStart(4, '0')}`,
        position,
        department,
        basicSalary: parseFloat(basicSalary),
        hireDate: new Date(hireDate),
        tin: tin || '',
        sssNo: sssNo || '',
        philhealthNo: philhealthNo || '',
        pagibigNo: pagibigNo || '',
        bankName: bankName || '',
        bankAccountNo: bankAccountNo || '',
        isActive: true,
      },
    });

    return NextResponse.json(
      { message: 'Employee created successfully', employee },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json(
      { error: 'Failed to create employee', details: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    const updateData: any = { ...data };
    
    if (data.basicSalary) {
      updateData.basicSalary = parseFloat(data.basicSalary);
    }
    if (data.hireDate) {
      updateData.hireDate = new Date(data.hireDate);
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      { message: 'Employee updated successfully', employee },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    await prisma.employee.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: 'Employee deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json(
      { error: 'Failed to delete employee' },
      { status: 500 }
    );
  }
}
