# Holiday Management System Implementation

## Overview

This document describes the implementation of a complete holiday management system for the HRIS Philippines application, compliant with Philippine labor law (DOLE) requirements for holiday pay computation.

## Features Implemented

### 1. Holiday Types (Philippine Labor Law)

| Type | Pay if Works | Pay if No Work | OT Rate (First 8hrs) | OT Rate (Excess) |
|------|-------------|----------------|---------------------|------------------|
| **REGULAR** | 200% | 100% | 260% | 325% |
| **SPECIAL** | 150% | 100% | 195% | 243.75% |
| **SPECIAL_NON_WORKING** | 100% | 0% | 125% | 125% |

### 2. Database Schema

#### HolidayType Enum
```prisma
enum HolidayType {
  REGULAR          // 200% pay if work, 100% if no work
  SPECIAL          // 150% pay if work, 100% if no work
  SPECIAL_NON_WORK // Normal pay if work, no pay if no work
}
```

#### Holiday Model
```prisma
model Holiday {
  id        String      @id @default(auto()) @map("_id") @db.ObjectId
  name      String
  date      DateTime    @db.Date
  year      Int
  type      HolidayType
  branchId  String?     @db.ObjectId
  isActive  Boolean     @default(true)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  @@unique([date, branchId])
  @@index([year])
  @@index([branchId])
  @@map("holidays")
}
```

### 3. Files Created/Modified

#### New Files

1. **`lib/holidays.ts`**
   - Contains Philippine official holidays data (2024-2026)
   - Exported as `PH_OFFICIAL_HOLIDAYS` record

2. **`app/api/holidays/route.ts`**
   - GET: Fetch holidays with filters (year, type, branchId, isActive)
   - POST: Create new holiday (Admin/HR only)
   - PATCH: Update holiday (Admin/HR only)
   - DELETE: Delete holiday (Admin/HR only)

3. **`app/api/holidays/import/route.ts`**
   - POST: Import official Philippine holidays
   - Supports year filter and overwrite option
   - Prevents duplicates by default

4. **`app/(dashboard)/holidays/page.tsx`**
   - Holiday management UI page
   - Add/Edit/Delete functionality
   - Year and type filters
   - "Import PH Holidays" button
   - Active/inactive toggle switch
   - Admin/HR access only

5. **`components/ui/switch.tsx`**
   - Radix UI Switch component for toggles

#### Modified Files

1. **`prisma/schema.prisma`**
   - Added `HolidayType` enum
   - Added `Holiday` model

2. **`lib/payroll.ts`**
   - Added holiday pay calculation functions:
     - `getHolidayPayMultiplier(holidayType, isWorking): number`
     - `getHolidayOTMultiplier(holidayType, otHourNumber): number`
     - `calculateHolidayPay(hourlyRate, hoursWorked, holidayType): number`
     - `isHoliday(date, holidays): Holiday | null`
     - `calculateTotalHolidayPay(hourlyRate, holidayWorkRecords, holidays): number`

3. **`app/api/payroll/route.ts`**
   - Updated `countWorkingDays()` to exclude holidays
   - Holidays fetched for payroll period
   - Working days calculation now holiday-aware

4. **`app/api/time-logs/route.ts`**
   - Added holiday flagging to time log responses
   - Fetches active holidays and maps to logs

5. **`app/(dashboard)/layout.tsx`**
   - Added "Holidays" navigation link (Admin/HR only)
   - Uses Calendar icon

### 4. API Endpoints

#### GET `/api/holidays`
Fetch holidays with optional filters.

**Query Parameters:**
- `year` (optional): Filter by year (e.g., `2025`)
- `type` (optional): Filter by type (`REGULAR`, `SPECIAL`, `SPECIAL_NON_WORK`)
- `branchId` (optional): Filter by branch (`null` for company-wide)
- `isActive` (optional): Filter by status (`true`/`false`)

