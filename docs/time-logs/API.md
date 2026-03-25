# Time Logs API

## Base Endpoint

```
/api/time-logs
```

---

## GET /api/time-logs

Fetch all time logs (filtered by role).

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| employeeId | string | No | Filter by specific employee (Admin/Manager only) |

### Response

```json
[
  {
    "id": "...",
    "employeeId": "...",
    "date": "2026-03-25T00:00:00.000Z",
    "clockIn": "2026-03-25T08:00:00.000Z",
    "clockOut": "2026-03-25T17:00:00.000Z",
    "workHours": 9.0,
    "lateMinutes": 0,
    "shift": {
      "id": "...",
      "name": "Morning Shift",
      "startTime": "08:00",
      "endTime": "17:00"
    },
    "employee": {
      "fullName": "John Doe",
      "employeeId": "EMP-001"
    }
  }
]
```

### Authorization
- ADMIN/MANAGER: Can view all time logs
- EMPLOYEE: Can only view their own time logs

---

## POST /api/time-logs

Record clock-in or clock-out.

### Request Body

```json
{
  "employeeId": "...",
  "type": "clockIn" | "clockOut",
  "latitude": 14.5995,
  "longitude": 120.9842
}
```

### Response (Success)

```json
{
  "message": "Clock in recorded successfully"
}
```

### Response (Error)

```json
{
  "error": "You must be within 100 meters of the office to clock in"
}
```

### Validation Rules
- GPS coordinates must be within office geofence radius
- Cannot clock in twice in the same day
- Cannot clock out without clocking in first

---

## DELETE /api/time-logs

Delete a time log entry.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Time log ID to delete |

### Response (Success)

```json
{
  "message": "Time log deleted successfully"
}
```

### Response (Error)

```json
{
  "error": "Time log ID is required"
}
```

### Authorization
- ADMIN/MANAGER only

---

## Import Endpoints

### POST /api/time-logs/import

Import time logs from CSV/Excel file.

**Content-Type**: `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| file | File | CSV or Excel file |

**Expected CSV Format:**
```csv
employeeNumber,date,clockIn,clockOut,notes
1001,2026-03-25,08:00,17:00,
```

### POST /api/time-logs/import-biometric

Import time logs from ZKTeco biometric device.

**Content-Type**: `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| file | File | .dat file from ZKTeco |
| dateFormat | string | yyyy-mm-dd, mm-dd-yyyy, or dd-mm-yyyy |

**Expected .dat Format:**
```
UserID\tDate\tTime
1001\t03-25-2026\t08:30
```
