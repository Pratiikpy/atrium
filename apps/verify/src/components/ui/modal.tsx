'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Shared modal — focus trap + Escape + aria-modal + scroll-lock + click-out.
 *
 * Audit R-6 (Wave-S) + Wave-T hardening + Wave-U hardening:
 *   - Focus trap (initial focus, Tab/Shift-Tab cycle)
 *   - Escape closes
 *   - aria-modal="true" on the dialog
 *   - Body scroll-lock with **dataset sentinel** so React StrictMode's
 *     double-invoke + non-memoized `onClose` callbacks don't desync the
 *     lock state (Wave-U U-3 fix)
 *   - `onClose` stored in a ref so a new callback identity on every parent
 *     render doesn't tear down + remount the effect, which would flicker
 *     the lock and steal focus (Wave-U U-2 fix)
 *   - Focus restore checks `isConnected`; falls back to `<main>`
 *
 * Why not @radix-ui/react-dialog: the rest of the app uses no Radix; adding
 * the dep just for one component would inflate the bundle ~30KB.
 *
 * Usage:
 *
 *   <Modal open={open} onClose={close} label="…">…</Modal>
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Audit U-3 fix: state stored on `document.body.dataset` instead of module
// globals. Dataset survives React StrictMode double-invoke (because cleanup
// → re-mount within the same paint cycle never sees a stale module value
// across the two passes — both passes see and update the dataset).
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
    // Audit V-H1 fix: clean up the count attribute too so the body
    // doesn't carry a lingering `data-atrium-modal-lock-count="0"` after
    // every modal close. Prevents e2e snapshots from diverging across runs.
    delete body.dataset[LOCK_COUNT_ATTR];
  } else {
    body.dataset[LOCK_COUNT_ATTR] = String(next);
  }
}

export function Modal({
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
  // Audit U-2 fix: store `onClose` in a ref so a fresh closure on every
  // parent render doesn't churn the effect.
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
    // Audit U-2: depend only on `open`. `onClose` is in a ref above so
    // the effect doesn't churn when the parent re-renders.
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-divider bg-parchment p-6 shadow-lg focus:outline-none"
      >
        {children}
      </div>
    </div>
  );
}

/** Modal close-X button — composes with `<Modal>` so the X reliably exists. */
export function ModalCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="text-muted hover:text-ink"
      aria-label="Close dialog"
    >
      ×
    </button>
  );
}
