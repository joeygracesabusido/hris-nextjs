'use client';

import Link from 'next/link';
import { Hexagon, ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#050914] text-white flex flex-col">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-80" />
        <div className="absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full bg-blue-600/30 blur-[140px]" />
        <div className="absolute bottom-[-180px] right-[-100px] w-[520px] h-[420px] rounded-full bg-violet-600/25 blur-[130px]" />
      </div>

      <header className="relative z-10 flex items-center gap-3 px-6 lg:px-12 py-6">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-600 to-violet-600 flex items-center justify-center">
          <Hexagon className="w-5 h-5 text-white" />
        </div>
        <p className="font-bold tracking-tight text-[17px]">
          IJESoft<span className="text-gradient"> HRIS</span>
        </p>
      </header>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 rounded-[26px] blur opacity-30" />
            <div className="relative glass-strong rounded-3xl p-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-600 flex items-center justify-center mb-5">
                <KeyRound className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Forgot your password?</h1>
              <p className="text-slate-400 mt-2 text-[15px] leading-relaxed">
                Password resets are handled by your administrator or HR — there is
                no email reset link in this system.
              </p>
              <ol className="mt-5 space-y-3 text-sm text-slate-300">
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-xs font-bold text-cyan-300">1</span>
                  Contact your admin or HR and ask for a password reset.
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-xs font-bold text-cyan-300">2</span>
                  They will generate a temporary password for you in User Management.
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-xs font-bold text-cyan-300">3</span>
                  Sign in with it, then ask them to set your preferred password.
                </li>
              </ol>
              <Link
                href="/login"
                className="mt-7 flex items-center justify-center gap-2 w-full rounded-xl py-3 font-semibold text-[15px] bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 hover:opacity-90 transition-opacity"
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </Link>
              <p className="mt-5 text-center text-[11px] text-slate-600 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Locked out after 3 attempts? Wait 2 minutes or ask admin to reset.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
