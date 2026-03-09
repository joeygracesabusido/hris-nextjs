/**
 * Philippine Payroll Calculations Library
 * =========================================
 * This module contains all payroll computation functions based on
 * Philippine labor laws and statutory contribution rates (as of 2026).
 *
 * References:
 * - SSS: Social Security System contribution tables
 * - PhilHealth: Philippine Health Insurance Corporation
 * - Pag-IBIG: Home Development Mutual Fund (HDMF)
 * - DOLE: Department of Labor and Employment
 */

// ============================================================================
// SSS CONTRIBUTION CALCULATIONS (2026)
// ============================================================================

/**
 * SSS Monthly Salary Credit (MSC) Brackets for 2026
 *
 * The MSC is used to determine the contribution amount.
 * Employee contributes 5% of MSC, Employer contributes 10%.
 * Total contribution is 15% of MSC.
 *
 * MSC ranges from ₱5,000 to ₱35,000 in increments of ₱500.
 */
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
  { min: 34750, max: Infinity, msc: 35000 }, // Maximum MSC
]

/**
 * Calculate SSS contributions based on monthly basic salary
 *
 * @param monthlySalary - Employee's monthly basic salary in PHP
 * @returns Object containing MSC, employee share, employer share, and total
 *
 * Formula:
 * 1. Find the appropriate MSC bracket based on salary
 * 2. Employee share = MSC × 5% (rounded to 2 decimal places)
 * 3. Employer share = MSC × 10%
 * 4. Total = MSC × 15%
 *
 * Example: Salary ₱25,000
 * - MSC: ₱25,000 (falls in bracket ₱24,750 - ₱25,250)
 * - Employee: ₱1,250 (25,000 × 5%)
 * - Employer: ₱2,500 (25,000 × 10%)
 * - Total: ₱3,750
 */
export function calculateSSS(monthlySalary: number): {
  msc: number
  employeeShare: number
  employerShare: number
  total: number
} {
  // Validate input
  if (monthlySalary < 0) {
    throw new Error('Monthly salary cannot be negative')
  }

  // Find the appropriate MSC bracket
  // The bracket is determined by the salary range
  const bracket = SSS_MSC_BRACKETS.find(
    (b) => monthlySalary > b.min && monthlySalary <= b.max
  )

  // If salary is below minimum, use minimum MSC
  // If salary is above maximum, use maximum MSC
  const msc = bracket?.msc ?? (monthlySalary <= 5250 ? 5000 : 35000)

  // Calculate contributions
  const employeeShare = Math.round(msc * 0.05 * 100) / 100
  const employerShare = Math.round(msc * 0.10 * 100) / 100
  const total = Math.round(msc * 0.15 * 100) / 100

  return {
    msc,
    employeeShare,
    employerShare,
    total,
  }
}

// ============================================================================
// PHILHEALTH CONTRIBUTION CALCULATIONS (2026)
// ============================================================================

/**
 * Calculate PhilHealth contributions based on monthly basic salary
 *
 * @param monthlySalary - Employee's monthly basic salary in PHP
 * @returns Object containing premium, employee share, employer share
 *
 * Formula (2026):
 * - Total Premium: 5% of monthly basic salary
 * - Employee Share: 2.5% of monthly basic salary
 * - Employer Share: 2.5% of monthly basic salary
 *
 * Minimum and Maximum:
 * - Minimum base salary: ₱10,000
 *   → Minimum premium: ₱500 (Employee: ₱250, Employer: ₱250)
 * - Maximum base salary: ₱100,000
 *   → Maximum premium: ₱5,000 (Employee: ₱2,500, Employer: ₱2,500)
 *
 * Example: Salary ₱25,000
 * - Premium: ₱1,250 (25,000 × 5%)
 * - Employee: ₱625 (25,000 × 2.5%)
 * - Employer: ₱625 (25,000 × 2.5%)
 */
export function calculatePhilHealth(monthlySalary: number): {
  baseSalary: number
  premium: number
  employeeShare: number
  employerShare: number
} {
  // Validate input
  if (monthlySalary < 0) {
    throw new Error('Monthly salary cannot be negative')
  }

  // Apply minimum and maximum caps
  // Minimum base: ₱10,000, Maximum base: ₱100,000
  const baseSalary = Math.max(10000, Math.min(100000, monthlySalary))

  // Calculate contributions (5% total, split equally)
  const premium = Math.round(baseSalary * 0.05 * 100) / 100
  const employeeShare = Math.round(baseSalary * 0.025 * 100) / 100
  const employerShare = Math.round(baseSalary * 0.025 * 100) / 100

  return {
    baseSalary,
    premium,
    employeeShare,
    employerShare,
  }
}

