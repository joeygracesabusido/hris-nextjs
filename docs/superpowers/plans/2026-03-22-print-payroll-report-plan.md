# Print Payroll Report Feature - Implementation Plan

> **For agentic workers:** REQUIRED: Execute tasks sequentially. Check off each step as completed.

**Goal:** Add a "Print Payroll" report feature in the Reports dropdown with cutoff period selection and PDF generation with signature blocks.

**Architecture:** 
- Modify sidebar to convert Reports to dropdown menu
- Create new `/reports/print-payroll` page with period filter and signature dropdowns
- Use jsPDF for PDF generation with payroll data and signature footer

**Tech Stack:** jsPDF, Tailwind CSS, Next.js App Router, Prisma

**Status:** ✅ COMPLETED (March 22, 2026)

---

## Task 1: Modify Sidebar - Add Reports Dropdown ✅

**Files:**
- Modify: `app/(dashboard)/layout.tsx`

- [x] **Step 1: Add state for dropdown and new imports**

- [x] **Step 2: Modify navItems to add sub-items for Reports**

- [x] **Step 3: Update filter logic for sub-items**

- [x] **Step 4: Update nav rendering to handle dropdown**

- [x] **Step 5: Render dropdown menu**

- [x] **Step 6: Render remaining nav items**

---

## Task 2: Create API Endpoint for Users by Role ✅

**Files:**
- Modify: `app/api/users/route.ts`

- [x] **Step 1: Create API to fetch users by role**

Added `?role=ACCOUNTANT` or `?role=MANAGER` query parameter support to existing users API.

---

## Task 3: Create Print Payroll Page ✅

**Files:**
- Create: `app/(dashboard)/reports/print-payroll/page.tsx`

- [x] **Step 1: Create the page structure**

- [x] **Step 2: Define interfaces**

- [x] **Step 3: Add state**

- [x] **Step 4: Add useEffect to fetch data**

- [x] **Step 5: Create fetch functions**

- [x] **Step 6: Add filter logic for period**

- [x] **Step 7: Create format currency function**

---

## Task 4: Build UI Components ✅

- [x] **Step 1: Build the page header**

- [x] **Step 2: Build period filter section**

- [x] **Step 3: Build signature block section**

- [x] **Step 4: Build payroll records table**

---

## Task 5: Implement PDF Generation with jsPDF ✅

- [x] **Step 1: Add jsPDF import**

- [x] **Step 2: Create handlePrintPDF function**

---

## Task 6: Install jsPDF dependency ✅

- [x] **Step 1: Install jsPDF**

```bash
npm install jspdf
```

---

## Task 7: Test and Verify ✅

- [x] **Step 1: Run lint check**

```bash
npm run lint
```

- [x] **Step 2: Test the feature manually**

1. Navigate to Reports > Print Payroll
2. Select a cutoff period
3. Select an accountant from dropdown
4. Select a manager from dropdown
5. Click "Print to PDF" button
6. Verify PDF downloads with correct data and signatures

---

## Summary of Files Created/Modified

| Action | File | Status |
|--------|------|--------|
| Modify | `app/(dashboard)/layout.tsx` | ✅ Done |
| Modify | `app/api/users/route.ts` | ✅ Done |
| Create | `app/(dashboard)/reports/print-payroll/page.tsx` | ✅ Done |
| Install | `jspdf` package | ✅ Done |

---

## Additional Fixes Applied

During implementation, the following pre-existing issues were fixed:

1. **Fixed `@typescript-eslint/no-explicit-any` errors** in:
   - `app/(dashboard)/time-logs/page.tsx`
   - `app/api/office-location/route.ts`
   - `app/api/time-logs/route.ts`
   - `test_advance.ts`

2. **Fixed type errors** in:
   - `app/api/office-location/route.ts` - Changed exported `checkGeofence` to private
   - `app/api/holidays/route.ts` - Added proper `HolidayType` imports
   - `app/api/holidays/import/route.ts` - Added type assertions for compound unique keys
   - `app/api/time-logs/route.ts` - Fixed undefined radius handling

---

## Build Status

```bash
npm run build  # ✅ SUCCESS
```

All type checks pass. Application builds successfully with only warnings (no errors).
