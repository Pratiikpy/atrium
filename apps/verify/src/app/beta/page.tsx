import type { Metadata } from 'next';
import { Wordmark } from '@/components/wordmark';

export const metadata: Metadata = {
  title: 'Beta Program',
  description: 'Atrium beta tester onboarding',
  // Invite-only surface: keep out of search + link previews (defense in depth
  // beyond the robots.txt disallow, which crawlers may ignore).
  robots: { index: false, follow: false },
};

export default async function BetaPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const submitted = (await searchParams).submitted === '1';
  return (
    <main className="mobile-dark-doc min-h-screen flex items-center justify-center bg-parchment p-8 text-ink max-sm:items-start max-sm:pb-40 max-sm:bg-mob-bg max-sm:text-mob-ink">
      <div className="max-w-lg text-center space-y-6">
        {submitted && (
          <div
            role="status"
            className="rounded-md border border-live/40 bg-live/10 px-4 py-3 text-sm text-ink max-sm:text-mob-ink"
          >
            Thanks, your feedback was received.
          </div>
        )}
        <div className="flex justify-center">
          <Wordmark size="md" />
        </div>
        <h1 className="serif-i text-4xl text-ink max-sm:text-mob-ink">You&apos;ve been invited as a beta tester.</h1>
        <p className="text-neutral-600 max-sm:text-mob-muted">
          Your activity helps us harden Atrium before public launch. The most useful reports are
          broken flows, wrong or stale numbers, and anything that reads as not-yet-real. Send them
          below or to feedback@useatrium.me.
        </p>

        <div className="space-y-3 text-left bg-neutral-50 rounded-lg p-6 max-sm:border max-sm:border-mob-line max-sm:bg-mob-bg-card">
          <h2 className="font-medium">Get started</h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700 max-sm:text-mob-muted">
            <li>
              <a href="/" className="underline hover:text-black max-sm:text-mob-ink">Open Verifier Mode</a>, explore the full app
            </li>
            <li>
              Send feedback to{' '}
              <a href="mailto:feedback@useatrium.me" className="underline hover:text-black max-sm:text-mob-ink">
                feedback@useatrium.me
              </a>{' '}
              or use the form below
            </li>
          </ul>
        </div>

        <BetaFeedbackForm />

        <p className="text-xs text-neutral-400 max-sm:text-mob-muted">
          Feedback is stored securely and associated with your wallet, if connected, for follow-up.
        </p>
      </div>
    </main>
  );
}

function BetaFeedbackForm() {
  return (
    <form
      action="/api/feedback"
      method="POST"
      className="text-left space-y-3 bg-white border rounded-lg p-6 max-sm:border-mob-line max-sm:bg-mob-bg-card"
    >
      <h2 className="font-medium">Quick Feedback</h2>
      <label className="block text-sm">
        <span className="text-neutral-600 max-sm:text-mob-muted">Category</span>
        <select name="category" className="mt-1 block w-full border rounded px-3 py-2 text-sm max-sm:border-mob-line max-sm:bg-mob-bg-elev max-sm:text-mob-ink">
          <option value="bug">Bug</option>
          <option value="ux">UX Issue</option>
          <option value="feature">Feature Request</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-neutral-600 max-sm:text-mob-muted">Message</span>
        <textarea
          name="message"
          required
          rows={3}
          className="mt-1 block w-full border rounded px-3 py-2 text-sm max-sm:border-mob-line max-sm:bg-mob-bg-elev max-sm:text-mob-ink max-sm:placeholder:text-mob-muted"
          placeholder="What did you notice?"
        />
      </label>
      <label className="block text-sm">
        <span className="text-neutral-600 max-sm:text-mob-muted">Email (optional, for follow-up)</span>
        <input
          type="email"
          name="email"
          className="mt-1 block w-full border rounded px-3 py-2 text-sm max-sm:border-mob-line max-sm:bg-mob-bg-elev max-sm:text-mob-ink max-sm:placeholder:text-mob-muted"
          placeholder="you@example.com"
        />
      </label>
      <button
        type="submit"
        className="w-full bg-black text-white rounded py-2 text-sm font-medium hover:bg-neutral-800 max-sm:bg-mob-accent max-sm:text-mob-bg"
      >
        Send Feedback
      </button>
    </form>
  );
}