// ============================================================================
// PAG-IBIG CONTRIBUTION CALCULATIONS (2026)
// ============================================================================

/**
 * Calculate Pag-IBIG (HDMF) contributions based on monthly compensation
 *
 * @param monthlySalary - Employee's monthly basic salary in PHP
 * @returns Object containing contribution amount for employee and employer
 *
 * Formula (2026):
 * - For salary ≤ ₱1,500: 1% employee, 2% employer
 * - For salary > ₱1,500: 2% employee, 2% employer
 *
 * Maximum Contribution:
 * - Employee: ₱200 (capped at base salary of ₱10,000)
 * - Employer: ₱200 (capped at base salary of ₱10,000)
 *
 * Example: Salary ₱25,000
 * - Employee: ₱200 (maximum cap, since 25,000 × 2% = ₱500 > ₱200)
 * - Employer: ₱200
 * - Total: ₱400
 */
export function calculatePagIBIG(monthlySalary: number): {
  baseSalary: number
  employeeShare: number
  employerShare: number
  total: number
} {
  // Validate input
  if (monthlySalary < 0) {
    throw new Error('Monthly salary cannot be negative')
  }

  // Apply maximum cap: contributions are based on max ₱10,000
  const baseSalary = Math.min(10000, monthlySalary)

  // Determine rate based on salary
  // Note: The lower rate for ≤₱1,500 is historical; most employees now use 2%
  let employeeRate: number
  let employerRate: number

  if (monthlySalary <= 1500) {
    employeeRate = 0.01 // 1% for salaries ≤ ₱1,500
    employerRate = 0.02 // 2% employer
  } else {
    employeeRate = 0.02 // 2% for salaries > ₱1,500
    employerRate = 0.02 // 2% employer
  }

  // Calculate contributions with cap at ₱200 each
  const employeeShare = Math.min(200, Math.round(baseSalary * employeeRate * 100) / 100)
  const employerShare = Math.min(200, Math.round(baseSalary * employerRate * 100) / 100)
  const total = Math.round((employeeShare + employerShare) * 100) / 100

  return {
    baseSalary,
    employeeShare,
    employerShare,
    total,
  }
}

// ============================================================================
// WITHHOLDING TAX CALCULATIONS (BIR 2026)
// ============================================================================

/**
 * BIR Withholding Tax Brackets for 2026 (Revised TRAIN Law)
 */
const TAX_TABLE_2026 = {
  MONTHLY: [
    { min: 0, max: 20833, baseTax: 0, percentage: 0, threshold: 0 },
    { min: 20833.01, max: 33333, baseTax: 0, percentage: 15, threshold: 20833 },
    { min: 33333.01, max: 66667, baseTax: 1875, percentage: 20, threshold: 33333 },
    { min: 66667.01, max: 166667, baseTax: 8541.67, percentage: 25, threshold: 66667 },
    { min: 166667.01, max: 666667, baseTax: 33541.67, percentage: 30, threshold: 166667 },
    { min: 666667.01, max: Infinity, baseTax: 183541.67, percentage: 35, threshold: 666667 },
  ],
  SEMIMONTHLY: [
    { min: 0, max: 10417, baseTax: 0, percentage: 0, threshold: 0 },
    { min: 10417.01, max: 16667, baseTax: 0, percentage: 15, threshold: 10417 },
    { min: 16666.01, max: 33333, baseTax: 937.50, percentage: 20, threshold: 16667 },
    { min: 33333.01, max: 83333, baseTax: 4270.83, percentage: 25, threshold: 33333 },
    { min: 83333.01, max: 333333, baseTax: 16770.83, percentage: 30, threshold: 83333 },
    { min: 333333.01, max: Infinity, baseTax: 91770.83, percentage: 35, threshold: 333333 },
  ]
};

/**
 * Calculate withholding tax based on taxable income and pay frequency
 * 
 * @param taxableIncome - Gross pay minus non-taxable contributions (SSS, PhilHealth, Pag-IBIG)
 * @param frequency - Pay frequency (MONTHLY, SEMIMONTHLY)
 * @returns Withholding tax amount in PHP
 */
export function calculateWithholdingTax(taxableIncome: number, frequency: string = 'MONTHLY'): number {
  if (taxableIncome < 0) return 0;

  const table = frequency === 'SEMIMONTHLY' ? TAX_TABLE_2026.SEMIMONTHLY : TAX_TABLE_2026.MONTHLY;
  
  const bracket = table.find(b => taxableIncome >= b.min && taxableIncome <= b.max) 
               || table[table.length - 1];

  if (!bracket || bracket.percentage === 0) return 0;

  const excess = taxableIncome - bracket.threshold;
  const tax = bracket.baseTax + (excess * bracket.percentage / 100);
  
  return Math.round(tax * 100) / 100;
}

