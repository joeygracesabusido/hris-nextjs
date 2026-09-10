/**
 * Philippine HRIS & Payroll Standards (DOLE / BIR / SSS / PhilHealth / Pag-IBIG)
 * =============================================================================
 * Single source of truth for statutory leave types, overtime, holiday,
 * night differential, de minimis, and 13th-month rules.
 *
 * References:
 * - Labor Code of the Philippines (Art. 86-95), DOLE Handbook on Workers' Statutory Monetary Benefits
 * - TRAIN Law (RA 10963) withholding tax tables, BIR RR 11-2018 Annex E
 * - SSS RA 11199 + Circular 2024-006, PhilHealth UHC RA 11223, Pag-IBIG Circular 460
 * - 13th Month Pay PD 851 (tax-exempt ceiling P90,000 combined with bonuses)
 */

export type LeaveTypeCode =
  | 'SIL'
  | 'VACATION'
  | 'SICK'
  | 'EMERGENCY'
  | 'MATERNITY'
  | 'PATERNITY'
  | 'SOLO_PARENT'
  | 'VAWC'
  | 'MAGNA_CARTA'
  | 'GYNE'
  | 'SERVICE'
  | 'UNPAID'
  | 'OTHER';

export interface LeaveTypeDef {
  code: LeaveTypeCode;
  label: string;
  statutoryDays: number | null; // null = company policy / variable
  paid: boolean;
  law: string;
  description: string;
  requiresCredit: boolean;
}

export const PHILIPPINE_LEAVE_TYPES: LeaveTypeDef[] = [
  { code: 'SIL', label: 'Service Incentive Leave', statutoryDays: 5, paid: true, law: 'Labor Code Art. 95', description: 'Minimum 5 paid leaves after 1 year of service. Convertible to cash if unused.', requiresCredit: true },
  { code: 'VACATION', label: 'Vacation Leave', statutoryDays: null, paid: true, law: 'Company policy (min. includes SIL)', description: 'Company-granted vacation. Standard PH practice: 15 days/yr for regulars.', requiresCredit: true },
  { code: 'SICK', label: 'Sick Leave', statutoryDays: null, paid: true, law: 'Company policy', description: 'Company-granted sick leave. Standard PH practice: 15 days/yr for regulars.', requiresCredit: true },
  { code: 'EMERGENCY', label: 'Emergency Leave', statutoryDays: null, paid: true, law: 'Company policy', description: 'Urgent / calamity leave, usually charged against VL/SL.', requiresCredit: true },
  { code: 'MATERNITY', label: 'Maternity Leave (105 days)', statutoryDays: 105, paid: true, law: 'RA 11210 (105-Day Expanded Maternity)', description: '105 days paid (SSS + employer top-up), +15 solo parent, +30 for solo per RA 11861 amendments context.', requiresCredit: false },
  { code: 'PATERNITY', label: 'Paternity Leave (7 days)', statutoryDays: 7, paid: true, law: 'RA 8187', description: '7 days paid for married male employees for first 4 deliveries.', requiresCredit: false },
  { code: 'SOLO_PARENT', label: 'Solo Parent Leave (7 days)', statutoryDays: 7, paid: true, law: 'RA 11861 Expanded Solo Parents', description: '7 working days for qualified solo parents with 1 year service.', requiresCredit: false },
  { code: 'VAWC', label: 'VAWC Leave (10 days)', statutoryDays: 10, paid: true, law: 'RA 9262', description: '10 days paid for women victims of violence, with protection order / certification.', requiresCredit: false },
  { code: 'MAGNA_CARTA', label: 'Magna Carta / Gyne Leave (60 days)', statutoryDays: 60, paid: true, law: 'RA 9710 Magna Carta of Women', description: 'Up to 60 days paid for gynecological surgery with 6 months service.', requiresCredit: false },
  { code: 'GYNE', label: 'Gynecological Leave', statutoryDays: 60, paid: true, law: 'RA 9710 (alias)', description: 'Alias of Magna Carta leave.', requiresCredit: false },
  { code: 'SERVICE', label: 'Service / Business', statutoryDays: null, paid: true, law: 'Company policy', description: 'Official business / service — not deducted from credits.', requiresCredit: false },
  { code: 'UNPAID', label: 'Unpaid / LWOP', statutoryDays: null, paid: false, law: 'Company policy', description: 'Leave without pay. Deducted from payroll, not from credits.', requiresCredit: false },
  { code: 'OTHER', label: 'Other', statutoryDays: null, paid: true, law: 'Company policy', description: 'Miscellaneous paid leave subject to approval.', requiresCredit: false },
];

export const PHILIPPINE_LEAVE_CODES = PHILIPPINE_LEAVE_TYPES.map((t) => t.code);

export function getLeaveTypeDef(code: string): LeaveTypeDef | undefined {
  return PHILIPPINE_LEAVE_TYPES.find((t) => t.code === code);
}

export function isCreditBasedLeave(code: string): boolean {
  const def = getLeaveTypeDef(code);
  if (def) return def.requiresCredit;
  return code === 'VACATION' || code === 'SICK';
}

export function isStatutoryUncappedLeave(code: string): boolean {
  return ['MATERNITY', 'PATERNITY', 'SOLO_PARENT', 'VAWC', 'MAGNA_CARTA', 'GYNE'].includes(code);
}

// ============================================================================
// OVERTIME & NIGHT DIFFERENTIAL (DOLE)
// ============================================================================

