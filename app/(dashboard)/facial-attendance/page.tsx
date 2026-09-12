'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Clock,
  CheckCircle2,
  AlertCircle,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Sparkles,
  Users,
  ShieldCheck,
  Zap,
  ArrowRight,
  UserCheck,
  LogOut,
  LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  startWebcam,
  stopWebcam,
  loadFaceRecognitionModels,
  detectFaceWithDescriptor,
  matchFaceDescriptor,
  captureFrameAsBase64,
  getFaceApi,
  EnrolledProfile,
  MatchResult,
} from '@/lib/face-recognition';

interface AttendanceLogItem {
  id: string;
  employeeId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  workHours: number;
  lateMinutes: number;
  clockInMethod?: string;
  clockOutMethod?: string;
  clockInPhoto?: string;
  clockOutPhoto?: string;
  confidence?: number;
  employee: {
    id: string;
    fullName: string;
    employeeId: string;
    department?: string;
    position?: string;
  };
}

export default function FacialAttendancePage() {
  const [enrolledProfiles, setEnrolledProfiles] = useState<EnrolledProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing Facial Biometrics...');

  const [mode, setMode] = useState<'auto' | 'clockIn' | 'clockOut'>('auto');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Recognition and Punch states
  const [currentMatch, setCurrentMatch] = useState<MatchResult | null>(null);
  const [isProcessingPunch, setIsProcessingPunch] = useState(false);
  const [lastPunchResult, setLastPunchResult] = useState<{
    success: boolean;
    action?: 'clockIn' | 'clockOut';
    message: string;
    timeString?: string;
    employeeName?: string;
    photo?: string;
  } | null>(null);

  // Today logs feed
  const [todayLogs, setTodayLogs] = useState<AttendanceLogItem[]>([]);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Cooldown map: employeeId -> timestamp of last punch (prevents duplicate rapid triggers)
  const punchCooldownRef = useRef<Map<string, number>>(new Map());

  // Clock ticker in Asia/Manila timezone
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const timeFmt = new Intl.DateTimeFormat('en-PH', {
          timeZone: 'Asia/Manila',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        const dateFmt = new Intl.DateTimeFormat('en-PH', {
          timeZone: 'Asia/Manila',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        setCurrentTime(timeFmt.format(now));
        setCurrentDate(dateFmt.format(now));
      } catch {
        const now = new Date();
        setCurrentTime(now.toLocaleTimeString());
        setCurrentDate(now.toLocaleDateString());
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch profiles and today logs
  const fetchProfiles = async () => {
    try {
      setLoadingProfiles(true);
      const res = await fetch('/api/face-recognition/profiles');
      if (res.ok) {
        const data = await res.json();
        setEnrolledProfiles(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching face profiles:', err);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const fetchTodayLogs = async () => {
    try {
      const res = await fetch('/api/face-recognition/clock');
      if (res.ok) {
        const data = await res.json();
        setTodayLogs(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching today logs:', err);
    }
  };

  // Play audio voice or chime
  const playAudioFeedback = useCallback(
    (text: string, isSuccess = true) => {
      if (!soundEnabled || typeof window === 'undefined') return;

      // 1. Play synthesized voice greeting if available
      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.05;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
          return;
        } catch (e) {
          console.warn('Speech synthesis error:', e);
        }
      }

      // 2. Fallback to Web Audio API beep/chime
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = isSuccess ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(isSuccess ? 587.33 : 220, ctx.currentTime);
          if (isSuccess) {
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
          }
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        }
      } catch (audioErr) {
        console.warn('Audio oscillator error:', audioErr);
      }
    },
    [soundEnabled]
  );

  // Initialize camera and AI models
  useEffect(() => {
    isMountedRef.current = true;
    fetchProfiles();
    fetchTodayLogs();

    const initKiosk = async () => {
      try {
        setStatusMessage('Loading biometric neural engine...');
        await loadFaceRecognitionModels();
        if (!isMountedRef.current) return;
        setModelsReady(true);

        setStatusMessage('Starting camera feed...');
        if (videoRef.current) {
          await startWebcam(videoRef.current, { width: 640, height: 480 });
          if (!isMountedRef.current) return;
          setCameraActive(true);
          setStatusMessage('System Armed · Looking for registered faces');
          startRecognitionLoop();
        }
      } catch (err: unknown) {
        console.error('Kiosk init error:', err);
        if (isMountedRef.current) {
          setStatusMessage(
            err instanceof Error ? err.message : 'Camera or AI models could not be loaded'
          );
        }
      }
    };

    initKiosk();

    return () => {
      isMountedRef.current = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      stopWebcam(videoRef.current);
    };
  }, []);

  // Handle recorded attendance punch
  const executePunch = async (profile: EnrolledProfile, confidence: number) => {
    const lastPunch = punchCooldownRef.current.get(profile.employeeId) || 0;
    const now = Date.now();
    // 12-second cooldown per employee to prevent spam
    if (now - lastPunch < 12000) {
      return;
    }

    punchCooldownRef.current.set(profile.employeeId, now);
    setIsProcessingPunch(true);

    try {
      const photoSnapshot = videoRef.current ? captureFrameAsBase64(videoRef.current, 320, 320) : '';

      const res = await fetch('/api/face-recognition/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: profile.employeeId,
          type: mode,
          confidence,
          photo: photoSnapshot,
        }),
      });

      const data = await res.json();

      if (data.status === 'ALREADY_COMPLETED') {
        setLastPunchResult({
          success: true,
          message: data.message,
          employeeName: profile.fullName,
        });
        playAudioFeedback(`Attendance already completed for today, ${profile.fullName}`, true);
      } else if (res.ok && data.success) {
        setLastPunchResult({
          success: true,
          action: data.action,
          message: data.message,
          timeString: data.timeString,
          employeeName: profile.fullName,
          photo: photoSnapshot,
        });

        const actionText = data.action === 'clockIn' ? 'Clock In recorded' : 'Clock Out recorded';
        playAudioFeedback(`Welcome ${profile.fullName}, ${actionText}`, true);

        fetchTodayLogs();
      } else {
        setLastPunchResult({
          success: false,
          message: data.error || 'Attendance punch failed',
          employeeName: profile.fullName,
        });
        playAudioFeedback(data.error || 'Attendance punch failed', false);
      }
    } catch (err) {
      console.error('Punch execution error:', err);
      setLastPunchResult({
        success: false,
        message: 'Network error while recording punch',
        employeeName: profile.fullName,
      });
    } finally {
      setIsProcessingPunch(false);
      // Auto-clear notification toast after 7 seconds
      setTimeout(() => {
        if (isMountedRef.current) {
          setLastPunchResult((prev) => (prev?.employeeName === profile.fullName ? null : prev));
        }
      }, 7000);
    }
  };

  // Continuous real-time recognition loop
  const startRecognitionLoop = useCallback(() => {
    let lastCheckTime = 0;

    const loop = async () => {
      if (!videoRef.current || !isMountedRef.current) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const now = Date.now();
      // Scan every 350ms for low CPU usage and instant response
      if (now - lastCheckTime >= 350 && videoRef.current.readyState === 4) {
        lastCheckTime = now;

        try {
          const detection = await detectFaceWithDescriptor(videoRef.current, { scoreThreshold: 0.55 });

          if (!isMountedRef.current) return;

          // Draw face landmark/box on overlay canvas
          if (canvasRef.current && videoRef.current) {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            const faceapi = await getFaceApi();
            faceapi.matchDimensions(canvas, displaySize);

            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              if (detection) {
                const resized = faceapi.resizeResults(detection, displaySize);
                const { x, y, width, height } = resized.detection.box;
                ctx.strokeStyle = '#06b6d4';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);

                // Draw high-tech HUD corners
                const cornerLen = 14;
                ctx.strokeStyle = '#10b981';
                ctx.lineWidth = 4;
                // Top-left
                ctx.beginPath();
                ctx.moveTo(x, y + cornerLen);
                ctx.lineTo(x, y);
                ctx.lineTo(x + cornerLen, y);
                ctx.stroke();
                // Top-right
                ctx.beginPath();
                ctx.moveTo(x + width - cornerLen, y);
                ctx.lineTo(x + width, y);
                ctx.lineTo(x + width, y + cornerLen);
                ctx.stroke();
              }
            }
          }

          if (!detection) {
            setCurrentMatch(null);
            setStatusMessage('Align face with camera');
          } else {
            // Match against enrolled profiles
            const match = matchFaceDescriptor(detection.descriptor, enrolledProfiles, 0.52);
            setCurrentMatch(match);

            if (match.match && match.profile) {
              setStatusMessage(`Verified: ${match.profile.fullName} (${match.confidence}% match)`);
              if (!isProcessingPunch) {
                executePunch(match.profile, match.confidence);
              }
            } else {
              setStatusMessage('Face detected · Unrecognized employee');
            }
          }
        } catch (err) {
          console.error('Recognition loop error:', err);
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, [enrolledProfiles, isProcessingPunch, mode]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <Zap className="w-6 h-6 text-cyan-400" />
              Facial Recognition <span className="text-gradient">DTR Kiosk</span>
            </h1>
            <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[10px] uppercase font-bold">
              Live Biometrics
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated touchless Daily Time Record terminal with real-time neural face matching
          </p>
        </div>

        {/* Kiosk control toolbar */}
        <div className="flex items-center gap-3">
          {/* Mode Selector */}
          <div className="glass rounded-xl p-1 flex items-center border border-white/10">
            <button
              onClick={() => setMode('auto')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'auto'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Auto Detect
            </button>
            <button
              onClick={() => setMode('clockIn')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'clockIn'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Clock In Only
            </button>
            <button
              onClick={() => setMode('clockOut')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'clockOut'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Clock Out Only
            </button>
          </div>

          {/* Sound toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="rounded-xl border-white/10 hover:bg-white/5 text-slate-300"
            title={soundEnabled ? 'Mute Voice & Chimes' : 'Enable Audio'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </Button>

          {/* Fullscreen button */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="rounded-xl border-white/10 hover:bg-white/5 text-slate-300"
            title="Toggle Kiosk Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Main Terminal Grid: Left (Camera & Biometric HUD), Right (Live Feed & Stats) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column (Biometric Kiosk Viewport) */}
        <div className="xl:col-span-8 space-y-4">
          <div className="relative rounded-3xl overflow-hidden glass-strong border border-white/10 p-6 flex flex-col items-center shadow-2xl">
            {/* Live Clock & Manila Badge */}
            <div className="w-full flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                <div>
                  <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                    Manila Terminal Time
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-3xl font-extrabold text-cyan-300 tracking-tight">
                      {currentTime || '--:--:--'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">PHT</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs text-slate-400 font-medium">{currentDate}</p>
                <Badge
                  variant="outline"
                  className="mt-1 border-cyan-400/30 text-cyan-300 bg-cyan-500/10 text-[10px]"
                >
                  <Users className="w-3 h-3 mr-1" />
                  {enrolledProfiles.length} Face IDs Enrolled
                </Badge>
              </div>
            </div>

            {/* Video Viewport Container */}
            <div className="relative w-full aspect-[4/3] max-w-2xl rounded-2xl overflow-hidden bg-black/80 border-2 border-white/10 shadow-2xl flex items-center justify-center">
              {/* Video Element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />

              {/* Landmark Canvas Overlay */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none transform -scale-x-100"
              />

              {/* Animated High-tech Scanning Laser */}
              {cameraActive && (
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(34,211,238,0.9)] animate-grid-pan pointer-events-none opacity-80" />
              )}

              {/* Biometric Target Oval Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className={`w-52 h-68 rounded-[50%] border-2 border-dashed transition-all duration-300 flex items-center justify-center ${
                    currentMatch?.match
                      ? 'border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.4)] scale-100'
                      : currentMatch
                      ? 'border-cyan-400/60 shadow-[0_0_25px_rgba(34,211,238,0.2)] scale-95'
                      : 'border-white/20'
                  }`}
                >
                  {/* Inner subtle reticle */}
                  <div
                    className={`w-full h-full rounded-[50%] border ${
                      currentMatch?.match ? 'border-emerald-400/30 bg-emerald-500/5' : 'border-transparent'
                    }`}
                  />
                </div>
              </div>

              {/* Live HUD Status Pill */}
              <div className="absolute top-4 inset-x-4 flex justify-between items-center pointer-events-none">
                <div className="backdrop-blur-md bg-black/60 border border-white/10 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      currentMatch?.match
                        ? 'bg-emerald-400 animate-pulse'
                        : cameraActive
                        ? 'bg-cyan-400 animate-pulse'
                        : 'bg-amber-400'
                    }`}
                  />
                  <span>{statusMessage}</span>
                </div>

                <div className="backdrop-blur-md bg-black/60 border border-white/10 px-3 py-1.5 rounded-xl text-[11px] font-mono text-cyan-300">
                  MODE: {mode.toUpperCase()}
                </div>
              </div>

              {/* Verified Recognized Card Overlay (when face matches) */}
              {currentMatch?.match && currentMatch.profile && (
                <div className="absolute bottom-4 inset-x-4 animate-in slide-in-from-bottom-3 duration-300">
                  <div className="glass-strong rounded-2xl p-4 border border-emerald-400/40 bg-[#07131e]/90 shadow-[0_0_35px_rgba(16,185,129,0.3)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {currentMatch.profile.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={currentMatch.profile.photoUrl}
                          alt={currentMatch.profile.fullName}
                          className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-400"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-bold text-white text-lg">
                          {currentMatch.profile.fullName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-white text-base">
                            {currentMatch.profile.fullName}
                          </p>
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[10px]">
                            {currentMatch.confidence}% Match
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400">
                          {currentMatch.profile.position || 'Employee'} · {currentMatch.profile.department || 'General'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-8 h-8 text-emerald-400 animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Attendance Punch Confirmation Notification */}
            {lastPunchResult && (
              <div
                className={`w-full mt-4 p-4 rounded-2xl border transition-all animate-in fade-up duration-300 flex items-center justify-between ${
                  lastPunchResult.success
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                    : 'bg-rose-500/15 border-rose-400/40 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {lastPunchResult.success ? (
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400 shrink-0">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-sm text-white">{lastPunchResult.message}</p>
                    <p className="text-xs opacity-80">
                      {lastPunchResult.action === 'clockIn'
                        ? `Clock In Verified via Biometrics`
                        : lastPunchResult.action === 'clockOut'
                        ? `Clock Out Verified via Biometrics`
                        : 'Attendance notification'}
                    </p>
                  </div>
                </div>

                {lastPunchResult.timeString && (
                  <span className="font-mono text-xs font-extrabold bg-white/10 px-3 py-1.5 rounded-xl">
                    {lastPunchResult.timeString}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Attendance Feed & Quick Guide */}
        <div className="xl:col-span-4 space-y-6">
          {/* Today's Punch Feed */}
          <div className="glass-strong rounded-3xl p-6 border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-sm text-white">Today&apos;s Attendance Logs</h3>
              </div>
              <Badge variant="outline" className="text-[10px] border-white/20 text-slate-400">
                {todayLogs.length} Records
              </Badge>
            </div>

            {todayLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                <UserCheck className="w-8 h-8 opacity-40" />
                No time logs recorded yet today
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                {todayLogs.map((log) => {
                  const formatTime = (dStr: string | null) => {
                    if (!dStr) return null;
                    const d = new Date(dStr);
                    const hours = d.getUTCHours();
                    const minutes = d.getUTCMinutes();
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    const hour12 = hours % 12 || 12;
                    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                  };

                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-600/30 to-blue-600/30 border border-cyan-400/20 flex items-center justify-center font-bold text-xs text-cyan-300 shrink-0">
                          {log.employee?.fullName?.charAt(0) || 'E'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-white truncate">
                            {log.employee?.fullName}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {log.employee?.position || log.employee?.department || 'Employee'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-2 justify-end">
                          {log.clockIn && (
                            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                              <LogIn className="w-3 h-3" />
                              {formatTime(log.clockIn)}
                            </span>
                          )}
                          {log.clockOut && (
                            <span className="text-[11px] font-mono text-rose-400 flex items-center gap-1">
                              <LogOut className="w-3 h-3" />
                              {formatTime(log.clockOut)}
                            </span>
                          )}
                        </div>
                        {log.clockInMethod === 'FACIAL' && (
                          <span className="text-[9px] text-cyan-300 font-semibold tracking-wider uppercase">
                            Face ID
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Biometric Instructions Card */}
          <div className="rounded-3xl p-5 border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 via-blue-950/20 to-transparent">
            <h4 className="font-bold text-xs text-cyan-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Kiosk Usage Guide
            </h4>
            <ul className="text-xs text-slate-400 space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Step 1:</strong> Stand in front of the camera and look directly at the lens.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Step 2:</strong> In <strong>Auto Detect</strong> mode, the kiosk checks your attendance status and logs Clock In or Clock Out automatically.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Audio Confirmation:</strong> Listen for the voice greeting confirming your timestamp.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