// ============================================================================
// OVERTIME PAY CALCULATIONS
// ============================================================================

/**
 * Calculate hourly rate from monthly basic salary
 *
 * @param monthlySalary - Employee's monthly basic salary in PHP
 * @param workingDaysPerMonth - Number of working days per month (default: 26)
 * @param hoursPerDay - Number of working hours per day (default: 8)
 * @returns Hourly rate in PHP
 *
 * Formula:
 * - Daily Rate = Monthly Salary ÷ Working Days per Month
 * - Hourly Rate = Daily Rate ÷ Hours per Day
 *
 * Assumptions:
 * - 5-day workweek = ~26 working days per month (excluding weekends)
 * - 8 hours standard workday
 *
 * Example: Salary ₱25,000
 * - Daily Rate: ₱961.54 (25,000 ÷ 26)
 * - Hourly Rate: ₱120.19 (961.54 ÷ 8)
 */
export function calculateHourlyRate(
  monthlySalary: number,
  workingDaysPerMonth: number = 26,
  hoursPerDay: number = 8
): number {
  if (monthlySalary < 0) {
    throw new Error('Monthly salary cannot be negative')
  }
  if (workingDaysPerMonth <= 0 || hoursPerDay <= 0) {
    throw new Error('Working days and hours must be positive')
  }

  const dailyRate = monthlySalary / workingDaysPerMonth
  const hourlyRate = dailyRate / hoursPerDay
  return Math.round(hourlyRate * 100) / 100
}

/**
 * Overtime pay rates based on Philippine Labor Code
 *
 * Reference: DOLE Department Order No. 174-17
 *
 * Rates:
 * - ORDINARY_DAY: 125% for work beyond 8 hours on a regular workday
 * - REST_DAY: 130% for work on rest day or special day
 * - REST_DAY_OT: 169% for overtime on rest day/special day
 * - HOLIDAY_REGULAR: 200% for work on a regular holiday
 * - HOLIDAY_REGULAR_OT: 260% for overtime on a regular holiday
 * - HOLIDAY_SPECIAL: 130% for work on a special non-working holiday
 * - HOLIDAY_SPECIAL_OT: 169% for overtime on a special holiday
 * - NIGHT_SHIFT: Additional 10% for night shift work
 */
export const OVERTIME_RATES = {
  ORDINARY_DAY: 1.25,        // 125% (25% OT premium + 100% basic)
  REST_DAY: 1.30,            // 130%
  REST_DAY_OT: 1.69,         // 169%
  HOLIDAY_REGULAR: 2.00,     // 200%
  HOLIDAY_REGULAR_OT: 2.60,  // 260%
  HOLIDAY_SPECIAL: 1.30,     // 130%
  HOLIDAY_SPECIAL_OT: 1.69,  // 169%
  NIGHT_SHIFT_ADDON: 0.10,   // Additional 10% for night shift
} as const

/**
 * Calculate overtime pay for a given number of hours
 *
 * @param hourlyRate - Employee's hourly rate in PHP
 * @param otHours - Number of overtime hours
 * @param rateType - Type of overtime rate to apply
 * @returns Overtime pay amount in PHP
 *
 * Formula:
 * OT Pay = Hourly Rate × OT Hours × Rate Multiplier
 *
 * Example: ₱120.19/hour, 5 OT hours, ordinary day
 * OT Pay = 120.19 × 5 × 1.25 = ₱751.19
 */
export function calculateOvertimePay(
  hourlyRate: number,
  otHours: number,
  rateType: keyof typeof OVERTIME_RATES = 'ORDINARY_DAY'
): number {
  if (hourlyRate < 0 || otHours < 0) {
    throw new Error('Hourly rate and OT hours cannot be negative')
  }

  const rate = OVERTIME_RATES[rateType]
  const otPay = hourlyRate * otHours * rate
  return Math.round(otPay * 100) / 100
}

// ============================================================================
// WORK HOURS CALCULATIONS
// ============================================================================

/**
 * Standard work schedule
 */
export const WORK_SCHEDULE = {
  STANDARD_WORK_HOURS: 8,
  GRACE_PERIOD_MINUTES: 15, // Grace period for late arrivals
  WORK_START_HOUR: 9,       // 9:00 AM standard work start
  WORK_END_HOUR: 18,        // 6:00 PM standard work end
} as const

