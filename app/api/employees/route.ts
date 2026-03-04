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
      payrollFrequency,
      managerId,
      hireDate,
      tin,
      sssNo,
      philhealthNo,
      pagibigNo,
      bankName,
      bankAccountNo,
    } = body;

    if (!fullName || !email || !position || !department || !basicSalary || !payrollFrequency || !hireDate) {
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

    const employeeData: any = {
      employeeNumber: nextNumber,
      fullName,
      email,
      employeeId: `EMP-${String(nextNumber).padStart(4, '0')}`,
      position,
      department,
      basicSalary: parseFloat(basicSalary),
      payrollFrequency,
      managerId: managerId || null,
      hireDate: new Date(hireDate),
      tin: tin || '',
      sssNo: sssNo || '',
      philhealthNo: philhealthNo || '',
      pagibigNo: pagibigNo || '',
      bankName: bankName || '',
      bankAccountNo: bankAccountNo || '',
      isActive: true,
    };

    // Only add userId if it's a valid non-empty string
    if (body.userId && typeof body.userId === 'string' && body.userId.trim() !== '') {
      employeeData.userId = body.userId;
    }

    const employee = await prisma.employee.create({
      data: employeeData,
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
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    // Explicitly pick allowed fields from body
    const updateData: any = {};
    const allowedFields = [
      'fullName', 'email', 'position', 'department', 'basicSalary', 
      'payrollFrequency', 'managerId', 'hireDate', 'tin', 'sssNo', 'philhealthNo', 
      'pagibigNo', 'bankName', 'bankAccountNo', 'isActive'
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    // Data type conversions
    if (updateData.basicSalary !== undefined) {
      const salary = parseFloat(String(updateData.basicSalary));
      if (isNaN(salary)) {
        return NextResponse.json({ error: 'Invalid basic salary' }, { status: 400 });
      }
      updateData.basicSalary = salary;
    }
    
    if (updateData.hireDate !== undefined && updateData.hireDate !== '') {
      const date = new Date(updateData.hireDate);
      if (isNaN(date.getTime())) {
        return NextResponse.json({ error: 'Invalid hire date' }, { status: 400 });
      }
      updateData.hireDate = date;
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      { message: 'Employee updated successfully', employee },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating employee:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Email already exists for another employee' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update employee', details: error.message },
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
