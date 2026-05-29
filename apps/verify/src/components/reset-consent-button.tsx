'use client';

import { resetConsent } from '@/lib/consent';

export function ResetConsentButton() {
  return (
    <button
      type="button"
      className="text-sm text-ink underline underline-offset-2"
      onClick={() => {
        resetConsent();
        window.location.reload();
      }}
    >
      reset your consent preferences
    </button>
  );
}
