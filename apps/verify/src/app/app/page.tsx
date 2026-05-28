import { MobileApp } from '@/components/atrium/mobile/MobileApp';
import { DesktopApp } from '@/components/atrium/app/DesktopApp';

export const metadata = {
  title: 'Atrium · App — testnet',
  description:
    'Atrium authenticated app — portfolio, vault, trade, agents, reserves, tax.',
};

/**
 * /app — single-route dual-render (Lovable port, 2026-05-28).
 *
 * Both the mobile shell and the desktop shell render into the page; CSS
 * media queries at 768px hide one or the other. The DesktopApp shell
 * carries its own sidebar + topbar + 7 internal panels (portfolio,
 * trade, transfer, agents, reserves, tax, settings) with internal route
 * switching. The MobileApp shell carries its own iPhone-style chrome +
 * tabbar + 5 panels.
 *
 * Real-data wiring on the dedicated /app/portfolio, /app/trade,
 * /app/transfer, etc. routes stays intact — those routes keep their
 * existing wagmi/viem + Scribe data hooks. This /app landing serves as
 * the unified entry surface.
 */
export default function AppPage() {
  return (
    <>
      <div className="atrium-mobile-only"><MobileApp /></div>
      <div className="atrium-desktop-only"><DesktopApp /></div>
    </>
  );
}
