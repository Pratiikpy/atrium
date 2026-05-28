/** 1:1 of `.status-bar` in mobile reference HTMLs. */
export function StatusBar() {
  return (
    <div className="status-bar">
      <span>9:41</span>
      <div className="right">
        <svg width="18" height="11" viewBox="0 0 18 11" aria-hidden>
          <rect x="0" y="7" width="3" height="4" rx="0.5" fill="currentColor" />
          <rect x="5" y="5" width="3" height="6" rx="0.5" fill="currentColor" />
          <rect x="10" y="2" width="3" height="9" rx="0.5" fill="currentColor" />
          <rect x="15" y="0" width="3" height="11" rx="0.5" fill="currentColor" opacity="0.45" />
        </svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
          <path d="M1 4.5 a10 10 0 0 1 14 0" />
          <path d="M3 6.7 a7 7 0 0 1 10 0" />
          <path d="M5 8.7 a4 4 0 0 1 6 0" />
          <circle cx="8" cy="10" r="0.8" fill="currentColor" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden>
          <rect x="0.5" y="0.5" width="22" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1" />
          <rect x="2" y="2" width="18" height="8" rx="1" fill="currentColor" />
          <rect x="23" y="3.5" width="2" height="5" rx="1" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}