/**
 * Calculate work hours, late minutes, and overtime from time logs
 *
 * @param clockIn - Clock-in timestamp
 * @param clockOut - Clock-out timestamp (null if not yet clocked out)
 * @param workDate - The date of work (to determine expected work start)
 * @returns Object containing work hours, OT hours, late minutes, undertime
 *
 * Calculations:
 * 1. Work Hours = (Clock Out - Clock In) in hours
 * 2. Regular Hours = min(8, Work Hours)
 * 3. OT Hours = max(0, Work Hours - 8)
 * 4. Late Minutes = minutes after 9:15 AM grace period
 * 5. Undertime Minutes = minutes before 6:00 PM if clocked out early
 */
export function calculateWorkHours(
  clockIn: Date,
  clockOut: Date | null,
  workDate: Date
): {
  workHours: number
  regularHours: number
  otHours: number
  lateMinutes: number
  undertimeMinutes: number
} {
  if (!clockOut) {
    return {
      workHours: 0,
      regularHours: 0,
      otHours: 0,
      lateMinutes: 0,
      undertimeMinutes: 0,
    }
  }

  // Calculate total work hours
  const diffMs = clockOut.getTime() - clockIn.getTime()
  const workHours = Math.max(0, diffMs / (1000 * 60 * 60))

  // Regular hours capped at 8, overtime is the excess
  const regularHours = Math.min(8, workHours)
  const otHours = Math.max(0, workHours - 8)

  // Calculate late minutes
  // Expected work start: 9:00 AM, grace period: 15 minutes
  const expectedStart = new Date(workDate)
  expectedStart.setHours(WORK_SCHEDULE.WORK_START_HOUR, 0, 0, 0)
  const gracePeriodEnd = new Date(expectedStart)
  gracePeriodEnd.setMinutes(gracePeriodEnd.getMinutes() + WORK_SCHEDULE.GRACE_PERIOD_MINUTES)

  let lateMinutes = 0
  if (clockIn > gracePeriodEnd) {
    lateMinutes = Math.round((clockIn.getTime() - expectedStart.getTime()) / (1000 * 60))
  }

  // Calculate undertime minutes
  // Expected work end: 6:00 PM (18:00)
  const expectedEnd = new Date(workDate)
  expectedEnd.setHours(WORK_SCHEDULE.WORK_END_HOUR, 0, 0, 0)

  let undertimeMinutes = 0
  if (clockOut < expectedEnd) {
    undertimeMinutes = Math.round((expectedEnd.getTime() - clockOut.getTime()) / (1000 * 60))
  }

  return {
    workHours: Math.round(workHours * 100) / 100,
    regularHours: Math.round(regularHours * 100) / 100,
    otHours: Math.round(otHours * 100) / 100,
    lateMinutes,
    undertimeMinutes,
  }
}

// ============================================================================
// PAYSLIP COMPUTATION
// ============================================================================

/**
 * Employee data for payroll computation
 */
export interface EmployeePayrollData {
  id: string
  fullName: string
  position: string
  department: string
  basicSalary: number
  tin: string
  sssNo: string
  philhealthNo: string
  pagibigNo: string
}

/**
 * Time log data for payroll computation
 */
export interface TimeLogPayrollData {
  date: Date
  workHours: number
  otHours: number
  lateMinutes: number
  undertimeMinutes: number
}

/**
 * Complete payslip computation result
 */
export interface PayslipComputation {
  // Employee Info
  employeeId: string
  employeeName: string
  position: string
  department: string

  // Payroll Period
  month: number
  year: number
  periodStart: Date
  periodEnd: Date

  // Earnings
  basicSalary: number
  hourlyRate: number
  totalWorkHours: number
  totalOtHours: number
  otPay: number
  grossPay: number

  // Government Contributions (Employee Share)
  sssEmployee: number
  philhealthEmployee: number
  pagibigEmployee: number
  totalContributions: number

  // Government Contributions (Employer Share - for reference)
  sssEmployer: number
  philhealthEmployer: number
  pagibigEmployer: number

  // Deductions & Net Pay
  otherDeductions: number
  totalDeductions: number
  netPay: number

  // Working Days Info
  workingDaysInMonth: number
  daysWorked: number
}

/**
 * Compute complete payslip for an employee
 *
 * @param employee - Employee data
 * @param timeLogs - Array of time logs for the month
 * @param month - Month (1-12)
 * @param year - Year (e.g., 2026)
 * @returns Complete payslip computation
 */
