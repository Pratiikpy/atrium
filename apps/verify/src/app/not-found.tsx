import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
      <Wordmark size="hero" />
      <p className="mt-12 text-lg text-ink-soft">
        That page is not here. Maybe it was a step we have not built yet, or a link that drifted.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-parchment hover:bg-ink/90"
      >
        Back to Atrium
      </Link>
    </main>
  );
}
