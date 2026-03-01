'use client';

import { useState, useEffect, useRef } from 'react';
import { Clock, Play, Square, Calendar, User, Upload, Download, FileSpreadsheet, LogOut } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface Employee {
  id: string;
  employeeNumber: number;
  fullName: string;
  employeeId: string;
}

interface TimeLog {
  id: string;
  employeeId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  workHours: number;
  employee: {
    fullName: string;
    employeeId: string;
  };
}

export default function TimeLogsPage() {
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [todayLog, setTodayLog] = useState<TimeLog | null>(null);
  const [clockingIn, setClockingIn] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const getCookies = () => {
      if (typeof document === 'undefined') return { loggedIn: false };
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      return { 
        loggedIn: cookies.isLoggedIn === 'true',
        role: cookies.userRole || '',
        id: cookies.userId || ''
      };
    };
    
    const { loggedIn, role, id } = getCookies();
    if (!loggedIn) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return;
    }
    setUserRole(role || '');
    setUserId(id || '');
    fetchEmployees();
    fetchTimeLogs();
  }, []);

  const fetchTimeLogs = async () => {
    try {
      const res = await fetch('/api/time-logs');
      const data = await res.json();
      setTimeLogs(data);
      
      const today = new Date().toISOString().split('T')[0];
      const todayEntry = data.find((log: TimeLog) => log.date.startsWith(today));
      if (todayEntry) {
        setTodayLog(todayEntry);
      }
    } catch (err) {
      console.error('Failed to fetch time logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      setEmployees(data);
      if (data.length > 0) {
        setEmployeeId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  };

  const handleClockIn = async () => {
    if (!employeeId) {
      alert('No employee selected');
      return;
    }

    setClockingIn(true);
    try {
      const res = await fetch('/api/time-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, type: 'clockIn' }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to clock in');
        return;
      }

      alert('Clock in recorded successfully!');
      fetchTimeLogs();
    } catch (err) {
      alert('Something went wrong');
    } finally {
      setClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    if (!employeeId) {
      alert('No employee selected');
      return;
    }

    setClockingIn(true);
    try {
      const res = await fetch('/api/time-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, type: 'clockOut' }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to clock out');
        return;
      }

      alert('Clock out recorded successfully!');
      fetchTimeLogs();
    } catch (err) {
      alert('Something went wrong');
    } finally {
      setClockingIn(false);
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const canClockIn = !todayLog || !todayLog.clockIn;
  const canClockOut = todayLog && todayLog.clockIn && !todayLog.clockOut;

  const downloadTemplate = async () => {
    try {
      const res = await fetch('/api/employees');
      const employees: Employee[] = await res.json();
      
      const headers = ['employeeNumber', 'date', 'clockIn', 'clockOut', 'notes'];
      const sampleRows = employees.slice(0, 3).map(emp => [
        String(emp.employeeNumber),
        '2026-01-15',
        '08:00',
        '17:00',
        ''
      ]);
      
      if (sampleRows.length === 0) {
        sampleRows.push(['1001', '2026-01-15', '08:00', '17:00', '']);
      }

      const csvContent = [
        headers.join(','),
        ...sampleRows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'time_logs_template.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Failed to fetch employees for template:', err);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/time-logs/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setImportResult({ success: 0, failed: 1, errors: [data.error || 'Import failed'] });
        return;
      }

      setImportResult({
        success: data.results.success,
        failed: data.results.failed,
        errors: data.results.errors || []
      });

      if (data.results.success > 0) {
        fetchTimeLogs();
      }
    } catch (err) {
      setImportResult({ success: 0, failed: 1, errors: ['Something went wrong during import'] });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const resetImport = () => {
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLogout = () => {
    document.cookie = 'isLoggedIn=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = 'userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = 'userId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    window.location.href = '/login';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Time Logs</h1>
          <p className="text-gray-500">Record your daily attendance</p>
        </div>
        {(userRole === 'ADMIN' || userRole === 'MANAGER') && (
          <div className="flex items-center gap-2">
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" />
                  Import
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl">Import Time Logs</DialogTitle>
                  <DialogDescription className="text-sm text-gray-500 mt-1">
                    Upload a CSV or Excel file with time log data. Download the template to see the expected format.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-6">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                        <FileSpreadsheet className="w-6 h-6 text-blue-500" />
                      </div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Download Template</p>
                      <p className="text-xs text-gray-500 mb-3">Get the correct format with your employee numbers</p>
                      <Button variant="outline" onClick={downloadTemplate} className="gap-2 bg-white">
                        <Download className="w-4 h-4" />
                        Download CSV Template
                      </Button>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-gray-400">Or upload file</span>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <Label htmlFor="file-upload" className="text-sm font-medium text-gray-700">Select File</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      ref={fileInputRef}
                      onChange={handleImport}
                      disabled={importing}
                      className="mt-2 bg-white border-gray-200"
                    />
                    <p className="text-xs text-gray-400 mt-1">Supported: .csv, .xlsx, .xls</p>
                  </div>
                  
                  {importing && (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm text-blue-600">Importing...</p>
                    </div>
                  )}
                  {importResult && (
                    <div className={`rounded-lg p-4 ${importResult.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {importResult.failed === 0 ? (
                          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                        ) : (
                          <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01" /></svg>
                          </div>
                        )}
                        <p className={`font-medium ${importResult.failed === 0 ? 'text-green-700' : 'text-amber-700'}`}>Import completed</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className={`${importResult.failed === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                          <span className="font-medium">{importResult.success}</span> successful
                        </div>
                        <div className="text-red-600">
                          <span className="font-medium">{importResult.failed}</span> failed
                        </div>
                      </div>
                      {importResult.errors.length > 0 && (
                        <div className="mt-3 text-xs bg-white rounded p-2 max-h-24 overflow-y-auto border border-gray-100">
                          {importResult.errors.slice(0, 5).map((err, i) => (
                            <p key={i} className="text-red-500 py-0.5">{err}</p>
                          ))}
                          {importResult.errors.length > 5 && <p className="text-gray-500 py-0.5">...and {importResult.errors.length - 5} more errors</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter className="sm:justify-end">
                  <Button variant="outline" onClick={() => { resetImport(); setImportOpen(false); }} className="w-full sm:w-auto">
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" className="gap-2" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        )}
        {userRole !== 'ADMIN' && userRole !== 'MANAGER' && (
          <Button variant="outline" className="gap-2" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        )}
      </div>
      <div className="bg-white rounded-xl border p-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
            <Clock className="w-12 h-12 text-blue-600" />
          </div>
          
          <div className="text-center">
            <p className="text-lg font-medium">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            <p className="text-3xl font-bold text-gray-900">
              {new Date().toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
              })}
            </p>
          </div>

          {/* Employee Selector */}
          <div className="w-full max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} (#{emp.employeeNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-4 w-full max-w-md">
              <button
                onClick={handleClockIn}
                disabled={!canClockIn || clockingIn}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
                  canClockIn 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Play className="w-5 h-5" />
                {clockingIn ? 'Processing...' : 'Clock In'}
              </button>
              
              <button
                onClick={handleClockOut}
                disabled={!canClockOut || clockingIn}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
                  canClockOut 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Square className="w-5 h-5" />
                {clockingIn ? 'Processing...' : 'Clock Out'}
              </button>
            </div>

          {todayLog && employeeId === todayLog.employeeId && (
            <div className="w-full max-w-md bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Today's Status</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Clock In</p>
                  <p className="font-medium">{formatTime(todayLog.clockIn)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Clock Out</p>
                  <p className="font-medium">{formatTime(todayLog.clockOut)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Hours Worked</p>
                  <p className="font-medium">{todayLog.workHours.toFixed(2)} hours</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Time Logs Table */}
      {(userRole === 'ADMIN' || userRole === 'MANAGER') && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">All Time Logs</h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : timeLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No time logs found</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock In</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock Out</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {timeLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{formatDate(log.date)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 text-xs font-medium">
                            {log.employee?.fullName?.[0] || 'E'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{log.employee?.fullName || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{log.employee?.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">{formatTime(log.clockIn)}</td>
                    <td className="px-6 py-4 text-sm">{formatTime(log.clockOut)}</td>
                    <td className="px-6 py-4 text-sm">{log.workHours.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