export function computePayslip(
  employee: EmployeePayrollData,
  timeLogs: TimeLogPayrollData[],
  month: number,
  year: number
): PayslipComputation {
  // Validate inputs
  if (month < 1 || month > 12) {
    throw new Error('Month must be between 1 and 12')
  }
  if (year < 2000 || year > 2100) {
    throw new Error('Year must be between 2000 and 2100')
  }

  // Calculate payroll period dates
  const periodStart = new Date(year, month - 1, 1)
  const periodEnd = new Date(year, month, 0) // Last day of month

  // Calculate working days in month (excluding weekends)
  const workingDaysInMonth = getWorkingDaysInMonth(year, month)

  // Sum up time logs
  const totalWorkHours = timeLogs.reduce((sum, log) => sum + log.workHours, 0)
  const totalOtHours = timeLogs.reduce((sum, log) => sum + log.otHours, 0)
  const daysWorked = timeLogs.filter(log => log.workHours > 0).length

  // Calculate hourly rate
  const hourlyRate = calculateHourlyRate(employee.basicSalary)

  // Calculate overtime pay (ordinary day rate: 125%)
  const otPay = calculateOvertimePay(hourlyRate, totalOtHours, 'ORDINARY_DAY')

  // Calculate gross pay
  const grossPay = Math.round((employee.basicSalary + otPay) * 100) / 100

  // Calculate government contributions
  const sss = calculateSSS(employee.basicSalary)
  const philhealth = calculatePhilHealth(employee.basicSalary)
  const pagibig = calculatePagIBIG(employee.basicSalary)

  // Total employee contributions (deducted from salary)
  const totalContributions = Math.round(
    (sss.employeeShare + philhealth.employeeShare + pagibig.employeeShare) * 100
  ) / 100

  // Other deductions (placeholder - can be expanded)
  const otherDeductions = 0

  // Total deductions
  const totalDeductions = Math.round((totalContributions + otherDeductions) * 100) / 100

  // Net pay
  const netPay = Math.round((grossPay - totalDeductions) * 100) / 100

  return {
    employeeId: employee.id,
    employeeName: employee.fullName,
    position: employee.position,
    department: employee.department,
    month,
    year,
    periodStart,
    periodEnd,
    basicSalary: employee.basicSalary,
    hourlyRate,
    totalWorkHours: Math.round(totalWorkHours * 100) / 100,
    totalOtHours: Math.round(totalOtHours * 100) / 100,
    otPay,
    grossPay,
    sssEmployee: sss.employeeShare,
    philhealthEmployee: philhealth.employeeShare,
    pagibigEmployee: pagibig.employeeShare,
    totalContributions,
    sssEmployer: sss.employerShare,
    philhealthEmployer: philhealth.employerShare,
    pagibigEmployer: pagibig.employerShare,
    otherDeductions,
    totalDeductions,
    netPay,
    workingDaysInMonth,
    daysWorked,
  }
}

/**
 * Get the number of working days (Monday-Friday) in a given month
 *
 * @param year - Year (e.g., 2026)
 * @param month - Month (1-12)
 * @returns Number of working days
 */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  let workingDays = 0

  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay()
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++
    }
  }

  return workingDays
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format currency in Philippine Peso
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format date in Philippine locale
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

/**
 * Format date range
 */
export function formatDateRange(start: Date, end: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
  return `${start.toLocaleDateString('en-PH', options)} - ${end.toLocaleDateString('en-PH', options)}`
}

/**
 * Get month name from number
 */
export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[month - 1] || ''
}

/**
 * Validate Philippine TIN format (xxx-xxx-xxx)
 */
export function isValidTIN(tin: string): boolean {
  const tinRegex = /^\d{3}-?\d{3}-?\d{3}$/
  return tinRegex.test(tin.replace(/\s/g, ''))
}

/**
 * Validate SSS Number format (xx-xxxxxxx-x)
 */
export function isValidSSS(sss: string): boolean {
  const sssRegex = /^\d{2}-?\d{7}-?\d$/
  return sssRegex.test(sss.replace(/\s/g, ''))
}

/**
 * Validate PhilHealth Number format (xx-xxxxxxxxx-x)
 */
export function isValidPhilHealth(philhealth: string): boolean {
  const philhealthRegex = /^\d{2}-?\d{9}-?\d$/
  return philhealthRegex.test(philhealth.replace(/\s/g, ''))
}

/**
 * Validate Pag-IBIG Number format (xxxx-xxxx-xxxx)
 */
export function isValidPagIBIG(pagibig: string): boolean {
  const pagibigRegex = /^\d{4}-?\d{4}-?\d{4}$/
  return pagibigRegex.test(pagibig.replace(/\s/g, ''))
}