export type OTRateKey =
  | 'ORDINARY_OT' // ordinary day, first 8h OT
  | 'REST_DAY' // work on rest day, first 8h
  | 'REST_DAY_OT' // rest day beyond 8h
  | 'REGULAR_HOLIDAY' // worked regular holiday, first 8h
  | 'REGULAR_HOLIDAY_OT' // regular holiday beyond 8h
  | 'SPECIAL_DAY' // worked special non-working day
  | 'SPECIAL_DAY_OT'; // special day beyond 8h

export const OVERTIME_RATES: Record<OTRateKey, { multiplier: number; label: string }> = {
  ORDINARY_OT: { multiplier: 1.25, label: 'Ordinary OT — 125% of hourly' },
  REST_DAY: { multiplier: 1.3, label: 'Rest day — 130% of daily/hourly' },
  REST_DAY_OT: { multiplier: 1.69, label: 'Rest day OT beyond 8h — 169%' },
  REGULAR_HOLIDAY: { multiplier: 2.0, label: 'Regular holiday worked — 200%' },
  REGULAR_HOLIDAY_OT: { multiplier: 2.6, label: 'Regular holiday OT — 260%' },
  SPECIAL_DAY: { multiplier: 1.3, label: 'Special non-working day worked — 130%' },
  SPECIAL_DAY_OT: { multiplier: 1.69, label: 'Special day OT beyond 8h — 169%' },
};

/** Night differential: +10% of hourly for work 22:00–06:00 (Labor Code Art. 86). */
export const NIGHT_DIFF_RATE = 0.1;
export const NIGHT_DIFF_START_HOUR = 22;
export const NIGHT_DIFF_END_HOUR = 6;

export function calculateNightDifferentialPay(nightHours: number, hourlyRate: number): number {
  if (nightHours <= 0 || hourlyRate <= 0) return 0;
  return Math.round(nightHours * hourlyRate * NIGHT_DIFF_RATE * 100) / 100;
}

export function calculateOTPay(hours: number, hourlyRate: number, rate: OTRateKey = 'ORDINARY_OT'): number {
  if (hours <= 0 || hourlyRate <= 0) return 0;
  return Math.round(hours * hourlyRate * OVERTIME_RATES[rate].multiplier * 100) / 100;
}

// ============================================================================
// HOLIDAY PAY (DOLE) — premium-only model used by payroll engine
// Base salary already covers the day; these are ADDITIONAL premiums.
// ============================================================================

export type StandardHolidayType = 'REGULAR' | 'SPECIAL' | 'SPECIAL_NON_WORK';

export const HOLIDAY_PREMIUM_RATES: Record<
  StandardHolidayType,
  { workedFirst8h: number; unworked: number; label: string }
> = {
  REGULAR: { workedFirst8h: 1.0, unworked: 1.0, label: 'Regular: +100% if worked, 100% if unworked' },
  SPECIAL: { workedFirst8h: 0.3, unworked: 0, label: 'Special non-working: +30% if worked, no pay if unworked' },
  SPECIAL_NON_WORK: { workedFirst8h: 0.3, unworked: 0, label: 'Special non-working: +30% if worked, no pay if unworked' },
};

export function normalizeHolidayType(raw: string): StandardHolidayType {
  if (raw === 'REGULAR') return 'REGULAR';
  if (raw === 'SPECIAL_NON_WORK' || raw === 'SPECIAL_NON_WORKING') return 'SPECIAL_NON_WORK';
  return 'SPECIAL';
}

// ============================================================================
// SSS EMPLOYER EC + WISP NOTE (SSS Circular 2024-006, RA 11199)
// ============================================================================

export function sssEmployerEC(msc: number): number {
  return msc <= 14500 ? 10 : 30;
}

/** Amount of MSC above P20,000 that goes to WISP / MySSS Pension Booster. Informational. */
export function sssWispMSC(msc: number): number {
  return Math.max(0, Math.min(msc, 35000) - 20000);
}

// ============================================================================
// DE MINIMIS + 13TH MONTH (BIR / PD 851)
// ============================================================================

/** 13th-month + bonuses tax-exempt ceiling. */
export const TAX_EXEMPT_BONUS_CEILING = 90000;

export function calculate13thMonthPay(totalBasicEarnedInYear: number): number {
  if (totalBasicEarnedInYear <= 0) return 0;
  return Math.round((totalBasicEarnedInYear / 12) * 100) / 100;
}

export function splitTaxableBonus(thirteenthMonthPlusBonuses: number): {
  exempt: number;
  taxable: number;
} {
  const exempt = Math.min(TAX_EXEMPT_BONUS_CEILING, thirteenthMonthPlusBonuses);
  return { exempt, taxable: Math.max(0, thirteenthMonthPlusBonuses - exempt) };
}

/** Common de minimis caps (monthly) per BIR RR 2-98 as amended. Non-taxable up to caps. */
export const DE_MINIMIS_CAPS = {
  riceSubsidyMonthly: 2000,
  uniformAnnual: 6000,
  medicalAnnual: 10000,
  laundryMonthly: 300,
  employeeAchievementAnnual: 10000,
} as const;

/**
 * Prorate monthly statutory contributions per payroll frequency.
 * Standard PH practice: deduct 1/2 each semimonthly cut-off so the month totals once.
 */
export function prorateStatutoryForFrequency(monthlyAmount: number, frequency: string): number {
  if (frequency === 'SEMIMONTHLY') return Math.round(((monthlyAmount || 0) / 2) * 100) / 100;
  return Math.round((monthlyAmount || 0) * 100) / 100;
}
