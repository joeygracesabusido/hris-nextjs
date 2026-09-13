'use client';

import { WifiOff, RotateCw, Hexagon } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#050914] text-slate-100 flex items-center justify-center p-6 relative">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid opacity-60 bg-grid-fade" />
        <div className="absolute -top-32 left-1/4 w-[500px] h-[300px] bg-blue-600/15 blur-[120px]" />
      </div>
      <div className="glass rounded-3xl p-8 max-w-sm w-full text-center relative">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-600 to-violet-600 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.45)]">
          <Hexagon className="w-6 h-6 text-white" />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-amber-300">
          <WifiOff className="w-4 h-4" />
          <p className="text-[11px] uppercase tracking-[0.24em]">Offline</p>
        </div>
        <h1 className="mt-2 text-xl font-extrabold tracking-tight">
          You&apos;re <span className="text-gradient">offline</span>
        </h1>
        <p className="mt-2 text-[13px] text-slate-400">
          IJESoft HRIS needs a connection right now. Clock in/out, payroll, and employee data are
          unavailable until you reconnect.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 hover:opacity-90 transition-opacity"
        >
          <RotateCw className="w-4 h-4" />
          Retry connection
        </button>
      </div>
    </div>
  );
}
