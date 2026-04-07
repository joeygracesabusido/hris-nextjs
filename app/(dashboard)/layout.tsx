'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, DollarSign, Clock, FileText, LogOut, Menu, UserCheck, CalendarDays, Timer, Wallet, Settings, Calendar, Award, ChevronDown, Printer, Package } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { useState, useEffect } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  subItems?: NavItem[];
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: '/hris',
    label: 'HRIS',
    icon: Users,
    subItems: [
      { href: '/users', label: 'Users', icon: UserCheck },
      { href: '/employees', label: 'Employees', icon: Users },
      { href: '/schedules', label: 'Shift Schedule', icon: CalendarDays },
      { href: '/leave-credits', label: 'Leave Credits', icon: Award },
      { href: '/leaves', label: 'Leaves', icon: CalendarDays },
      { href: '/overtime', label: 'Overtime', icon: Timer },
      { href: '/time-logs', label: 'Time Logs', icon: Clock },
      { href: '/holidays', label: 'Holidays', icon: Calendar, adminOnly: true },
      { href: '/asset-inventory', label: 'Asset Inventory', icon: Package },
    ],
  },
  {
    href: '/payroll',
    label: 'Payroll',
    icon: DollarSign,
    subItems: [
      { href: '/payroll', label: 'Payroll', icon: DollarSign },
      { href: '/payroll/advances', label: 'Advances', icon: Wallet },
    ],
  },
  {
    href: '/reports',
    label: 'Reports',
    icon: FileText,
    adminOnly: true,
    subItems: [
      { href: '/reports/print-payroll', label: 'Print Payroll', icon: Printer },
    ],
  },
  { href: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hrisOpen, setHrisOpen] = useState(false);
  const [payrollOpen, setPayrollOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    setMounted(true);
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    if (cookies.isLoggedIn !== 'true') {
      window.location.href = '/login';
    }
    setUserRole(cookies.userRole || '');
  }, []);

  const filteredNavItems = navItems.filter((item) => {
    if (item.subItems) {
      if (item.adminOnly && userRole !== 'ADMIN' && userRole !== 'HR') {
        return false;
      }
      return true;
    }
    if (userRole === 'EMPLOYEE') {
      return !['/users', '/employees', '/reports', '/settings'].includes(item.href);
    }
    if (item.adminOnly && userRole !== 'ADMIN' && userRole !== 'HR') {
      return false;
    }
    return true;
  });

  if (!mounted) return null;

  const handleLogout = () => {
    document.cookie = 'isLoggedIn=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = 'userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = 'userId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = 'userEmail=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = 'userName=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-lg">HRIS Philippines</span>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 text-white transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <h1 className="text-xl font-bold">HRIS</h1>
          <p className="text-sm text-slate-400">Philippines</p>
        </div>
        
        <nav className="px-3">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;

            if (item.subItems) {
              const isHrisActive = pathname.startsWith('/users') || pathname.startsWith('/employees') || pathname.startsWith('/schedules') || pathname.startsWith('/leave-credits') || pathname.startsWith('/leaves') || pathname.startsWith('/overtime') || pathname.startsWith('/time-logs') || pathname.startsWith('/holidays');
              const isPayrollActive = pathname.startsWith('/payroll');
              const isReportsActive = pathname.startsWith('/reports');
              
              let isActive = false;
              let open: boolean;
              let setOpen: (val: boolean) => void;
              
              if (item.href === '/hris') {
                isActive = isHrisActive;
                open = hrisOpen;
                setOpen = setHrisOpen;
              } else if (item.href === '/payroll') {
                isActive = isPayrollActive;
                open = payrollOpen;
                setOpen = setPayrollOpen;
              } else {
                isActive = isReportsActive;
                open = reportsOpen;
                setOpen = setReportsOpen;
              }

              return (
                <div key={item.href}>
                  <button
                    onClick={() => setOpen(!open)}
                    className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg mb-1 ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (item.subItems as NavItem[]).filter((subItem) => {
                    if (subItem.adminOnly && userRole !== 'ADMIN' && userRole !== 'HR') {
                      return false;
                    }
                    return true;
                  }).map((subItem) => {
                    const SubIcon = subItem.icon;
                    const isActive = pathname === subItem.href;
                    return (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        onClick={() => {
                          setSidebarOpen(false);
                        }}
                        className={`flex items-center gap-3 pl-10 pr-3 py-2 rounded-lg mb-1 ${
                          isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <SubIcon className="w-4 h-4" />
                        <span>{subItem.label}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            }

            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 ${
                  isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-700">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 w-full text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg">
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 p-6 pt-20 lg:pt-6">
        {children}
      </main>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
