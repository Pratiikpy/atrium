'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const pathname = usePathname();
  // The /app/* dashboard is a dense financial surface; a floating install
  // banner there occludes portfolio cards (visual sweep 2026-06-04). Keep the
  // prompt to the roomier marketing pages, never over the app data.
  const onAppSurface = pathname?.startsWith('/app') ?? false;

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

  if (!show || onAppSurface) return null;

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
      // Sit ABOVE the cookie-consent bottom-bar (height published as --consent-h)
      // so the two bottom-docked prompts don't stack/overlap. Falls back to 1rem.
      // Audit fix (visual sweep 2026-06-02): on mobile this sat at bottom-right
      // on top of the bottom nav + the red kill-switch FAB, occluding both.
      // Anchor it bottom-LEFT above the ~64px mobile nav (mb-[68px]) so it clears
      // the bottom-right FAB; desktop keeps its original bottom-right placement.
      style={{ bottom: 'calc(1rem + var(--consent-h, 0px) + env(safe-area-inset-bottom, 0px))' }}
      className="fixed left-4 right-auto z-50 mb-[68px] flex items-center gap-3 rounded-md border border-divider bg-parchment px-4 py-3 shadow-lg md:left-auto md:right-4 md:mb-0"
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
