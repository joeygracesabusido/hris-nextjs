'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  UserMinus,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Palmtree,
  ArrowUpRight,
  ArrowDownRight,
  Radar,
  Zap,
  CalendarDays,
} from 'lucide-react';

interface Stats {
  totalEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  absentPerDepartment: {
    name: string;
    absent: number;
    total: number;
  }[];
  personalStats?: {
    isPresent: boolean;
    isOnLeave: boolean;
    employeeName: string | undefined;
    department: string | undefined;
  };
}

function getManilaDateParts() {
  try {
    const now = new Date();
    const dateFmt = new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const timeFmt = new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return { date: dateFmt.format(now), time: timeFmt.format(now) };
  } catch {
    return { date: new Date().toDateString(), time: new Date().toLocaleTimeString() };
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [clock, setClock] = useState({ date: '', time: '' });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    setUserRole(cookies.userRole || '');

    async function fetchStats() {
      try {
        const response = await fetch('/api/dashboard/stats');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();

    setClock(getManilaDateParts());
    const id = setInterval(() => setClock(getManilaDateParts()), 1000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[480px] gap-5">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-cyan-300 animate-spin" />
          <div className="absolute inset-3 rounded-full border border-violet-400/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Activity className="w-6 h-6 text-cyan-300 animate-pulse" />
          </div>
        </div>
        <p className="text-sm text-slate-400 tracking-wide">Syncing workforce telemetry...</p>
      </div>
    );
  }

  // EMPLOYEE role view
  if (userRole === 'EMPLOYEE' && stats?.personalStats) {
    const { isPresent, isOnLeave, employeeName, department } = stats.personalStats;

    return (
      <div className="space-y-6 animate-fade-up">
        <div className="relative overflow-hidden rounded-3xl p-[1px] bg-gradient-to-r from-cyan-500/50 via-blue-600/30 to-violet-500/50">
          <div className="relative rounded-3xl bg-[#0a1128]/95 backdrop-blur-xl p-7 lg:p-9 overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-40" />
            <div className="absolute -top-20 right-10 w-72 h-72 bg-cyan-500/20 blur-[90px]" />
            <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex-1">
                <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-300 font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live · {clock.date}
                </p>
                <h1 className="mt-2 text-3xl lg:text-4xl font-extrabold tracking-tight">
                  Kumusta, <span className="text-gradient">{employeeName?.split(' ')[0] || 'Operator'}</span>
                </h1>
                <p className="text-slate-400 mt-2">
                  {department || 'Unassigned'} · Manila time <span className="font-mono text-cyan-200 tabular-nums">{clock.time}</span>
                </p>
              </div>
              <div
                className={`flex items-center gap-4 rounded-2xl px-6 py-5 border backdrop-blur ${
                  isPresent
                    ? 'bg-emerald-500/10 border-emerald-400/30 shadow-[0_0_40px_rgba(52,211,153,0.25)]'
                    : isOnLeave
                      ? 'bg-amber-500/10 border-amber-400/30 shadow-[0_0_40px_rgba(251,191,36,0.25)]'
                      : 'bg-rose-500/10 border-rose-400/30 shadow-[0_0_40px_rgba(251,113,133,0.25)]'
                }`}
              >
                <div
                  className={`p-3.5 rounded-2xl ${
                    isPresent
                      ? 'bg-gradient-to-br from-emerald-400 to-teal-600'
                      : isOnLeave
                        ? 'bg-gradient-to-br from-amber-400 to-orange-600'
                        : 'bg-gradient-to-br from-rose-400 to-red-600'
                  }`}
                >
                  {isPresent ? (
                    <CheckCircle2 className="w-7 h-7 text-white" />
                  ) : isOnLeave ? (
                    <Palmtree className="w-7 h-7 text-white" />
                  ) : (
                    <AlertTriangle className="w-7 h-7 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-xl font-bold">
                    {isPresent ? 'Present Today' : isOnLeave ? 'On Leave' : 'Not Clocked In'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {isPresent ? 'Signal locked · Have a productive shift' : isOnLeave ? 'Enjoy your rest · Approved' : 'Head to Time Logs to clock in'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Shift today', value: '08:00 – 17:00', sub: 'Day shift · Makati HQ', icon: Clock },
            { label: 'Leave balance', value: '12.5 days', sub: 'Vacation + Sick', icon: Palmtree },
            { label: 'Next payroll', value: 'Mar 15', sub: 'Auto-computed · PH compliant', icon: CalendarDays },
          ].map((c) => (
            <div key={c.label} className="glass rounded-2xl p-5 card-hover">
              <c.icon className="w-5 h-5 text-cyan-300 mb-3" />
              <p className="text-xs text-slate-500 uppercase tracking-widest">{c.label}</p>
              <p className="text-xl font-bold mt-1">{c.value}</p>
              <p className="text-xs text-slate-500 mt-1">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Admin roles view
  const total = stats?.totalEmployees || 0;
  const present = stats?.presentToday || 0;
  const onLeave = stats?.onLeaveToday || 0;
  const unaccounted = Math.max(0, total - present - onLeave);
  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

  const summaryStats = [
    {
      label: 'Total Workforce',
      value: total.toString(),
      delta: '+2.4% this month',
      up: true,
      icon: Users,
      grad: 'from-cyan-400 to-blue-600',
      glow: 'shadow-[0_0_30px_rgba(56,189,248,0.35)]',
    },
    {
      label: 'Present Today',
      value: present.toString(),
      delta: `${attendanceRate}% attendance`,
      up: true,
      icon: Zap,
      grad: 'from-emerald-400 to-teal-600',
      glow: 'shadow-[0_0_30px_rgba(52,211,153,0.35)]',
    },
    {
      label: 'On Leave',
      value: onLeave.toString(),
      delta: 'Approved requests',
      up: false,
      icon: Palmtree,
      grad: 'from-amber-400 to-orange-600',
      glow: 'shadow-[0_0_30px_rgba(251,191,36,0.3)]',
    },
    {
      label: 'Needs Attention',
      value: unaccounted.toString(),
      delta: 'No log detected',
      up: false,
      icon: UserMinus,
      grad: 'from-rose-400 to-red-600',
      glow: 'shadow-[0_0_30px_rgba(251,113,133,0.3)]',
    },
  ];

  const maxAbsent = Math.max(1, ...(stats?.absentPerDepartment.map((d) => d.absent) || [1]));

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl p-[1px] bg-gradient-to-r from-cyan-500/40 via-blue-600/20 to-violet-500/40">
        <div className="relative rounded-3xl bg-[#0a1128]/95 p-7 lg:p-8 overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-50" />
          <div className="absolute -top-24 left-1/4 w-96 h-64 bg-blue-600/20 blur-[100px]" />
          <div className="absolute -bottom-24 right-10 w-80 h-64 bg-violet-600/20 blur-[100px]" />
          <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3.5 py-1.5 text-[11px] text-slate-300">
                <Radar className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
                LIVE WORKFORCE RADAR · {clock.date}
              </div>
              <h1 className="mt-3 text-3xl lg:text-[38px] font-extrabold tracking-tight leading-tight">
                Command your <span className="text-gradient">workforce</span> in real time
              </h1>
              <p className="text-slate-400 mt-2 max-w-xl">
                Manila <span className="font-mono text-cyan-200 tabular-nums">{clock.time} PHT</span> ·
                SSS, PhilHealth, Pag-IBIG and payroll fully synced. Here&apos;s today&apos;s pulse.
              </p>
            </div>
            {/* attendance ring */}
            <div className="flex items-center gap-5 rounded-2xl glass px-6 py-5">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="url(#attGrad)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(attendanceRate / 100) * 264} 264`}
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="attGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-extrabold">{attendanceRate}%</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">present</span>
                </div>
              </div>
              <div className="space-y-2 text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-slate-300">Present <b className="text-white ml-1">{present}</b></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-slate-300">On leave <b className="text-white ml-1">{onLeave}</b></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="text-slate-300">Unaccounted <b className="text-white ml-1">{unaccounted}</b></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryStats.map((stat) => (
          <div
            key={stat.label}
            className="group relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-b from-white/15 to-white/[0.03]"
          >
            <div className="relative rounded-2xl bg-[#0b1226]/95 p-5 overflow-hidden card-hover">
              <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${stat.grad} opacity-20 blur-2xl group-hover:opacity-35 transition-opacity`} />
              <div className="relative flex items-start justify-between">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.grad} ${stat.glow}`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <span
                  className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                    stat.up
                      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20'
                      : 'text-slate-300 bg-white/5 border-white/10'
                  }`}
                >
                  {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  Live
                </span>
              </div>
              <p className="relative mt-4 text-3xl font-extrabold tracking-tight">{stat.value}</p>
              <p className="relative text-[13px] text-slate-400 font-medium mt-0.5">{stat.label}</p>
              <p className="relative text-[11px] text-slate-500 mt-2">{stat.delta}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
        {/* Absent per Department */}
        <div className="rounded-2xl p-[1px] bg-gradient-to-b from-white/12 to-white/[0.03]">
          <div className="rounded-2xl bg-[#0b1226]/95 p-6 h-full">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-400/20">
                  <UserMinus className="w-4 h-4 text-rose-300" />
                </div>
                <div>
                  <h3 className="font-semibold">Absence heatmap</h3>
                  <p className="text-xs text-slate-500">By department · today</p>
                </div>
              </div>
              <span className="text-[11px] text-slate-500 glass rounded-full px-3 py-1.5">Auto-refresh 60s</span>
            </div>
            <div className="space-y-4">
              {stats?.absentPerDepartment.map((dept) => {
                const pct = dept.total > 0 ? (dept.absent / dept.total) * 100 : 0;
                return (
                  <div key={dept.name} className="group">
                    <div className="flex justify-between items-center text-[13px] mb-1.5">
                      <span className="font-medium text-slate-200">{dept.name}</span>
                      <span className="text-slate-500 font-mono tabular-nums">
                        <span className={dept.absent > 0 ? 'text-rose-300 font-bold' : 'text-emerald-300 font-bold'}>
                          {dept.absent}
                        </span>{' '}
                        / {dept.total} absent
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden border border-white/5">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          pct > 50
                            ? 'bg-gradient-to-r from-rose-500 to-red-400 shadow-[0_0_12px_rgba(251,113,133,0.6)]'
                            : pct > 20
                              ? 'bg-gradient-to-r from-amber-400 to-orange-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                              : pct > 0
                                ? 'bg-gradient-to-r from-cyan-400 to-blue-500'
                                : 'bg-gradient-to-r from-emerald-400 to-teal-400'
                        }`}
                        style={{ width: `${Math.max(dept.total > 0 ? pct : 0, dept.absent > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-white/[0.03] overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
                      <div
                        className="h-full bg-cyan-400/40"
                        style={{ width: `${(dept.total / Math.max(maxAbsent, 1)) * 10}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {(!stats?.absentPerDepartment || stats.absentPerDepartment.length === 0) && (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-300" />
                  </div>
                  <p className="text-slate-300 font-medium">Zero absences detected</p>
                  <p className="text-xs text-slate-500 mt-1">All departments fully operational</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Attendance Overview */}
        <div className="rounded-2xl p-[1px] bg-gradient-to-b from-white/12 to-white/[0.03]">
          <div className="rounded-2xl bg-[#0b1226]/95 p-6 h-full">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-300" /> Attendance matrix
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Real-time signal breakdown</p>
              </div>
              <span className="text-[11px] font-mono text-cyan-200 glass rounded-full px-3 py-1.5 tabular-nums">
                {clock.time}
              </span>
            </div>
            <div className="space-y-3">
              {[
                {
                  label: 'Present',
                  sub: 'Clocked in · GPS verified',
                  value: present,
                  cls: 'from-emerald-500/15 to-emerald-500/[0.03] border-emerald-400/20',
                  dot: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]',
                  txt: 'text-emerald-200',
                },
                {
                  label: 'On Leave (Approved)',
                  sub: 'VL / SL / EL synced',
                  value: onLeave,
                  cls: 'from-amber-500/15 to-amber-500/[0.03] border-amber-400/20',
                  dot: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]',
                  txt: 'text-amber-200',
                },
                {
                  label: 'Unaccounted',
                  sub: 'No log · follow-up needed',
                  value: unaccounted,
                  cls: 'from-rose-500/15 to-rose-500/[0.03] border-rose-400/20',
                  dot: 'bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.8)]',
                  txt: 'text-rose-200',
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r border ${row.cls}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${row.dot} animate-pulse`} />
                    <div>
                      <p className={`text-sm font-semibold ${row.txt}`}>{row.label}</p>
                      <p className="text-[11px] text-slate-500">{row.sub}</p>
                    </div>
                  </div>
                  <span className="text-2xl font-extrabold tabular-nums">{row.value}</span>
                </div>
              ))}

              <div className="rounded-2xl glass p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-600 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  <span className="text-slate-200 font-semibold">IJESoft Insight:</span> attendance is{' '}
                  {attendanceRate >= 85 ? 'above' : 'below'} the 85% healthy threshold.{' '}
                  {unaccounted > 0 ? `Ping ${unaccounted} unaccounted member${unaccounted > 1 ? 's' : ''} in Time Logs.` : 'All signals nominal.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
