/**
 * Philippine Payroll Calculations Library
 * =========================================
 * This module contains all payroll computation functions based on
 * Philippine labor laws and statutory contribution rates (as of 2026).
 */

import { startOfDay, endOfDay } from 'date-fns';

// ============================================================================
// SSS CONTRIBUTION CALCULATIONS (2026)
// ============================================================================

const SSS_MSC_BRACKETS = [
  { min: 0, max: 5250, msc: 5000 },
  { min: 5250, max: 5750, msc: 5500 },
  { min: 5750, max: 6250, msc: 6000 },
  { min: 6250, max: 6750, msc: 6500 },
  { min: 6750, max: 7250, msc: 7000 },
  { min: 7250, max: 7750, msc: 7500 },
  { min: 7750, max: 8250, msc: 8000 },
  { min: 8250, max: 8750, msc: 8500 },
  { min: 8750, max: 9250, msc: 9000 },
  { min: 9250, max: 9750, msc: 9500 },
  { min: 9750, max: 10250, msc: 10000 },
  { min: 10250, max: 10750, msc: 10500 },
  { min: 10750, max: 11250, msc: 11000 },
  { min: 11250, max: 11750, msc: 11500 },
  { min: 11750, max: 12250, msc: 12000 },
  { min: 12250, max: 12750, msc: 12500 },
  { min: 12750, max: 13250, msc: 13000 },
  { min: 13250, max: 13750, msc: 13500 },
  { min: 13750, max: 14250, msc: 14000 },
  { min: 14250, max: 14750, msc: 14500 },
  { min: 14750, max: 15250, msc: 15000 },
  { min: 15250, max: 15750, msc: 15500 },
  { min: 15750, max: 16250, msc: 16000 },
  { min: 16250, max: 16750, msc: 16500 },
  { min: 16750, max: 17250, msc: 17000 },
  { min: 17250, max: 17750, msc: 17500 },
  { min: 17750, max: 18250, msc: 18000 },
  { min: 18250, max: 18750, msc: 18500 },
  { min: 18750, max: 19250, msc: 19000 },
  { min: 19250, max: 19750, msc: 19500 },
  { min: 19750, max: 20250, msc: 20000 },
  { min: 20250, max: 20750, msc: 20500 },
  { min: 20750, max: 21250, msc: 21000 },
  { min: 21250, max: 21750, msc: 21500 },
  { min: 21750, max: 22250, msc: 22000 },
  { min: 22250, max: 22750, msc: 22500 },
  { min: 22750, max: 23250, msc: 23000 },
  { min: 23250, max: 23750, msc: 23500 },
  { min: 23750, max: 24250, msc: 24000 },
  { min: 24250, max: 24750, msc: 24500 },
  { min: 24750, max: 25250, msc: 25000 },
  { min: 25250, max: 25750, msc: 25500 },
  { min: 25750, max: 26250, msc: 26000 },
  { min: 26250, max: 26750, msc: 26500 },
  { min: 26750, max: 27250, msc: 27000 },
  { min: 27250, max: 27750, msc: 27500 },
  { min: 27750, max: 28250, msc: 28000 },
  { min: 28250, max: 28750, msc: 28500 },
  { min: 28750, max: 29250, msc: 29000 },
  { min: 29250, max: 29750, msc: 29500 },
  { min: 29750, max: 30250, msc: 30000 },
  { min: 30250, max: 30750, msc: 30500 },
  { min: 30750, max: 31250, msc: 31000 },
  { min: 31250, max: 31750, msc: 31500 },
  { min: 31750, max: 32250, msc: 32000 },
  { min: 32250, max: 32750, msc: 32500 },
  { min: 32750, max: 33250, msc: 33000 },
  { min: 33250, max: 33750, msc: 33500 },
  { min: 33750, max: 34250, msc: 34000 },
  { min: 34250, max: 34750, msc: 34500 },
  { min: 34750, max: Infinity, msc: 35000 },
]

export function calculateSSS(monthlySalary: number): {
  msc: number
  employeeShare: number
  employerShare: number
  total: number
} {
  if (monthlySalary < 0) throw new Error('Monthly salary cannot be negative')
  const bracket = SSS_MSC_BRACKETS.find((b) => monthlySalary > b.min && monthlySalary <= b.max)
  const msc = bracket?.msc ?? (monthlySalary <= 5250 ? 5000 : 35000)
  const employeeShare = Math.round(msc * 0.05 * 100) / 100
  const employerShare = Math.round(msc * 0.10 * 100) / 100
  const total = Math.round(msc * 0.15 * 100) / 100
  return { msc, employeeShare, employerShare, total }
}

// ============================================================================
// PHILHEALTH CONTRIBUTION CALCULATIONS (2026)
// ============================================================================

export function calculatePhilHealth(monthlySalary: number): {
  baseSalary: number
  premium: number
  employeeShare: number
  employerShare: number
} {
  if (monthlySalary < 0) throw new Error('Monthly salary cannot be negative')
  const baseSalary = Math.max(10000, Math.min(100000, monthlySalary))
  const premium = Math.round(baseSalary * 0.05 * 100) / 100
  const employeeShare = Math.round(baseSalary * 0.025 * 100) / 100
  const employerShare = Math.round(baseSalary * 0.025 * 100) / 100
  return { baseSalary, premium, employeeShare, employerShare }
}

// ============================================================================
// PAG-IBIG CONTRIBUTION CALCULATIONS (2026)
// ============================================================================

