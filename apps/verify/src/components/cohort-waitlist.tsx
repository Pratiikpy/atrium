'use client';

/**
 * Cohort waitlist form + live counter. Posts to /api/cohort/waitlist (Upstash-
 * backed). The counter shows the REAL unique-signup number from the server, not
 * a seeded value. Honest states: loading, success, already-joined, invalid,
 * error, and unavailable (when the store is not configured).
 */
import { useEffect, useState } from 'react';

type Status = 'idle' | 'submitting' | 'joined' | 'already' | 'error' | 'unavailable';

export function CohortWaitlist() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [count, setCount] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  // Pull the real current count on mount so the counter is live, not static.
  useEffect(() => {
    let active = true;
    fetch('/api/cohort/waitlist')
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d.available === false) setStatus((s) => (s === 'idle' ? 'unavailable' : s));
        if (typeof d.count === 'number') setCount(d.count);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    setMessage('');
    try {
      const res = await fetch('/api/cohort/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        if (typeof data.count === 'number') setCount(data.count);
        setStatus(data.alreadyJoined ? 'already' : 'joined');
      } else if (res.status === 503) {
        setStatus('unavailable');
      } else {
        setStatus('error');
        setMessage(data.detail ?? 'Could not join right now, try again.');
      }
    } catch {
      setStatus('error');
      setMessage('Network error, try again.');
    }
  }

  const counterLabel =
    count != null ? `${count.toLocaleString()} on the waitlist` : 'Waitlist open';

  return (
    <div>
      {status === 'joined' || status === 'already' ? (
        <p className="text-ink" role="status">
          {status === 'joined' ? "You're on the waitlist." : "You're already on the waitlist."}{' '}
          <span className="text-ink-soft">We onboard partners from Month 2.</span>
        </p>
      ) : status === 'unavailable' ? (
        <p className="text-ink-soft" role="status">
          The waitlist is temporarily unavailable. Reach us at{' '}
          <a href="mailto:cohort@useatrium.me" className="underline hover:text-ink">
            cohort@useatrium.me
          </a>
          .
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label htmlFor="cohort-email" className="sr-only">
            Email address
          </label>
          <input
            id="cohort-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@firm.com"
            autoComplete="email"
            className="w-full rounded-md border border-divider bg-parchment px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:border-ink focus:outline-none sm:max-w-xs"
          />
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="inline-flex shrink-0 items-center justify-center rounded-md bg-ink px-4 py-2 text-sm font-medium text-parchment hover:bg-ink/90 disabled:opacity-60"
          >
            {status === 'submitting' ? 'Joining...' : 'Join the waitlist'}
          </button>
        </form>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
        <span className="inline-block size-1.5 rounded-full bg-[var(--color-live,#3a7d44)]" aria-hidden />
        <span>{counterLabel}</span>
        {status === 'error' && message ? <span className="text-neg">· {message}</span> : null}
      </div>
    </div>
  );
}
