/**
 * TypeScript Type Definitions
 * ============================
 * Shared types used across the HRIS application
 */

import { Role, PayrollStatus } from '@prisma/client'

// ============================================================================
// User & Authentication Types
// ============================================================================

export interface UserSession {
  id: string
  email: string
  name: string | null
  role: Role
  image?: string | null
  employeeId?: string | null
}

// ============================================================================
// Employee Types
// ============================================================================

export interface EmployeeFormData {
  fullName: string
  email: string
  employeeId: string
  position: string
  department: string
  basicSalary: number
  hireDate: string // ISO date string for form handling
  tin: string
  sssNo: string
  philhealthNo: string
  pagibigNo: string
  bankName?: string
  bankAccountNo?: string
}

export interface EmployeeWithUser {
  id: string
  userId: string | null
  fullName: string
  email: string
  employeeId: string
  position: string
  department: string
  basicSalary: number
  hireDate: Date
  endDate: Date | null
  isActive: boolean
  tin: string
  sssNo: string
  philhealthNo: string
  pagibigNo: string
  bankName: string | null
  bankAccountNo: string | null
  createdAt: Date
  updatedAt: Date
  user?: {
    id: string
    email: string
    name: string | null
    role: Role
  } | null
}

// ============================================================================
// Time Log Types
// ============================================================================

export interface TimeLogFormData {
  employeeId: string
  date: string // ISO date string
  clockIn: string // Time string (HH:mm)
  clockOut: string // Time string (HH:mm)
  notes?: string
}

export interface TimeLogWithEmployee {
  id: string
  employeeId: string
  date: Date
  clockIn: Date | null
  clockOut: Date | null
  workHours: number
  otHours: number
  lateMinutes: number
  undertimeMinutes: number
  notes: string | null
  isEdited: boolean
  editedBy: string | null
  editReason: string | null
  createdAt: Date
  updatedAt: Date
  employee: {
    id: string
    fullName: string
    employeeId: string
    department: string
    position: string
  }
}

// ============================================================================
// Payroll Types
// ============================================================================

export interface PayrollFormData {
  employeeId: string
  month: number
  year: number
}

export interface PayrollWithEmployee {
  id: string
  employeeId: string
  month: number
  year: number
  periodStart: Date
  periodEnd: Date
  basicSalary: number
  workDays: number
  daysWorked: number
  otHours: number
  otPay: number
  grossPay: number
  sssEmployee: number
  sssEmployer: number
  philhealthEmployee: number
  philhealthEmployer: number
  pagibigEmployee: number
  pagibigEmployer: number
  withholdingTax: number
  otherDeductions: number
  totalDeductions: number
  netPay: number
  status: PayrollStatus
  createdAt: Date
  updatedAt: Date
  processedAt: Date | null
  approvedBy: string | null
  approvedAt: Date | null
  employee: {
    id: string
    fullName: string
    employeeId: string
    department: string
    position: string
    tin: string
    sssNo: string
    philhealthNo: string
    pagibigNo: string
  }
}

// ============================================================================
// Dashboard Statistics Types
// ============================================================================

export interface DashboardStats {
  totalEmployees: number
  activeEmployees: number
  totalDepartments: number
  pendingPayrolls: number
  currentMonthPayroll: number
  averageSalary: number
}

export interface EmployeeDashboardData {
  employee: {
    id: string
    fullName: string
    employeeId: string
    position: string
    department: string
    basicSalary: number
  }
  recentTimeLogs: TimeLogWithEmployee[]
  recentPayrolls: PayrollWithEmployee[]
  monthStats: {
    workHours: number
    otHours: number
    daysPresent: number
    daysLate: number
  }
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}