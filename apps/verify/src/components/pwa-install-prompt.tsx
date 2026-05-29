'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const visits = Number(localStorage.getItem('atrium-visits') || '0') + 1;
    localStorage.setItem('atrium-visits', String(visits));

    if (visits < 2) return;
    if (localStorage.getItem('atrium-pwa-dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!show) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('atrium-pwa-dismissed', '1');
    setShow(false);
  };

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-md border border-divider bg-parchment px-4 py-3 shadow-lg"
    >
      <p className="text-sm text-ink">Install Atrium for offline access</p>
      <button
        onClick={handleInstall}
        className="rounded bg-ink px-3 py-1 text-xs text-parchment"
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        className="text-xs text-muted hover:text-ink"
        aria-label="Dismiss install prompt"
      >
        ✕
      </button>
    </div>
  );
}
