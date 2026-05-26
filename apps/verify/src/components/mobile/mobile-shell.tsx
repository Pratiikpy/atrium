import { MobileStatusBar } from './mobile-status-bar';
import { MobileBottomNav } from './mobile-bottom-nav';

/**
 * MobileShell  the dark OLED chrome that wraps every /app/* route on
 * narrow viewports. Source: design/Mobile App.html structure (status bar
 * + wordmark header + content + bottom-tab-bar).
 *
 * Rendered only at < md (Tailwind 768px). At md+ the desktop AppShell
 * sidebar is shown instead via the AppShell's responsive switch.
 *
 * Layout:
 *   - Status bar (iOS chrome, 9:41 + indicators)
 *   - App header (Atrium wordmark + testnet pill)
 *   - Main content (scrollable, bottom padding for the tab bar)
 *   - Bottom tab bar (fixed, glass blur, 5 tabs)
 */
export function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mob-bg text-mob-ink antialiased md:hidden">
      <MobileStatusBar />
      <header className="flex items-center justify-between px-5 pt-1 pb-4">
        <span className="font-display text-[28px] italic leading-none">Atrium</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-mob-testnet/40 bg-mob-testnet/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-mob-testnet">
          <span className="size-1 rounded-full bg-mob-testnet" />
          testnet
        </span>
      </header>
      <main className="px-4 pb-24">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
