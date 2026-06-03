import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Beta Program',
  description: 'Atrium beta tester onboarding',
  // Invite-only surface: keep out of search + link previews (defense in depth
  // beyond the robots.txt disallow, which crawlers may ignore).
  robots: { index: false, follow: false },
};

export default function BetaPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg text-center space-y-6">
        <h1 className="text-3xl font-semibold">You&apos;ve been invited as a beta tester. Welcome.</h1>
        <p className="text-neutral-600">
          Your activity helps us harden Atrium before public launch. Every trade, every edge case
          you find makes the protocol stronger.
        </p>

        <div className="space-y-3 text-left bg-neutral-50 rounded-lg p-6">
          <h2 className="font-medium">Get started</h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
            <li>
              <a href="/" className="underline hover:text-black">Open Verifier Mode</a>, explore the full app
            </li>
            <li>
              <a href="https://discord.gg/atrium" className="underline hover:text-black" target="_blank" rel="noopener noreferrer">
                Join Discord
              </a>, find us in <code>#beta-feedback</code>
            </li>
            <li>
              Send feedback to{' '}
              <a href="mailto:feedback@useatrium.me" className="underline hover:text-black">
                feedback@useatrium.me
              </a>{' '}
              or use the form below
            </li>
          </ul>
        </div>

        <BetaFeedbackForm />

        <p className="text-xs text-neutral-400">
          Feedback is stored securely and associated with your connected wallet for follow-up.
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
      className="text-left space-y-3 bg-white border rounded-lg p-6"
    >
      <h2 className="font-medium">Quick Feedback</h2>
      <label className="block text-sm">
        <span className="text-neutral-600">Category</span>
        <select name="category" className="mt-1 block w-full border rounded px-3 py-2 text-sm">
          <option value="bug">Bug</option>
          <option value="ux">UX Issue</option>
          <option value="feature">Feature Request</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-neutral-600">Message</span>
        <textarea
          name="message"
          required
          rows={3}
          className="mt-1 block w-full border rounded px-3 py-2 text-sm"
          placeholder="What did you notice?"
        />
      </label>
      <label className="block text-sm">
        <span className="text-neutral-600">Email (optional, for follow-up)</span>
        <input
          type="email"
          name="email"
          className="mt-1 block w-full border rounded px-3 py-2 text-sm"
          placeholder="you@example.com"
        />
      </label>
      <button
        type="submit"
        className="w-full bg-black text-white rounded py-2 text-sm font-medium hover:bg-neutral-800"
      >
        Send Feedback
      </button>
    </form>
  );
}
