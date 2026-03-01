'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, User, Mail, Briefcase, Building, DollarSign, Calendar, CreditCard, Pencil, Trash2, X } from 'lucide-react';

interface Employee {
  id: string;
  employeeNumber: number;
  fullName: string;
  email: string;
  employeeId: string;
  position: string;
  department: string;
  basicSalary: number;
  payrollFrequency: string;
  hireDate: string;
  isActive: boolean;
  tin: string;
  sssNo: string;
  philhealthNo: string;
  pagibigNo: string;
  bankName: string;
  bankAccountNo: string;
}

const departments = ['IT', 'HR', 'Finance', 'Marketing', 'Operations', 'Sales', 'Engineering', 'Admin'];
const frequencies = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'SEMIMONTHLY', label: 'Semi-monthly' },
  { value: 'MONTHLY', label: 'Monthly' }
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState<string>('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    position: '',
    department: '',
    basicSalary: '',
    payrollFrequency: 'MONTHLY',
    managerId: '',
    hireDate: '',
    tin: '',
    sssNo: '',
    philhealthNo: '',
    pagibigNo: '',
    bankName: '',
    bankAccountNo: '',
  });

  useEffect(() => {
    const getCookies = () => {
      if (typeof document === 'undefined') return { role: '', loggedIn: false };
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      return { role: cookies.userRole || '', loggedIn: cookies.isLoggedIn === 'true' };
    };
    
    const { role, loggedIn } = getCookies();
    if (!loggedIn) {
      window.location.href = '/login';
      return;
    }
    setUserRole(role);
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      if (Array.isArray(data)) {
        setEmployees(data);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const payload = selectedEmployee 
        ? { 
            id: selectedEmployee.id, 
            ...formData,
            basicSalary: parseFloat(formData.basicSalary),
            payrollFrequency: formData.payrollFrequency,
            managerId: formData.managerId || null
          } 
        : formData;

      const res = await fetch('/api/employees', {
        method: selectedEmployee ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save employee');
        alert(`${data.error}${data.details ? ': ' + data.details : ''}` || 'Failed to save employee');
        return;
      }

      alert('Employee saved successfully!');
      setShowModal(false);
      setSelectedEmployee(null);
      setFormData({
        fullName: '',
        email: '',
        position: '',
        department: '',
        basicSalary: '',
        payrollFrequency: 'MONTHLY',
        hireDate: '',
        tin: '',
        sssNo: '',
        philhealthNo: '',
        pagibigNo: '',
        bankName: '',
        bankAccountNo: '',
      });
      fetchEmployees();
    } catch (err) {
      console.error('Error:', err);
      setError('Something went wrong');
      alert('Something went wrong');
    }
  };

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({
      fullName: employee.fullName,
      email: employee.email,
      position: employee.position,
      department: employee.department,
      basicSalary: employee.basicSalary.toString(),
      payrollFrequency: employee.payrollFrequency || 'MONTHLY',
      managerId: employee.managerId || '',
      hireDate: employee.hireDate.split('T')[0],
      tin: employee.tin || '',
      sssNo: employee.sssNo || '',
      philhealthNo: employee.philhealthNo || '',
      pagibigNo: employee.pagibigNo || '',
      bankName: employee.bankName || '',
      bankAccountNo: employee.bankAccountNo || '',
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;

    try {
      const res = await fetch(`/api/employees?id=${selectedEmployee.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete employee');
        return;
      }

      alert('Employee deleted successfully!');
      setShowDeleteModal(false);
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (err) {
      alert('Something went wrong');
    }
  };

  const openDeleteModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowDeleteModal(true);
  };

  const filteredEmployees = employees.filter(emp =>
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employeeNumber.toString().includes(searchTerm) ||
    emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAdmin = userRole === 'ADMIN';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500">Manage employee records</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setSelectedEmployee(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Add Employee
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search employees..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No employees found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salary</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                {isAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {employee.fullName[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{employee.fullName}</p>
                        <p className="text-sm text-gray-500">{employee.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">#{employee.employeeNumber}</td>
                  <td className="px-6 py-4 text-sm">{employee.position}</td>
                  <td className="px-6 py-4 text-sm">{employee.department}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="capitalize">{employee.payrollFrequency?.toLowerCase() || 'Monthly'}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">₱{employee.basicSalary.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      employee.isActive 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {employee.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(employee)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">{selectedEmployee ? 'Edit Employee' : 'Add New Employee'}</h2>
              <button onClick={() => { setShowModal(false); setSelectedEmployee(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Juan dela Cruz" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="email" name="email" value={formData.email} onChange={handleChange} required
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="juan@company.com" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Position *</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" name="position" value={formData.position} onChange={handleChange} required
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Software Engineer" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select name="department" value={formData.department} onChange={handleChange} required
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none">
                      <option value="">Select Department</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Immediate Manager</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select name="managerId" value={formData.managerId} onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none">
                      <option value="">None (Top Level)</option>
                      {employees.filter(e => e.id !== selectedEmployee?.id).map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Basic Salary (PHP) *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="number" name="basicSalary" value={formData.basicSalary} onChange={handleChange} required
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="25000" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payroll Frequency *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select name="payrollFrequency" value={formData.payrollFrequency} onChange={handleChange} required
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none">
                      {frequencies.map(freq => (
                        <option key={freq.value} value={freq.value}>{freq.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="date" name="hireDate" value={formData.hireDate} onChange={handleChange} required
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-3">Government IDs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">TIN</label>
                    <input type="text" name="tin" value={formData.tin} onChange={handleChange}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="123-456-789" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SSS Number</label>
                    <input type="text" name="sssNo" value={formData.sssNo} onChange={handleChange}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="12-3456789-0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PhilHealth</label>
                    <input type="text" name="philhealthNo" value={formData.philhealthNo} onChange={handleChange}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="123456789012" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pag-IBIG</label>
                    <input type="text" name="pagibigNo" value={formData.pagibigNo} onChange={handleChange}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="1234-5678-9012" />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-3">Bank Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                    <input type="text" name="bankName" value={formData.bankName} onChange={handleChange}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="BPI" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input type="text" name="bankAccountNo" value={formData.bankAccountNo} onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="1234567890" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); setSelectedEmployee(null); }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {selectedEmployee ? 'Update Employee' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">Delete Employee</h2>
              <p className="text-gray-500 mb-6">
                Are you sure you want to delete <strong>{selectedEmployee?.fullName}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => { setShowDeleteModal(false); setSelectedEmployee(null); }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
