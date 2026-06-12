'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * BottomSheet (n=12), the mobile dialog primitive.
 *
 * The mobile venue / verify sheets were hand-rolled overlays: a clickable
 * backdrop div wrapping a content div, with no role="dialog", no focus trap,
 * no Escape, no scroll-lock, and no focus restore. The app already ships a
 * fully accessible shared Modal (components/ui/modal.tsx) with all of that, but
 * its container is styled as a centered card, which is wrong for a bottom sheet.
 *
 * This reuses the exact same accessibility machinery (focus trap + Escape +
 * body scroll-lock + focus restore) and only restyles the container to the
 * bottom-sheet look (slides up from the bottom, rounded top, drag handle,
 * safe-area padding) so the mobile UX is unchanged but now AT-reachable.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const LOCK_FLAG = 'atriumModalLock';
const LOCK_COUNT_ATTR = 'atriumModalLockCount';
const LOCK_ORIGINAL_ATTR = 'atriumModalOriginalOverflow';

function acquireBodyLock() {
  if (typeof document === 'undefined') return;
  const body = document.body;
  const currentCount = parseInt(body.dataset[LOCK_COUNT_ATTR] ?? '0', 10);
  if (currentCount === 0) {
    body.dataset[LOCK_ORIGINAL_ATTR] = body.style.overflow;
    body.style.overflow = 'hidden';
    body.dataset[LOCK_FLAG] = 'true';
  }
  body.dataset[LOCK_COUNT_ATTR] = String(currentCount + 1);
}

function releaseBodyLock() {
  if (typeof document === 'undefined') return;
  const body = document.body;
  const currentCount = parseInt(body.dataset[LOCK_COUNT_ATTR] ?? '0', 10);
  const next = Math.max(0, currentCount - 1);
  if (next === 0) {
    body.style.overflow = body.dataset[LOCK_ORIGINAL_ATTR] ?? '';
    delete body.dataset[LOCK_ORIGINAL_ATTR];
    delete body.dataset[LOCK_FLAG];
    delete body.dataset[LOCK_COUNT_ATTR];
  } else {
    body.dataset[LOCK_COUNT_ATTR] = String(next);
  }
}

export function BottomSheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    if (typeof document === 'undefined') return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    acquireBodyLock();

    requestAnimationFrame(() => {
      const root = dialogRef.current;
      if (!root) return;
      const first = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? root).focus();
    });

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) =>
          (typeof el.checkVisibility === 'function' ? el.checkVisibility() : el.offsetParent !== null) ||
          el.getClientRects().length > 0,
      );
      if (focusable.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      releaseBodyLock();
      const prev = previouslyFocused.current;
      if (prev && prev.isConnected && typeof prev.focus === 'function') {
        prev.focus();
      } else if (typeof document !== 'undefined') {
        const main = document.querySelector<HTMLElement>('main');
        main?.focus?.();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl bg-mob-bg px-4 pb-8 pt-4 focus:outline-none"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 32px)' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-mob-muted/40" />
        {children}
      </div>
    </div>
  );
}
