'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';

/**
 * SettingsMobile  the More panel for /app/settings at < md.
 * Source: design/Mobile App.html:1262-1316. Wallet card + Trust list
 * (Reserves / Tax / Session keys) + Account list (Settings / Recovery /
 * Notifications). Wallet displays the live wagmi address.
 */
export function SettingsMobile() {
  const { address, isConnected, chain } = useAccount();
  const display = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : 'Not connected';
  const chainLabel = chain?.name
    ? chain.name.toLowerCase().replace(/\s+/g, '-')
    : 'arb-sepolia';

  return (
    <div className="md:hidden flex flex-col gap-4">
      {/* Wallet card */}
      <section className="rounded-2xl border border-mob-line bg-mob-bg-card px-4 py-4">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-mob-muted">
          Smart wallet . Postern
        </div>
        <div className="mt-1.5 font-mono text-[18px] text-mob-ink">
          {display}
        </div>
        <div className="mt-0.5 text-[11px] text-mob-muted">
          {isConnected ? 'passkey . touch ID' : 'tap to connect'}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip>{chainLabel}</Chip>
          <Chip>eth-sepolia</Chip>
          <Chip>passkey . touch ID</Chip>
        </div>
      </section>

      <MoreSection heading="Trust">
        <MoreRow
          href="/app/reserves"
          label="Proof of reserves"
          right="~hourly"
          icon={<ShieldIcon />}
        />
        <MoreRow
          href="/app/tax"
          label="Tax . UK CGT"
          right="2026"
          icon={<DocIcon />}
        />
        {/* Audit fix (#42): deep-link to the real session-keys route (was /app/settings). */}
        <MoreRow
          href="/app/settings/session-keys"
          label="Session keys"
          right="manage"
          icon={<ClockIcon />}
        />
      </MoreSection>

      <MoreSection heading="Account">
        <MoreRow
          href="/app/settings"
          label="Settings"
          right="›"
          icon={<GearIcon />}
        />
        {/* Audit fix (#42): guardian count ("3") and notification state ("on")
            were hardcoded, presenting unread account state as real. Neutral
            state until this reads live recovery data. */}
        <MoreRow
          label="Recovery guardians"
          right="pending"
          icon={<GuardIcon />}
        />
        <MoreRow
          href="/app/notifications"
          label="Notifications"
          right="›"
          icon={<BellIcon />}
        />
      </MoreSection>

      <MoreSection heading="Trust mode">
        <MoreRow
          href="/lantern"
          label="Lantern dashboard"
          right="proofs ↗"
          icon={<EyeIcon />}
        />
        <MoreRow
          href="/security"
          label="Security model"
          right="↗"
          icon={<LockIcon />}
        />
        <MoreRow
          href="/docs"
          label="Documentation"
          right="↗"
          icon={<BookIcon />}
        />
      </MoreSection>

      <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-mob-muted">
        Atrium . testnet . no real funds at risk
      </p>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-mob-hairline bg-mob-bg px-2.5 py-1 font-mono text-[10px] text-mob-ink-soft">
      {children}
    </span>
  );
}

function MoreSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="px-1 pb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-mob-muted">
        {heading}
      </div>
      <ul className="overflow-hidden rounded-2xl border border-mob-line bg-mob-bg-card">
        {children}
      </ul>
    </section>
  );
}

function MoreRow({
  href,
  label,
  right,
  icon,
}: {
  href?: string;
  label: string;
  right: string;
  icon: React.ReactNode;
}) {
  // #10 polish (2026-06-09): only navigable rows get the hover highlight. The
  // disabled (no-href, e.g. "Recovery guardians · pending") variant already
  // renders dimmed + cursor-default + aria-disabled; stripping hover from it too
  // means a pending row never looks tappable on hover.
  const baseClassName =
    'flex items-center gap-3 border-b border-mob-hairline px-4 py-3.5 last:border-b-0';
  const content = (
    <>
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-mob-hairline bg-mob-bg-elev text-mob-ink-soft">
        {icon}
      </span>
      <span className="flex-1 text-[13.5px] text-mob-ink">{label}</span>
      <span className="font-mono text-[11px] text-mob-muted">{right}</span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link
          href={href as any}
          className={`${baseClassName} hover:bg-mob-bg-elev/50`}
        >
          {content}
        </Link>
      ) : (
        <div
          className={`${baseClassName} cursor-default opacity-70`}
          aria-disabled="true"
        >
          {content}
        </div>
      )}
    </li>
  );
}

/* ============ icons ============ */
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}
const ShieldIcon = () => (
  <Icon>
    <path d="M3 6l5-3 5 3v3c0 2.4-2.2 4-5 4s-5-1.6-5-4V6z" />
    <path d="M6.4 8.2l1.2 1.2 2.6-2.6" />
  </Icon>
);
const DocIcon = () => (
  <Icon>
    <rect x="3" y="2.5" width="10" height="11" rx="1" />
    <path d="M5.5 5.5h5 M5.5 8h5 M5.5 10.5h3" />
  </Icon>
);
const ClockIcon = () => (
  <Icon>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 5v3.5l2 1.5" />
  </Icon>
);
const GearIcon = () => (
  <Icon>
    <circle cx="8" cy="8" r="2" />
    <path d="M8 1.5v2 M8 12.5v2 M1.5 8h2 M12.5 8h2" />
  </Icon>
);
const GuardIcon = () => (
  <Icon>
    <circle cx="8" cy="6" r="2.4" />
    <path d="M3 14c0-2.6 2.2-4 5-4s5 1.4 5 4" />
  </Icon>
);
const BellIcon = () => (
  <Icon>
    <path d="M4 11V7.5a4 4 0 1 1 8 0V11l1 1.5H3L4 11z" />
  </Icon>
);
const EyeIcon = () => (
  <Icon>
    <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" />
    <circle cx="8" cy="8" r="2" />
  </Icon>
);
const LockIcon = () => (
  <Icon>
    <rect x="3.5" y="7" width="9" height="6.5" rx="1" />
    <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
  </Icon>
);
const BookIcon = () => (
  <Icon>
    <path d="M3 4h6a2 2 0 012 2v8H5a2 2 0 01-2-2V4z" />
    <path d="M3 12h8" />
  </Icon>
);
