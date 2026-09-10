'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Fingerprint,
  Sparkles,
  ShieldCheck,
  Zap,
  Globe2,
  Cpu,
  ArrowRight,
  Hexagon,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    if (cookies.isLoggedIn === 'true') {
      router.push('/dashboard');
    }
  }, [router]);

  if (!mounted) return null;

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      // Only attempt if the Google provider is configured server-side
      const providersRes = await fetch('/api/auth/providers');
      const providers = await providersRes.json();
      if (!providers?.google) {
        setError('Google login is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.');
        setGoogleLoading(false);
        return;
      }
      // OAuth flow: Google → NextAuth callback → /auth/sync (bridges to app cookies) → /dashboard
      await signIn('google', { callbackUrl: '/auth/sync' });
    } catch {
      setError('Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#050914] text-white">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid bg-grid-fade animate-grid-pan opacity-80" />
        <div className="absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full bg-blue-600/30 blur-[140px] animate-aurora" />
        <div className="absolute top-1/3 -right-40 w-[620px] h-[620px] rounded-full bg-violet-600/25 blur-[150px] animate-aurora" />
        <div className="absolute bottom-[-180px] left-1/3 w-[520px] h-[420px] rounded-full bg-cyan-500/20 blur-[130px]" />
        {/* orbit ring */}
        <div className="hidden lg:block absolute right-[8%] top-1/2 -translate-y-1/2 w-[640px] h-[640px] opacity-30">
          <div className="absolute inset-0 rounded-full border border-white/10" />
          <div className="absolute inset-12 rounded-full border border-dashed border-cyan-300/20 animate-spin-slow" />
          <div className="absolute inset-24 rounded-full border border-violet-400/20" />
          <div className="absolute inset-0 animate-orbit">
            <div className="absolute -top-1 left-1/2 w-2.5 h-2.5 rounded-full bg-cyan-300 shadow-[0_0_20px_rgba(103,232,249,0.9)]" />
          </div>
        </div>
      </div>

      {/* Top nav */}
      <header className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-600 to-violet-600 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.5)]">
              <Hexagon className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#050914] animate-pulse" />
          </div>
          <div>
            <p className="font-bold tracking-tight leading-none text-[17px]">
              IJESoft<span className="text-gradient"> HRIS</span>
            </p>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
              Philippines · v2.0
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 glass rounded-full px-4 py-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          All systems operational · Manila 09:41 PHT
        </div>
      </header>

      <div className="relative z-10 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center max-w-7xl mx-auto px-6 lg:px-12 pb-12 pt-4 lg:pt-8">
        {/* Left - branding */}
        <div className="hidden lg:block animate-fade-up">
          <div className="inline-flex items-center gap-2 glass rounded-full pl-1.5 pr-4 py-1.5 text-xs mb-7">
            <span className="bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full px-2.5 py-1 font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> NEW
            </span>
            <span className="text-slate-300">
              Futuristic HR command center for PH compliance
            </span>
          </div>

          <h1 className="text-6xl font-extrabold leading-[0.95] tracking-tight">
            The future of
            <br />
            <span className="text-gradient">people operations</span>
            <br />
            starts here.
          </h1>
          <p className="mt-6 text-slate-400 text-lg max-w-md leading-relaxed">
            Biometric-ready time tracking, SSS / PhilHealth / Pag-IBIG automation,
            and real-time workforce intelligence — in one neon-fast portal.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3 max-w-lg">
            {[
              { icon: Zap, k: '0.4s', v: 'Avg. clock-in', c: 'from-amber-400 to-orange-500' },
              { icon: ShieldCheck, k: '100%', v: 'PH compliant', c: 'from-emerald-400 to-teal-500' },
              { icon: Cpu, k: '24/7', v: 'AI insights', c: 'from-cyan-400 to-blue-500' },
            ].map((s) => (
              <div
                key={s.v}
                className="glass rounded-2xl p-4 card-hover"
              >
                <div
                  className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.c} flex items-center justify-center mb-3`}
                >
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-xl font-bold">{s.k}</p>
                <p className="text-xs text-slate-400">{s.v}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 glass rounded-2xl p-5 flex items-center gap-6 max-w-lg">
            <div className="flex -space-x-3">
              {['JD', 'MA', 'RS', '+9'].map((t, i) => (
                <div
                  key={t}
                  className={`w-10 h-10 rounded-full border-2 border-[#0b1226] flex items-center justify-center text-xs font-bold ${
                    i === 3
                      ? 'bg-white/10 backdrop-blur text-white'
                      : 'bg-gradient-to-br from-slate-700 to-slate-900'
                  }`}
                >
                  {t}
                </div>
              ))}
            </div>
            <div>
              <div className="flex gap-1 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="text-amber-300 text-sm">★</span>
                ))}
              </div>
              <p className="text-sm text-slate-300">
                Trusted by <span className="text-white font-semibold">500+ companies</span> · 10K+ employees
              </p>
            </div>
            <div className="ml-auto hidden xl:flex items-center gap-2 text-xs text-slate-400">
              <Globe2 className="w-4 h-4 text-cyan-300" /> PH · SG · JP
            </div>
          </div>
        </div>

        {/* Right - login card */}
        <div className="w-full max-w-md mx-auto lg:ml-auto animate-fade-up">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 rounded-[26px] blur opacity-30 animate-pulse-glow" />
            <div className="relative glass-strong rounded-3xl p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-7">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-600 flex items-center justify-center">
                  <Fingerprint className="w-6 h-6 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300/90 font-semibold">
                    Secure access
                  </p>
                  <p className="text-xs text-slate-400">256-bit encrypted</p>
                </div>
              </div>

              <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
              <p className="text-slate-400 mt-1.5 text-[15px]">
                Enter the command center with your credentials
              </p>

              {error && (
                <div className="mt-5 bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl text-sm backdrop-blur flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-2">
                    Email or Username
                  </label>
                  <div className="group relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="h-[18px] w-[18px] text-slate-500 group-focus-within:text-cyan-300 transition-colors" />
                    </div>
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-[15px] placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-300/50 focus:bg-white/[0.07] transition-all"
                      placeholder="you@company.ph"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-300 mb-2">
                    Password
                  </label>
                  <div className="group relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-[18px] w-[18px] text-slate-500 group-focus-within:text-cyan-300 transition-colors" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-11 pr-11 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-[15px] placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-300/50 focus:bg-white/[0.07] transition-all"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-white/20 bg-white/5 text-cyan-400 focus:ring-cyan-400/50"
                    />
                    <span className="ml-2 text-[13px] text-slate-400 group-hover:text-slate-200 transition-colors">
                      Remember me
                    </span>
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[13px] text-cyan-300 hover:text-cyan-200 font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full overflow-hidden rounded-xl py-3.5 font-semibold text-[15px] text-white disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <span className="relative flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        Authenticating...
                      </>
                    ) : (
                      <>
                        Sign in to IJESoft <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </span>
                </button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-[#0b1226] text-slate-500">Or continue with</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="mt-4 w-full flex items-center justify-center gap-3 py-3 bg-white/[0.04] border border-white/10 rounded-xl hover:bg-white/[0.08] hover:border-white/20 transition-all text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {googleLoading ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span className="text-slate-200">Connecting to Google...</span>
                    </>
                  ) : (
                    <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span className="text-slate-200">Google SSO</span>
                    </>
                  )}
                </button>
              </div>

              <p className="mt-6 text-center text-[13px] text-slate-500">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-gradient font-semibold hover:opacity-80">
                  Create account
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] text-slate-600 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Protected by IJESoft Trust · SOC2 · ISO 27001
          </p>
        </div>
      </div>

      {/* Mobile stats strip */}
      <div className="lg:hidden relative z-10 px-6 pb-10 grid grid-cols-3 gap-3 max-w-md mx-auto">
        {[
          { k: '500+', v: 'Companies' },
          { k: '10K+', v: 'Employees' },
          { k: '99.9%', v: 'Uptime' },
        ].map((s) => (
          <div key={s.v} className="glass rounded-2xl p-3 text-center">
            <p className="font-bold text-gradient">{s.k}</p>
            <p className="text-[11px] text-slate-400">{s.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
