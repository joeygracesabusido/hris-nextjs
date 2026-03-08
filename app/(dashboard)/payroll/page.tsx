'use client';

import { useState, useEffect } from 'react';
import { Calculator, DollarSign, Clock, Calendar, CheckCircle, XCircle, User, FileText, Download, Printer, ChevronDown, ChevronUp } from 'lucide-react';

interface Employee {
  id: string;
  fullName: string;
  employeeNumber: number;
  department: string;
  position: string;
  basicSalary: number;
  payrollFrequency: string;
}

interface PayrollRecord {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  periodStart: string;
  periodEnd: string;
  basicSalary: number;
  workDays: number;
  daysWorked: number;
  otHours: number;
  otPay: number;
  grossPay: number;
  sssEmployee: number;
  philhealthEmployee: number;
  pagibigEmployee: number;
  withholdingTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  status: string;
  createdAt: string;
  employee: Employee;
}

interface PayrollResult {
  payroll: {
    id: string;
    basicSalary: number;
    otHours: number;
    otPay: number;
    grossPay: number;
    sssEmployee: number;
    philhealthEmployee: number;
    pagibigEmployee: number;
    withholdingTax: number;
    otherDeductions: number;
    totalDeductions: number;
    netPay: number;
    periodStart: string;
    periodEnd: string;
  };
  details: {
    employee: Employee;
    period: { frequency: string };
    earnings: { baseSalary: number; overtimePay: number; grossPay: number };
    deductions: {
      absences: number;
      lates: number;
      undertime: number;
      sss: number;
      philHealth: number;
      pagIbig: number;
      withholdingTax: number;
      totalDeductions: number;
    };
    totals: {
      totalOtHours: number;
      leaveDays: number;
      absentDays: number;
      lateMinutes: number;
      undertimeMinutes: number;
    };
    netPay: number;
  };
}

