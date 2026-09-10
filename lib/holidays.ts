export interface HolidayData {
  date: string
  name: string
  type: 'REGULAR' | 'SPECIAL' | 'SPECIAL_NON_WORK'
}

/**
 * Official Philippine holidays (Proclamation-based).
 * REGULAR = paid even if unworked (200% if worked).
 * SPECIAL / SPECIAL_NON_WORK = no work no pay (+30% premium if worked).
 */
export const PH_OFFICIAL_HOLIDAYS: Record<number, HolidayData[]> = {
  2024: [
    { date: '2024-01-01', name: "New Year's Day", type: 'REGULAR' },
    { date: '2024-02-09', name: 'Chinese New Year (Additional Special)', type: 'SPECIAL' },
    { date: '2024-03-28', name: 'Maundy Thursday', type: 'REGULAR' },
    { date: '2024-03-29', name: 'Good Friday', type: 'REGULAR' },
    { date: '2024-03-30', name: 'Black Saturday', type: 'SPECIAL' },
    { date: '2024-04-09', name: 'Araw ng Kagitingan', type: 'REGULAR' },
    { date: '2024-04-10', name: "Eid'l Fitr", type: 'REGULAR' },
    { date: '2024-05-01', name: 'Labor Day', type: 'REGULAR' },
    { date: '2024-06-12', name: 'Independence Day', type: 'REGULAR' },
    { date: '2024-06-17', name: "Eid'l Adha", type: 'REGULAR' },
    { date: '2024-08-21', name: 'Ninoy Aquino Day', type: 'SPECIAL' },
    { date: '2024-08-26', name: 'National Heroes Day', type: 'REGULAR' },
    { date: '2024-11-01', name: 'All Saints Day', type: 'SPECIAL' },
    { date: '2024-11-02', name: 'All Souls Day (Additional Special)', type: 'SPECIAL' },
    { date: '2024-11-30', name: 'Bonifacio Day', type: 'REGULAR' },
    { date: '2024-12-08', name: 'Feast of the Immaculate Conception', type: 'SPECIAL' },
    { date: '2024-12-24', name: 'Christmas Eve (Additional Special)', type: 'SPECIAL' },
    { date: '2024-12-25', name: 'Christmas Day', type: 'REGULAR' },
    { date: '2024-12-30', name: 'Rizal Day', type: 'REGULAR' },
    { date: '2024-12-31', name: "New Year's Eve (Additional Special)", type: 'SPECIAL' },
  ],
  2025: [
    { date: '2025-01-01', name: "New Year's Day", type: 'REGULAR' },
    { date: '2025-01-29', name: 'Chinese New Year (Additional Special)', type: 'SPECIAL' },
    { date: '2025-04-01', name: "Eid'l Fitr", type: 'REGULAR' },
    { date: '2025-04-09', name: 'Araw ng Kagitingan', type: 'REGULAR' },
    { date: '2025-04-17', name: 'Maundy Thursday', type: 'REGULAR' },
    { date: '2025-04-18', name: 'Good Friday', type: 'REGULAR' },
    { date: '2025-04-19', name: 'Black Saturday', type: 'SPECIAL' },
    { date: '2025-05-01', name: 'Labor Day', type: 'REGULAR' },
    { date: '2025-06-06', name: "Eid'l Adha", type: 'REGULAR' },
    { date: '2025-06-12', name: 'Independence Day', type: 'REGULAR' },
    { date: '2025-08-21', name: 'Ninoy Aquino Day', type: 'SPECIAL' },
    { date: '2025-08-25', name: 'National Heroes Day', type: 'REGULAR' },
    { date: '2025-11-01', name: 'All Saints Day', type: 'SPECIAL' },
    { date: '2025-11-30', name: 'Bonifacio Day', type: 'REGULAR' },
    { date: '2025-12-08', name: 'Feast of the Immaculate Conception', type: 'SPECIAL' },
    { date: '2025-12-24', name: 'Christmas Eve (Additional Special)', type: 'SPECIAL' },
    { date: '2025-12-25', name: 'Christmas Day', type: 'REGULAR' },
    { date: '2025-12-30', name: 'Rizal Day', type: 'REGULAR' },
    { date: '2025-12-31', name: "New Year's Eve (Additional Special)", type: 'SPECIAL' },
  ],
  2026: [
    { date: '2026-01-01', name: "New Year's Day", type: 'REGULAR' },
    { date: '2026-02-17', name: 'Chinese New Year (Additional Special)', type: 'SPECIAL' },
    { date: '2026-03-20', name: "Eid'l Fitr", type: 'REGULAR' },
    { date: '2026-04-02', name: 'Maundy Thursday', type: 'REGULAR' },
    { date: '2026-04-03', name: 'Good Friday', type: 'REGULAR' },
    { date: '2026-04-04', name: 'Black Saturday', type: 'SPECIAL' },
    { date: '2026-04-09', name: 'Araw ng Kagitingan', type: 'REGULAR' },
    { date: '2026-05-01', name: 'Labor Day', type: 'REGULAR' },
    { date: '2026-05-27', name: "Eid'l Adha", type: 'REGULAR' },
    { date: '2026-06-12', name: 'Independence Day', type: 'REGULAR' },
    { date: '2026-08-21', name: 'Ninoy Aquino Day', type: 'SPECIAL' },
    { date: '2026-08-31', name: 'National Heroes Day', type: 'REGULAR' },
    { date: '2026-11-01', name: 'All Saints Day', type: 'SPECIAL' },
    { date: '2026-11-30', name: 'Bonifacio Day', type: 'REGULAR' },
    { date: '2026-12-08', name: 'Feast of the Immaculate Conception', type: 'SPECIAL' },
    { date: '2026-12-24', name: 'Christmas Eve (Additional Special)', type: 'SPECIAL' },
    { date: '2026-12-25', name: 'Christmas Day', type: 'REGULAR' },
    { date: '2026-12-30', name: 'Rizal Day', type: 'REGULAR' },
    { date: '2026-12-31', name: "New Year's Eve (Additional Special)", type: 'SPECIAL' },
  ],
}
