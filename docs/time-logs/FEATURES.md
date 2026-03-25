# Time Logs Features Guide

## Clock In/Out

### How to Clock In
1. Navigate to `/time-logs`
2. Ensure GPS location is enabled and you're within office range
3. Select employee from dropdown (ifAdmin/Manager)
4. Click "Clock In" button

### How to Clock Out
1. Navigate to `/time-logs`
2. Ensure you're still within office geofence
3. Click "Clock Out" button

### GPS Requirements
- Browser must have geolocation permission
- Employee must be within configured office radius
- Distance is calculated using Haversine formula

---

## Import Time Logs

### CSV/Excel Import
1. Click "Import" button in the header
2. Download the template for correct format
3. Fill in the template with time log data
4. Upload the file
5. Review import results

**Template Format:**
| Field | Required | Format |
|-------|----------|--------|
| employeeNumber | Yes | Number |
| date | Yes | YYYY-MM-DD |
| clockIn | Yes | HH:MM |
| clockOut | No | HH:MM |
| notes | No | Text |

### Biometric Import
1. Click "Import Biometric" button
2. Select date format used in the device
3. Upload .dat file from ZKTeco device
4. Review import results

---

## Delete Time Log

### For Admin/Manager
1. Navigate to `/time-logs`
2. Find the time log entry in the table
3. Click the trash icon in the Actions column
4. Confirm deletion in the dialog

### Delete Confirmation Modal
The delete modal features a dark theme with:
- Black background
- Yellow warning text with gradient overlay
- Yellow border with glow effect
- Styled cancel and delete buttons

### Authorization
Only ADMIN and MANAGER roles can delete time logs.

---

## Search Time Logs

Use the search bar above the time logs table to filter by employee name.

---

## Work Hours Calculation

Work hours are automatically calculated when an employee clocks out:

```
workHours = (clockOut - clockIn) / (1000 * 60 * 60)
```

Rounded to 2 decimal places.

---

## Lateness Tracking

If an employee has an assigned shift schedule:
- System compares actual clock-in time with shift start time
- Late minutes are recorded in `lateMinutes` field
- Remarks show "Late (Xm)" or "On Time"
