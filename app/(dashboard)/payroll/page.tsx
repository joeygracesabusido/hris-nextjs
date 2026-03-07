'use client';

import { useState, useEffect } from 'react';
import { Calculator, DollarSign, Clock, Calendar, CheckCircle, XCircle, User, FileText, Download, Printer } from 'lucide-react';

interface Employee {
  id: string;
  fullName: string;
  employeeNumber: number;
  department: string;
  position: string;
  basicSalary: number;
  payrollFrequency: string;
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
    totalDeductions: number;
    netPay: number;
    periodStart: string;
    periodEnd: string;
  };
  details: {
    employee: Employee;
    totalOtHours: number;
    deductions: {
      sss: number;
      philHealth: number;
      pagIbig: number;
      withholdingTax: number;
    };
  };
}

export default function PayrollPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState<PayrollResult | null>(null);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');
  const [mounted, setMounted] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: '',
    frequency: 'MONTHLY',
    periodStart: '',
    periodEnd: '',
  });

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
  }, []);

  if (!mounted) return null;

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      setEmployees(data);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

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
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to compute payroll');
        return;
      }

      setResult(data);
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
                  Compute Payroll
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
                    <span className="text-gray-600">Basic Salary</span>
                    <span className="font-medium">{formatCurrency(result.payroll.basicSalary)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Overtime ({result.details.totalOtHours} hrs)
                    </span>
                    <span className="font-medium">+{formatCurrency(result.payroll.otPay)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-semibold">
                    <span>Gross Pay</span>
                    <span className="text-green-600">{formatCurrency(result.payroll.grossPay)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Deductions
                </h3>
                <div className="space-y-2">
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
                    <span className="text-red-600">-{formatCurrency(result.payroll.totalDeductions)}</span>
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
            <p>Note: Only APPROVED overtime and business trip leaves are included in the computation.</p>
          </div>
        </div>
      )}
    </div>
  );
}
