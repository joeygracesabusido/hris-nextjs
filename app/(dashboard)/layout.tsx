'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Clock,
  FileText,
  LogOut,
  Menu,
  UserCheck,
  CalendarDays,
  Timer,
  Wallet,
  Settings,
  Calendar,
  Award,
  ChevronDown,
  Printer,
  Hexagon,
  Search,
  Bell,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/users', label: 'Users', icon: UserCheck },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/schedules', label: 'Shift Schedule', icon: CalendarDays },
  { href: '/leave-credits', label: 'Leave Credits', icon: Award },
  { href: '/leaves', label: 'Leaves', icon: CalendarDays },
  { href: '/overtime', label: 'Overtime', icon: Timer },
  { href: '/payroll', label: 'Payroll', icon: DollarSign },
  { href: '/payroll/advances', label: 'Advances', icon: Wallet },
  { href: '/time-logs', label: 'Time Logs', icon: Clock },
  { href: '/holidays', label: 'Holidays', icon: Calendar, adminOnly: true },
  {
    href: '/reports',
    label: 'Reports',
    icon: FileText,
    adminOnly: true,
    subItems: [{ href: '/reports/print-payroll', label: 'Print Payroll', icon: Printer }],
  },
  { href: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [userName, setUserName] = useState('');
  const [manilaTime, setManilaTime] = useState('');

  useEffect(() => {
    setMounted(true);
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = decodeURIComponent(value || '');
      return acc;
    }, {} as Record<string, string>);
    if (cookies.isLoggedIn !== 'true') {
      window.location.href = '/login';
    }
    setUserRole(cookies.userRole || '');
    setUserName(cookies.userName || cookies.userEmail || 'Operator');

    const tick = () => {
      try {
        const fmt = new Intl.DateTimeFormat('en-PH', {
          timeZone: 'Asia/Manila',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        setManilaTime(fmt.format(new Date()));
      } catch {
        setManilaTime(new Date().toLocaleTimeString());
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const filteredNavItems = navItems.filter((item) => {
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
    <div className="min-h-screen bg-[#050914] text-slate-100 relative">
      {/* ambient */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-grid opacity-60 bg-grid-fade" />
        <div className="absolute -top-32 left-1/4 w-[500px] h-[300px] bg-blue-600/15 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 w-[420px] h-[420px] bg-violet-600/15 blur-[130px]" />
      </div>

      {/* Mobile topbar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 glass-strong border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-600 to-violet-600 flex items-center justify-center">
            <Hexagon className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight">
            IJESoft<span className="text-gradient"> HRIS</span>
          </span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg bg-white/5 border border-white/10"
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-[272px] flex flex-col bg-[#080d1d]/95 backdrop-blur-2xl border-r border-white/10 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-600 to-violet-600 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.45)]">
                <Hexagon className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-[3px] border-[#080d1d]" />
            </div>
            <div>
              <h1 className="text-[18px] font-extrabold tracking-tight leading-none">
                IJESoft<span className="text-gradient"> HRIS</span>
              </h1>
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 mt-1">
                Philippines · OS 2.0
              </p>
            </div>
          </div>

          {/* operator card */}
          <div className="mt-5 rounded-2xl p-[1px] bg-gradient-to-r from-cyan-500/40 via-blue-500/20 to-violet-500/40">
            <div className="rounded-2xl bg-[#0b1226] px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-xs font-bold border border-white/10">
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold truncate">{userName}</p>
                <p className="text-[11px] text-cyan-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {userRole || 'OPERATOR'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Command deck
          </p>
          {filteredNavItems.map((item) => {
            const Icon = item.icon;

            if (item.subItems) {
              const isReportsActive = pathname.startsWith('/reports');
              return (
                <div key={item.href}>
                  <button
                    onClick={() => setReportsOpen(!reportsOpen)}
                    className={`group flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-[14px] transition-all ${
                      isReportsActive
                        ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-400/20 shadow-[0_0_20px_rgba(59,130,246,0.25)]'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-[18px] h-[18px]" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${reportsOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {reportsOpen &&
                    item.subItems.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isActive = pathname === subItem.href;
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          onClick={() => {
                            setSidebarOpen(false);
                            setReportsOpen(false);
                          }}
                          className={`flex items-center gap-3 pl-11 pr-3 py-2.5 rounded-xl text-[13px] mt-1 transition-all ${
                            isActive
                              ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg'
                              : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
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
                className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14px] transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 via-blue-600/20 to-violet-600/20 text-white border border-cyan-400/25 shadow-[0_0_24px_rgba(59,130,246,0.25)]'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-white border border-transparent'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-gradient-to-b from-cyan-300 to-violet-400 shadow-[0_0_12px_rgba(103,232,249,0.8)]" />
                )}
                <Icon
                  className={`w-[18px] h-[18px] transition-colors ${
                    isActive ? 'text-cyan-300' : 'text-slate-500 group-hover:text-slate-200'
                  }`}
                />
                <span className="font-medium">{item.label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/[0.07]">
          <div className="glass rounded-2xl px-4 py-3 mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-widest">Manila</p>
              <p className="text-sm font-mono font-semibold text-cyan-200 tabular-nums">{manilaTime || '--:--'}</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3.5 py-2.5 w-full text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 border border-transparent rounded-xl transition-all text-[14px]"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span className="font-medium">Disconnect</span>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="relative z-10 lg:ml-[272px] min-h-screen flex flex-col">
        {/* Desktop topbar */}
        <header className="hidden lg:flex sticky top-0 z-30 items-center gap-4 px-8 py-4 bg-[#050914]/70 backdrop-blur-2xl border-b border-white/[0.07]">
          <div className="relative w-[380px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              placeholder="Search employees, payroll, leaves...  ( ⌘K )"
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-300/30 transition-all"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden xl:flex items-center gap-2 text-xs glass rounded-full px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-mono tabular-nums">{manilaTime} PHT</span>
            </div>
            <button className="relative w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center hover:bg-white/[0.08] transition-colors">
              <Bell className="w-[18px] h-[18px] text-slate-300" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]" />
            </button>
            <div className="flex items-center gap-2.5 pl-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-xs font-bold border border-white/20">
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="leading-tight">
                <p className="text-[13px] font-semibold max-w-[140px] truncate">{userName}</p>
                <p className="text-[11px] text-slate-500">{userRole}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
