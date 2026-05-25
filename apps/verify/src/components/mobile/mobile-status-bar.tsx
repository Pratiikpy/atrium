/**
 * Mobile status bar  faux iOS chrome that pins to the top of the screen.
 * Source: desing/Mobile App.html:144-157. Three SVG icons (signal /
 * wifi / battery) + 9:41 time. Renders only on small screens; the
 * desktop shell never shows this.
 *
 * Time is intentionally hardcoded to 9:41 (the Apple convention used in
 * the source mockup). Live wall-clock time on the status bar would feel
 * like a real OS chrome rather than a product surface; the static 9:41
 * keeps it as branding.
 */
export function MobileStatusBar() {
  return (
    <div
      className="flex items-center justify-between px-5 pt-2 pb-1 text-[14px] font-medium text-mob-ink"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}
    >
      <span className="font-mono tracking-tight">9:41</span>
      <div className="flex items-center gap-1.5">
        <SignalIcon />
        <WifiIcon />
        <BatteryIcon />
      </div>
    </div>
  );
}

function SignalIcon() {
  return (
    <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden>
      <rect x="0" y="7" width="3" height="4" rx="0.5" />
      <rect x="4.5" y="5" width="3" height="6" rx="0.5" />
      <rect x="9" y="3" width="3" height="8" rx="0.5" />
      <rect x="13.5" y="0" width="3" height="11" rx="0.5" />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor" aria-hidden>
      <path d="M8 11a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM3.5 6.5a6.36 6.36 0 019 0l-1 1a5 5 0 00-7 0l-1-1zM.5 3.5a10.6 10.6 0 0115 0l-1 1a9.2 9.2 0 00-13 0l-1-1z" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg width="27" height="13" viewBox="0 0 27 13" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="22" height="12" rx="2.5" stroke="currentColor" strokeOpacity="0.4" />
      <rect x="2" y="2" width="19" height="9" rx="1.5" fill="currentColor" />
      <rect x="24" y="4" width="2" height="5" rx="1" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}
