'use client';

import { useEffect } from 'react';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/hooks/use-toast';

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;

    const notifyUpdate = () => {
      toast({
        title: 'New version available',
        description: 'IJESoft HRIS was updated. Refresh to use the latest version.',
        action: (
          <ToastAction altText="Refresh now" onClick={() => window.location.reload()}>
            Refresh
          </ToastAction>
        ),
      });
    };

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (cancelled) return;
        if (registration.waiting) {
          notifyUpdate();
          return;
        }
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUpdate();
            }
          });
        });
      })
      .catch((error) => {
        console.warn('PWA service worker registration failed:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
