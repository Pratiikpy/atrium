'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal, ModalCloseButton } from '@/components/ui/modal';

interface Latest {
  exists?: false;
  root?: string;
  ipfsCid?: string;
  leafCount?: number;
}
async function fetchLatest(): Promise<Latest> {
  try {
    const r = await fetch('/api/lantern/latest');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { exists: false };
  }
}

/**
 * Audit P-11 fix: the "Verify my balance" button is no longer a dead UI
 * affordance. Click flow:
 *   1. Read /api/lantern/latest for the most recent published root.
 *   2. If none, render a clear "no attestation yet" state.
 *   3. If exists, POST {root, ipfsCid, wallet} to /api/lantern/verify-inclusion,
 *      which fetches the tree, recomputes the Merkle root, checks it equals the
 *      on-chain attested root, and verifies the wallet's inclusion proof
 *      (079-BE6: real verification, not a bare address match).
 *
 * The verifier UI itself lives in a modal; the button here is just the
 * entry point + an honest "no attestation yet" state when Lantern hasn't
 * published a root.
 */
export function VerifyMyBalanceButton() {
  const { data, isLoading } = useQuery({
    queryKey: ['lantern-latest-button'],
    queryFn: fetchLatest,
    refetchInterval: 60_000,
  });
  const [open, setOpen] = useState(false);

  const noAttestation = data?.exists === false || !data?.root;
  const tip = noAttestation
    ? 'No attestation published yet, Lantern cron runs every ≤10 minutes.'
    : `Latest root has ${data?.leafCount ?? '?'} leaves. Click to verify your own.`;

  return (
    <>
      <button
        type="button"
        onClick={() => !noAttestation && setOpen(true)}
        disabled={isLoading || noAttestation}
        title={tip}
        className="inline-flex items-center gap-1.5 rounded-md border border-divider bg-parchment-light px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink/30 disabled:opacity-50"
      >
        Verify my balance
      </button>
      {/* Audit T-5 fix: single source of truth for "is the modal open".
          VerifyModal's `<Modal>` reads the `open` prop; we no longer
          conditionally remount the child. Avoids the footgun where one
          gate exists and the other doesn't. */}
      {data?.root && (
        <VerifyModal
          open={open}
          root={data.root}
          ipfsCid={data.ipfsCid ?? null}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function VerifyModal({
  open,
  root,
  ipfsCid,
  onClose,
}: { open: boolean; root: string; ipfsCid: string | null; onClose: () => void }) {
  const [walletInput, setWalletInput] = useState('');
  const [result, setResult] = useState<null | { ok: boolean; reason: string; leaf?: string }>(null);
  const [busy, setBusy] = useState(false);
  // The on-chain root can exist while its leaf tree is not yet pinned to IPFS
  // (attestor runs without WEB3_STORAGE). Inclusion needs the tree, so when the
  // CID is empty we render an honest not-pinned state instead of inviting the
  // user to type an address that then fails with a misattributed "invalid
  // address" error (the real blocker is the unpinned tree, not their input).
  const pinned = Boolean(ipfsCid && ipfsCid.length > 0);

  // Audit U-4 fix: clear stale form/result on the close → open transition
  // (the modal now mounts once, so state would otherwise persist).
  useEffect(() => {
    if (!open) {
      setWalletInput('');
      setResult(null);
      setBusy(false);
    }
  }, [open]);

  async function verify() {
    // Defense in depth: the JSX hides the wallet input when !pinned, but keep
    // the honest reason here too rather than blaming the user's address.
    if (!ipfsCid) {
      setResult({
        ok: false,
        reason: 'The attested leaf tree is not pinned to IPFS yet, so per-wallet inclusion cannot be checked.',
      });
      return;
    }
    if (!walletInput || !/^0x[0-9a-fA-F]{40}$/.test(walletInput.trim())) {
      setResult({ ok: false, reason: 'Enter a valid 0x-prefixed wallet address.' });
      return;
    }
    setBusy(true);
    try {
      // Audit R-7 fix: POST with wallet in JSON body so it doesn't sit in
      // Vercel / gateway access logs.
      const r = await fetch('/api/lantern/verify-inclusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root, ipfsCid, wallet: walletInput.trim() }),
      });
      const json = await r.json();
      setResult({ ok: json.ok, reason: json.reason ?? '', leaf: json.leaf });
    } catch (err) {
      setResult({ ok: false, reason: (err as Error).message });
    }
    setBusy(false);
  }

  return (
    <Modal open={open} onClose={onClose} label="Verify balance inclusion">
      <header className="flex items-baseline justify-between">
        <p className="font-display text-xl italic text-ink">Verify inclusion</p>
        <ModalCloseButton onClose={onClose} />
      </header>
      <p className="mt-3 text-sm text-ink-soft">
        Atrium recomputes the Merkle root from the published tree, confirms it equals the
        on-chain attested root, and verifies your wallet&apos;s inclusion proof reproduces it.
      </p>
      <p className="mt-3 break-all font-mono text-[10px] text-muted">root: {root.slice(0, 14)}…</p>
      {!pinned ? (
        <div className="mt-4 rounded-md border border-testnet/30 bg-testnet/5 p-3 text-xs text-ink-soft">
          <p className="font-medium text-ink">Leaf tree not pinned to IPFS yet</p>
          <p className="mt-1">
            The attestation root is published on chain and you can verify it directly on Arbiscan.
            Per-wallet inclusion needs the full leaf tree, which the attestor pins to IPFS once
            WEB3_STORAGE is configured. This check lights up then.
          </p>
        </div>
      ) : (
        <>
          <label className="mt-4 block">
            <span className="text-[10px] uppercase tracking-wider text-muted">Wallet address</span>
            <input
              type="text"
              inputMode="text"
              placeholder="0x…"
              value={walletInput}
              onChange={(e) => setWalletInput(e.target.value)}
              className="mt-1 w-full rounded-md border border-divider bg-parchment-light px-3 py-2.5 font-mono text-sm text-ink focus:border-ink/40 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={verify}
            disabled={busy || !walletInput}
            className="mt-4 w-full rounded-md bg-ink px-4 py-3 text-sm font-medium text-parchment disabled:opacity-50"
          >
            {busy ? 'Verifying…' : 'Verify'}
          </button>
          {result && (
            <div
              className={
                'mt-4 rounded-md border p-3 text-sm ' +
                (result.ok
                  ? 'border-live/40 bg-live-soft text-live'
                  : 'border-neg/40 bg-neg/5 text-neg')
              }
            >
              <p className="font-medium">{result.ok ? 'Verified ✓' : 'Verification failed'}</p>
              {result.reason && <p className="mt-1 text-xs">{result.reason}</p>}
              {result.leaf && (
                <p className="mt-1 font-mono text-[10px]">leaf: {result.leaf}</p>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
