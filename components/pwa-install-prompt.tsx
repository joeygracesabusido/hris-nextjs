'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'ijesoft-pwa-dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    // Storage blocked (private mode) — treat as not dismissed.
    return false;
  }
}

function persistDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Storage blocked — prompt simply reappears next visit.
  }
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
}

export function PwaInstallPrompt({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [manualHint, setManualHint] = useState(false);
  const [visible, setVisible] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('pwa-debug') === '1') {
        setShowDebug(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isStandalone()) return;
    if (readDismissed()) return;
    if (isIos()) {
      setIosHint(true);
      setVisible(true);
      return;
    }
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      deferredRef.current = promptEvent;
      setDeferred(promptEvent);
      setManualHint(false);
      setVisible(true);
      if (fallback) clearTimeout(fallback);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    // Fallback for insecure contexts (e.g. http://192.168.x.x:3000 LAN dev)
    // or when the SW is disabled in dev: `beforeinstallprompt` never fires,
    // so show manual steps instead of rendering nothing.
    fallback = setTimeout(() => {
      if (!deferredRef.current && !readDismissed() && !isStandalone()) {
        setManualHint(true);
        setVisible(true);
      }
    }, 2000);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      if (fallback) clearTimeout(fallback);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    console.info('PWA install choice:', choice.outcome);
    if (choice.outcome === 'dismissed') persistDismissed();
    deferredRef.current = null;
    setDeferred(null);
    setVisible(false);
  }, [deferred]);

  const dismiss = useCallback(() => {
    persistDismissed();
    deferredRef.current = null;
    setVisible(false);
    setIosHint(false);
    setManualHint(false);
  }, []);

  if (!visible && !showDebug) return null;

  const showManual = (iosHint || manualHint) && !deferred;

  const debugInfo =
    typeof window === 'undefined'
      ? ''
      : [
          'pwa-v3',
          `android:${isAndroid() ? 'Y' : 'N'}`,
          `standalone:${isStandalone() ? 'Y' : 'N'}`,
          `secure:${window.isSecureContext ? 'Y' : 'N'}`,
          `dismissed:${readDismissed() ? 'Y' : 'N'}`,
          `deferred:${deferred ? 'Y' : 'N'}`,
          `manual:${manualHint ? 'Y' : 'N'}`,
          `visible:${visible ? 'Y' : 'N'}`,
        ].join(' ');

  if (!visible) {
    return (
      <div className={cn('rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[11px] text-amber-200', className)}>
        {debugInfo} — prompt hidden (see flags)
      </div>
    );
  }

  return (
    <div className={cn('glass rounded-2xl p-4 flex items-start gap-3', className)}>
      <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-600 to-violet-600 flex items-center justify-center">
        <Download className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-slate-100">Install IJESoft HRIS</p>
        <p className="text-[12px] text-slate-400 mt-0.5">
          {showManual
            ? isAndroid()
              ? 'Tap ⋮ menu, then “Add to Home screen” or “Install app”.'
              : 'Use the browser menu → “Install app” / “Add to Home screen”.'
            : 'Add it to your home screen for fullscreen access.'}
        </p>
        {!iosHint && deferred && (
          <button
            type="button"
            onClick={install}
            className="mt-2.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 hover:opacity-90 transition-opacity"
          >
            Install app
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