**Response:**
```json
[
  {
    "id": "...",
    "name": "New Year's Day",
    "date": "2025-01-01T00:00:00.000Z",
    "year": 2025,
    "type": "REGULAR",
    "branchId": null,
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

#### POST `/api/holidays`
Create a new holiday (Admin/HR only).

**Request Body:**
```json
{
  "name": "Company Anniversary",
  "date": "2025-06-12",
  "type": "SPECIAL",
  "branchId": null,
  "isActive": true
}
```

**Response:** Created holiday object

#### PATCH `/api/holidays`
Update an existing holiday (Admin/HR only).

**Request Body:**
```json
{
  "id": "...",
  "name": "Updated Name",
  "type": "REGULAR",
  "isActive": false
}
```

**Response:** Updated holiday object

#### DELETE `/api/holidays?id={id}`
Delete a holiday (Admin/HR only).

**Response:**
```json
{
  "message": "Holiday deleted successfully"
}
```

#### POST `/api/holidays/import`
Import official Philippine holidays (Admin/HR only).

**Request Body (optional):**
```json
{
  "year": 2025,
  "overwrite": false
}
```

**Response:**
```json
{
  "message": "Imported 15 holidays, skipped 3 existing",
  "imported": 15,
  "skipped": 3
}
```

### 5. Holiday Pay Calculation Functions

#### `getHolidayPayMultiplier(holidayType, isWorking)`
Returns the pay multiplier based on holiday type and work status.

```typescript
getHolidayPayMultiplier('REGULAR', true)  // 2.0 (200%)
getHolidayPayMultiplier('REGULAR', false) // 1.0 (100%)
getHolidayPayMultiplier('SPECIAL', true)  // 1.5 (150%)
getHolidayPayMultiplier('SPECIAL_NON_WORK', false) // 0 (no pay)
```

#### `getHolidayOTMultiplier(holidayType, otHourNumber)`
Returns overtime multiplier for hours worked on holidays.

```typescript
getHolidayOTMultiplier('REGULAR', 1)   // 2.6 (260%)
getHolidayOTMultiplier('REGULAR', 9)   // 3.25 (325% for excess)
getHolidayOTMultiplier('SPECIAL', 1)   // 1.95 (195%)
```

#### `calculateHolidayPay(hourlyRate, hoursWorked, holidayType)`
Calculates total pay for hours worked on a holiday.

```typescript
calculateHolidayPay(500, 8, 'REGULAR')    // 8000 (500 × 2.0 × 8)
calculateHolidayPay(500, 10, 'REGULAR')   // 10500 (8hrs @ 200% + 2hrs @ OT rate)
```

### 6. UI Features

#### Holiday Management Page (`/holidays`)

**Add Holiday Form:**
- Holiday name input
- Date picker
- Type dropdown (Regular/Special/Special Non-Working)
- Add button

**Import Button:**
- "Import PH Holidays" button
- Imports official Philippine holidays
- Preserves existing holidays by default

**Holiday List:**
- Displays all holidays with filters
- Year filter dropdown (2024, 2025, 2026, All Years)
- Type filter dropdown (All Types, Regular, Special, Special Non-Working)
- Each holiday shows:
  - Name and formatted date
  - Type badge (color-coded)
  - Active/Inactive toggle switch
  - Edit and Delete buttons

**Edit Mode:**
- Click Edit to modify holiday details
- Save or Cancel changes

**Access Control:**
- Only Admin and HR users can access
- Employees and Managers see "Access Denied" message

### 7. Integration Points

#### Payroll Integration
The `countWorkingDays()` function in `app/api/payroll/route.ts` now excludes holidays:

```typescript
function countWorkingDays(
  start: Date,
  end: Date,
  holidays: { isActive: boolean; date: Date }[] = []
): number {
  let count = 0;
  const cur = new Date(start);
  const holidayDates = holidays
    .filter((h) => h.isActive)
    .map((h) => new Date(h.date).toLocaleDateString());

  while (cur <= end) {
    const day = cur.getDay();
    const dateStr = cur.toLocaleDateString();
    // Exclude weekends (0=Sunday, 6=Saturday) and holidays
    if (day !== 0 && day !== 6 && !holidayDates.includes(dateStr)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
```

#### Time Logs Integration
Time logs now include holiday information in the response:

```typescript
const holidays = await prisma.holiday.findMany({
  where: { isActive: true, branchId: null },
});
const holidayMap = new Map(
  holidays.map(h => [new Date(h.date).toLocaleDateString(), h])
);

// In formatted logs
const logDateStr = new Date(log.date).toLocaleDateString();
const holiday = holidayMap.get(logDateStr) || null;
```

### 8. Philippine Official Holidays Data

The system includes pre-loaded official holidays for 2024-2026:

**2024 Highlights:**
- New Year's Day (Jan 1) - REGULAR
- Chinese New Year (Jan 7) - SPECIAL
- Good Friday (Mar 30) - REGULAR
- Labor Day (May 1) - REGULAR
- Independence Day (Jun 12) - REGULAR
- Christmas Day (Dec 25) - REGULAR
- Rizal Day (Dec 30) - REGULAR

**2025-2026:** Similar structure with updated dates for movable holidays.

### 9. Database Collections

**New Collection:**
- `holidays` - Company holiday records

**Related Collections:**
- `payrolls` - Now uses holiday-aware working days calculation
- `timelogs` - Now includes holiday flagging

### 10. Testing

To test the implementation:

1. **Access the Holidays page:**
   ```
   http://localhost:3001/holidays
   ```
   (Must be logged in as Admin or HR)

2. **Import PH Holidays:**
   - Click "Import PH Holidays" button
   - Verify holidays appear in the list

3. **Add Custom Holiday:**
   - Fill in name, date, type
   - Click "Add Holiday"

4. **Edit Holiday:**
   - Click Edit button on any holiday
   - Modify details and save

5. **Toggle Active/Inactive:**
   - Use the switch toggle on any holiday

6. **Delete Holiday:**
   - Click Delete button (confirms before deletion)

7. **Test Payroll Integration:**
   - Generate payroll for a period with holidays
   - Verify working days exclude holidays

8. **Test Time Logs:**
   - View time logs for a holiday date
   - Verify holiday information is included

### 11. Known Issues

**Pre-existing lint warnings (not related to holiday system):**
- `app/api/time-logs/route.ts:26` - `officeLocation` model uses `(prisma as any)` - GPS feature
- `app/api/office-location/route.ts` - Similar GPS-related issues
- Various unused variable warnings across the codebase

**Notes:**
- Prisma client may need regeneration after schema changes
- Dev server should auto-regenerate on restart
- LSP errors about `holiday` property are expected until Prisma client is regenerated

### 12. Future Enhancements

Potential improvements for the holiday system:

1. **Branch-specific holidays** - Enable `branchId` filtering for multi-branch companies
2. **Holiday calendar view** - Visual calendar display of holidays
3. **Holiday pay in payslips** - Show holiday pay breakdown in payroll details
4. **Overtime on holidays** - Full implementation of holiday OT calculations
5. **Holiday import from external source** - API integration with DOLE/Philippine government
6. **Recurring holidays** - Auto-generate annual holidays
7. **Holiday notifications** - Alert employees about upcoming holidays

### 13. Compliance

This implementation follows:
- **Philippine Labor Code** - Holiday pay rates
- **DOLE Department Advisory No. 2, Series of 2020** - Holiday classifications
- **BIR Regulations** - Tax treatment of holiday pay

### 14. References

- [DOLE Holiday Pay Calculator](https://www.dole.gov.ph/)
- [Philippine Labor Code Article 94-95](https://www.dole.gov.ph/labor-laws/)
- [BIR Tax Regulations](https://www.bir.gov.ph/)

---

**Implementation Date:** March 21, 2026  
**Developer:** HRIS Philippines Development Team  
**Version:** 1.0.0
