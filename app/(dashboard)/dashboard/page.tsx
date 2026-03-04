export const runtime = "edge";

import { Users, DollarSign, Clock, TrendingUp } from 'lucide-react';

const stats = [
  { label: 'Total Employees', value: '124', icon: Users, color: 'bg-blue-500' },
  { label: 'Monthly Payroll', value: '₱458,320', icon: DollarSign, color: 'bg-green-500' },
  { label: 'Total Hours Today', value: '892', icon: Clock, color: 'bg-orange-500' },
  { label: 'Overtime Hours', value: '45', icon: TrendingUp, color: 'bg-purple-500' },
];

const recentEmployees = [
  { name: 'Juan dela Cruz', position: 'Software Engineer', department: 'IT', hireDate: 'Feb 25, 2026' },
  { name: 'Maria Santos', position: 'Marketing Manager', department: 'Marketing', hireDate: 'Feb 24, 2026' },
  { name: 'Pedro Garcia', position: 'Accountant', department: 'Finance', hireDate: 'Feb 20, 2026' },
  { name: 'Ana Reyes', position: 'HR Specialist', department: 'HR', hireDate: 'Feb 18, 2026' },
];

const recentPayroll = [
  { employee: 'Juan dela Cruz', amount: '₱45,000', status: 'Processed' },
  { employee: 'Maria Santos', amount: '₱52,000', status: 'Processed' },
  { employee: 'Pedro Garcia', amount: '₱38,500', status: 'Pending' },
  { employee: 'Ana Reyes', amount: '₱42,000', status: 'Processed' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Welcome back! Here&apos;s what&apos;s happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Employees */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Recent Employees</h2>
          </div>
          <div className="p-6">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500">
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Department</th>
                  <th className="pb-3">Hire Date</th>
                </tr>
              </thead>
              <tbody>
                {recentEmployees.map((emp) => (
                  <tr key={emp.name} className="border-t">
                    <td className="py-3">
                      <div>
                        <p className="font-medium">{emp.name}</p>
                        <p className="text-sm text-gray-500">{emp.position}</p>
                      </div>
                    </td>
                    <td className="py-3 text-gray-600">{emp.department}</td>
                    <td className="py-3 text-gray-600">{emp.hireDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Payroll */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Recent Payroll</h2>
          </div>
          <div className="p-6">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500">
                  <th className="pb-3">Employee</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentPayroll.map((pay) => (
                  <tr key={pay.employee} className="border-t">
                    <td className="py-3 font-medium">{pay.employee}</td>
                    <td className="py-3">{pay.amount}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        pay.status === 'Processed' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {pay.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
