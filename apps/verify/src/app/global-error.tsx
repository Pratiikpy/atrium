'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ backgroundColor: '#faf8f5', fontFamily: 'serif', padding: '4rem 2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#1a1a1a' }}>
          Something went wrong
        </h1>
        <p style={{ color: '#555', marginBottom: '2rem', fontFamily: 'sans-serif' }}>
          The error has been reported. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            border: '1px solid #333',
            borderRadius: '6px',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