export function calculatePagIBIG(monthlySalary: number): {
  baseSalary: number
  employeeShare: number
  employerShare: number
  total: number
} {
  if (monthlySalary < 0) throw new Error('Monthly salary cannot be negative')
  const baseSalary = Math.min(10000, monthlySalary)
  let employeeRate = monthlySalary <= 1500 ? 0.01 : 0.02
  let employerRate = 0.02
  const employeeShare = Math.min(200, Math.round(baseSalary * employeeRate * 100) / 100)
  const employerShare = Math.min(200, Math.round(baseSalary * employerRate * 100) / 100)
  const total = Math.round((employeeShare + employerShare) * 100) / 100
  return { baseSalary, employeeShare, employerShare, total }
}

// ============================================================================
// WITHHOLDING TAX CALCULATIONS (BIR 2026)
// ============================================================================

const TAX_TABLE_2026 = {
  MONTHLY: [
    { min: 0, max: 20833, baseTax: 0, percentage: 0, threshold: 0 },
    { min: 20833.01, max: 33333, baseTax: 0, percentage: 15, threshold: 20833 },
    { min: 33333.01, max: 66667, baseTax: 1875, percentage: 20, threshold: 33333 },
    { min: 66667.01, max: 166667, baseTax: 8541.67, percentage: 25, threshold: 66667 },
    { min: 166667.01, max: 666667, baseTax: 33541.67, percentage: 30, threshold: 166667 },
    { min: 666667.01, max: Infinity, baseTax: 183541.67, percentage: 35, threshold: 666667 },
  ]
};

export function calculateWithholdingTax(taxableIncome: number): number {
  if (taxableIncome < 0) return 0;
  const table = TAX_TABLE_2026.MONTHLY;
  const bracket = table.find(b => taxableIncome >= b.min && taxableIncome <= b.max) || table[table.length - 1];
  if (!bracket || bracket.percentage === 0) return 0;
  const excess = taxableIncome - bracket.threshold;
  const tax = bracket.baseTax + (excess * bracket.percentage / 100);
  return Math.round(tax * 100) / 100;
}

// ============================================================================
// PAYSLIP COMPUTATION
// ============================================================================

export interface EmployeePayrollData {
  id: string
  fullName: string
  position: string
  department: string
  payType: string // 'MONTHLY' or 'DAILY'
  basicSalary: number // Monthly fixed salary for MONTHLY type
  dailyRate: number   // Daily rate for DAILY type
  tin: string
  sssNo: string
  philhealthNo: string
  pagibigNo: string
}

export interface TimeLogPayrollData {
  date: Date
  workHours: number
  otHours: number
  lateMinutes: number
}

export interface PayslipComputation {
  employeeId: string
  employeeName: string
  position: string
  department: string
  month: number
  year: number
  
  // Earnings Breakdown
  payType: string
  baseAmount: number // Either basicSalary or DailyRate * daysWorked
  hourlyRate: number
  totalWorkHours: number
  totalOtHours: number
  otPay: number
  grossPay: number

  // Deductions
  sssEmployee: number
  philhealthEmployee: number
  pagibigEmployee: number
  withholdingTax: number
  totalDeductions: number
  netPay: number

  // Info
  daysWorked: number
}

/**
 * Main Payslip Computation Logic
 */
export function computePayslip(
  employee: EmployeePayrollData,
  timeLogs: TimeLogPayrollData[],
  month: number,
  year: number
): PayslipComputation {
  const daysWorked = timeLogs.filter(log => log.workHours > 0).length
  const totalOtHours = timeLogs.reduce((sum, log) => sum + log.otHours, 0)
  
  let baseAmount = 0
  let hourlyRate = 0

  if (employee.payType === 'DAILY') {
    // DAILY RATE Calculation
    baseAmount = employee.dailyRate * daysWorked
    hourlyRate = employee.dailyRate / 8
  } else {
    // MONTHLY FIXED Calculation
    baseAmount = employee.basicSalary
    hourlyRate = employee.basicSalary / 26 / 8 // Assuming 26 standard working days
  }

  const otPay = Math.round((hourlyRate * totalOtHours * 1.25) * 100) / 100
  const grossPay = Math.round((baseAmount + otPay) * 100) / 100

  // Calculate contributions based on Gross Pay (Simplified for PH standard)
  const sss = calculateSSS(baseAmount)
  const philhealth = calculatePhilHealth(baseAmount)
  const pagibig = calculatePagIBIG(baseAmount)
  
  const taxableIncome = grossPay - (sss.employeeShare + philhealth.employeeShare + pagibig.employeeShare)
  const tax = calculateWithholdingTax(taxableIncome)

  const totalDeductions = Math.round((sss.employeeShare + philhealth.employeeShare + pagibig.employeeShare + tax) * 100) / 100
  const netPay = Math.round((grossPay - totalDeductions) * 100) / 100

  return {
    employeeId: employee.id,
    employeeName: employee.fullName,
    position: employee.position,
    department: employee.department,
    month,
    year,
    payType: employee.payType,
    baseAmount,
    hourlyRate: Math.round(hourlyRate * 100) / 100,
    totalWorkHours: timeLogs.reduce((sum, log) => sum + log.workHours, 0),
    totalOtHours,
    otPay,
    grossPay,
    sssEmployee: sss.employeeShare,
    philhealthEmployee: philhealth.employeeShare,
    pagibigEmployee: pagibig.employeeShare,
    withholdingTax: tax,
    totalDeductions,
    netPay,
    daysWorked,
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
}