export default function PayrollPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState<PayrollResult | null>(null);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');
  const [mounted, setMounted] = useState(false);
  const [expandedPayrollId, setExpandedPayrollId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    employeeId: '',
    frequency: 'MONTHLY',
    periodStart: '',
    periodEnd: '',
  });

  const isAllEmployees = formData.employeeId === 'all';

  const filteredPayrollRecords = payrollRecords.filter((record) =>
    record.employee.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.employee.position?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.employee.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees', { credentials: 'include' });
      
      if (!res.ok) {
        console.error('Failed to fetch employees, status:', res.status);
        setLoading(false);
        return;
      }
      
      const text = await res.text();
      if (!text) {
        console.error('Empty response from employees API');
        setLoading(false);
        return;
      }
      
      const data = JSON.parse(text);
      console.log('Employees response:', data);
      if (Array.isArray(data)) {
        setEmployees(data);
      } else if (data.error) {
        console.error('Error fetching employees:', data.error);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayrollRecords = async () => {
    try {
      const res = await fetch('/api/payroll', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setPayrollRecords(data);
      }
    } catch (err) {
      console.error('Failed to fetch payroll records:', err);
    }
  };

  useEffect(() => {
    setMounted(true);
    if (typeof document === 'undefined') return;
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    if (cookies.isLoggedIn !== 'true') {
      window.location.href = '/login';
      return;
    }
    setUserRole(cookies.userRole || '');
    fetchEmployees();
    fetchPayrollRecords();
  }, []);

  if (!mounted) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setResult(null);
  };

  const handleCompute = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setComputing(true);
    setResult(null);

    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const text = await res.text();
      if (!text) {
        setError('Empty response from server');
        setComputing(false);
        return;
      }

      const data = JSON.parse(text);

      if (!res.ok) {
        setError(data.error || 'Failed to compute payroll');
        return;
      }

      if (isAllEmployees) {
        setResult({
          payroll: {
            id: 'all',
            basicSalary: data.results?.reduce((sum: number, r: any) => sum + r.payroll.basicSalary, 0) || 0,
            otHours: data.results?.reduce((sum: number, r: any) => sum + r.payroll.otHours, 0) || 0,
            otPay: data.results?.reduce((sum: number, r: any) => sum + r.payroll.otPay, 0) || 0,
            grossPay: data.results?.reduce((sum: number, r: any) => sum + r.payroll.grossPay, 0) || 0,
            sssEmployee: data.results?.reduce((sum: number, r: any) => sum + r.payroll.sssEmployee, 0) || 0,
            philhealthEmployee: data.results?.reduce((sum: number, r: any) => sum + r.payroll.philhealthEmployee, 0) || 0,
            pagibigEmployee: data.results?.reduce((sum: number, r: any) => sum + r.payroll.pagibigEmployee, 0) || 0,
            withholdingTax: data.results?.reduce((sum: number, r: any) => sum + r.payroll.withholdingTax, 0) || 0,
            otherDeductions: data.results?.reduce((sum: number, r: any) => sum + r.payroll.otherDeductions, 0) || 0,
            totalDeductions: data.results?.reduce((sum: number, r: any) => sum + r.payroll.totalDeductions, 0) || 0,
            netPay: data.results?.reduce((sum: number, r: any) => sum + r.payroll.netPay, 0) || 0,
            periodStart: formData.periodStart,
            periodEnd: formData.periodEnd,
          },
          details: {
            employee: { id: 'all', fullName: 'All Employees', employeeNumber: 0, department: '', position: '', basicSalary: 0, payrollFrequency: '' },
            period: { frequency: formData.frequency },
            earnings: { baseSalary: 0, overtimePay: 0, grossPay: 0 },
            deductions: { absences: 0, lates: 0, undertime: 0, sss: 0, philHealth: 0, pagIbig: 0, withholdingTax: 0, totalDeductions: 0 },
            totals: { totalOtHours: 0, leaveDays: 0, absentDays: 0, lateMinutes: 0, undertimeMinutes: 0 },
            netPay: 0,
          },
        } as any);
        fetchPayrollRecords();
      } else {
        setResult(data);
      }
    } catch (err) {
      setError('Failed to compute payroll');
    } finally {
      setComputing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const frequencies = [
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'SEMIMONTHLY', label: 'Semi-monthly' },
    { value: 'MONTHLY', label: 'Monthly' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
        <p className="text-gray-500">Compute employee payroll with Philippine labor law deductions</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-gray-500">Loading employees...</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-red-500">No employees found. Please add employees first.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Compute Payroll
          </h2>

          <form onSubmit={handleCompute} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee
              </label>
              <select
                name="employeeId"
                value={formData.employeeId}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Employee</option>
                <option value="all">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} - {emp.position}
                  </option>
                ))}
              </select>
            </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pay Frequency
            </label>
            <select
              name="frequency"
              value={formData.frequency}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {frequencies.map((freq) => (
                <option key={freq.value} value={freq.value}>
                  {freq.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Period Start
            </label>
            <input
              type="date"
              name="periodStart"
              value={formData.periodStart}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Period End
            </label>
            <input
              type="date"
              name="periodEnd"
              value={formData.periodEnd}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="md:col-span-4">
            <button
              type="submit"
              disabled={computing || !formData.employeeId}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {computing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Computing...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  {isAllEmployees ? 'Compute All Payroll' : 'Compute Payroll'}
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>
      )}

      {result && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-6 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{result.details.employee.fullName}</h2>
                <p className="text-gray-500">
                  {result.details.employee.position} - {result.details.employee.department}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Pay Period: {new Date(result.payroll.periodStart).toLocaleDateString()} - {new Date(result.payroll.periodEnd).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Earnings
                </h3>
                  <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base Salary</span>
                    <span className="font-medium">{formatCurrency(result.details.earnings.baseSalary)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Overtime ({result.details.totals.totalOtHours} hrs)
                    </span>
                    <span className="font-medium">+{formatCurrency(result.details.earnings.overtimePay)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-semibold">
                    <span>Gross Pay</span>
                    <span className="text-green-600">{formatCurrency(result.details.earnings.grossPay)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Deductions
                </h3>
                <div className="space-y-2">
                  {result.details.deductions.absences > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span className="text-gray-600">Absences ({result.details.totals.absentDays} days)</span>
                      <span className="font-medium">-{formatCurrency(result.details.deductions.absences)}</span>
                    </div>
                  )}
                  {result.details.deductions.lates > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span className="text-gray-600">Lates ({result.details.totals.lateMinutes} min)</span>
                      <span className="font-medium">-{formatCurrency(result.details.deductions.lates)}</span>
                    </div>
                  )}
                  {result.details.deductions.undertime > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span className="text-gray-600">Undertime ({result.details.totals.undertimeMinutes} min)</span>
                      <span className="font-medium">-{formatCurrency(result.details.deductions.undertime)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">SSS</span>
                    <span className="font-medium">-{formatCurrency(result.details.deductions.sss)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">PhilHealth</span>
                    <span className="font-medium">-{formatCurrency(result.details.deductions.philHealth)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pag-IBIG</span>
                    <span className="font-medium">-{formatCurrency(result.details.deductions.pagIbig)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Withholding Tax</span>
                    <span className="font-medium">-{formatCurrency(result.details.deductions.withholdingTax)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-semibold">
                    <span>Total Deductions</span>
                    <span className="text-red-600">-{formatCurrency(result.details.deductions.totalDeductions)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 bg-green-50 rounded-xl p-4">
                <h3 className="font-semibold text-green-900 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Net Pay
                </h3>
                <div className="text-3xl font-bold text-green-700">
                  {formatCurrency(result.payroll.netPay)}
                </div>
                <p className="text-sm text-green-600">
                  For the period: {new Date(result.payroll.periodStart).toLocaleDateString()} - {new Date(result.payroll.periodEnd).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 border-t text-sm text-gray-500">
            <p>
              Note: Approved overtime, all approved leaves, absences, lates, and undertime are included in the computation.
              Semi-monthly frequency divides monthly salary by 2.
            </p>
          </div>
        </div>
      )}

      {payrollRecords.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-6 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Payroll History
            </h2>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by employee name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-4 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {searchQuery && '×'}
              </button>
            </div>
          </div>
          {filteredPayrollRecords.length === 0 && searchQuery ? (
            <div className="p-6 text-center text-gray-500">
              No payroll records found for "{searchQuery}"
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Basic Salary</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross Pay</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deductions</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Pay</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPayrollRecords.map((record) => (
                  <>
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{record.employee.fullName}</div>
                        <div className="text-sm text-gray-500">{record.employee.position}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(record.periodStart).toLocaleDateString()} - {new Date(record.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(record.basicSalary)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(record.grossPay)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{formatCurrency(record.totalDeductions)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(record.netPay)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          record.status === 'PROCESSED' ? 'bg-green-100 text-green-700' :
                          record.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setExpandedPayrollId(expandedPayrollId === record.id ? null : record.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          {expandedPayrollId === record.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                    {expandedPayrollId === record.id && (
                      <tr>
                        <td colSpan={8} className="bg-gray-50 px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Earnings</h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between"><span className="text-gray-600">Base Salary</span><span>{formatCurrency(record.basicSalary)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">OT Hours</span><span>{record.otHours} hrs</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">OT Pay</span><span>{formatCurrency(record.otPay)}</span></div>
                                <div className="flex justify-between font-medium border-t pt-1"><span>Gross Pay</span><span>{formatCurrency(record.grossPay)}</span></div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Deductions</h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between"><span className="text-gray-600">SSS</span><span>{formatCurrency(record.sssEmployee)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">PhilHealth</span><span>{formatCurrency(record.philhealthEmployee)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">Pag-IBIG</span><span>{formatCurrency(record.pagibigEmployee)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">Withholding Tax</span><span>{formatCurrency(record.withholdingTax)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">Other Deductions</span><span>{formatCurrency(record.otherDeductions)}</span></div>
                                <div className="flex justify-between font-medium border-t pt-1"><span>Total Deductions</span><span className="text-red-600">{formatCurrency(record.totalDeductions)}</span></div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between"><span className="text-gray-600">Work Days</span><span>{record.daysWorked} / {record.workDays}</span></div>
                                <div className="flex justify-between font-medium border-t pt-1"><span>Net Pay</span><span className="text-green-600 text-lg">{formatCurrency(record.netPay)}</span></div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
