"""Q1-2026 SPAN cross-margin backtest.

Replays historical Hyperliquid HIP-3 trades against the Atrium SPAN scenario
matrix. For each historical trader's hedged portfolio:
  1. Compute the venue-isolated margin they posted (current behavior on HL)
  2. Compute the margin Atrium SPAN would require for the same positions
  3. Compute the saving %

Output: a JSON artefact pinned to IPFS, plus its hash, plus a one-line
collateral_delta_bps figure. The result is committed on-chain via
ResearchAttestation.publish(...). Numbers come from the notebook output,
never invented.

Run:
    python services/archive/src/span_backtest.py \\
        --start 2026-01-01 --end 2026-03-31 \\
        --output /tmp/q1-2026-backtest.json

DATA-MODE GATE (audit fix, iteration 28).

The public Hyperliquid endpoint at /info exposes CANDLES (OHLC bars), NOT
per-trader trade history. Pre-fix the script silently synthesized 1:1
perfectly-hedged trade pairs from each candle and published the resulting
"savings_bps" on-chain as a real backtest. That output was structurally
fake, a perfectly-hedged pair trivially shows SPAN savings, but no real
trader's portfolio looks like that, and committing it via
ResearchAttestation.publish would make the chain itself an attestation
of fake methodology.

Now: --data-mode is required. `real-trades` (production) needs the
founder's paid Hyperliquid archive key + a real per-trader fetch path,
which is Wave-1 engineering. `synthetic-pairs` (testnet harness sanity
check) is the legacy path, but the JSON output gets `data_mode:
"synthetic-pairs"` and the verify-app refuses to render such results
as a published backtest claim. There is no default, operators must
choose explicitly so nobody accidentally publishes synthetic numbers.
"""

from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Literal

import httpx

DataMode = Literal["real-trades", "synthetic-pairs"]


@dataclass
class Trade:
    trader: str
    timestamp: datetime
    instrument: str
    notional_signed: float
    entry_price: float
    correlation_class: int


@dataclass
class PortfolioSnapshot:
    trader: str
    positions: list[Trade]
    isolated_margin_required: float = 0.0
    atrium_span_margin_required: float = 0.0

    @property
    def saving_bps(self) -> int:
        if self.isolated_margin_required == 0:
            return 0
        delta = (self.isolated_margin_required - self.atrium_span_margin_required) / self.isolated_margin_required
        return round(delta * 10_000)


# SPAN-style scenarios (same magnitudes as the on-chain Plinth implementation)
SCENARIOS_BPS = [(1, 1000), (-1, 1000), (1, 500), (-1, 500), (1, 200), (-1, 200), (0, 0)]
MIN_INITIAL_MARGIN_BPS = 500
MAINT_BUFFER_BPS = 200


def isolated_margin_required(positions: list[Trade]) -> float:
    """Sum of per-position required margin under venue-isolated rules."""
    total = 0.0
    for p in positions:
        total += abs(p.notional_signed) * (MIN_INITIAL_MARGIN_BPS + MAINT_BUFFER_BPS) / 10_000
    return total


def atrium_span_margin_required(positions: list[Trade]) -> float:
    """Atrium SPAN scenario-matrix required margin."""
    if not positions:
        return 0.0
    by_class = defaultdict(list)
    for p in positions:
        # Audit fix (iteration 28): pre-fix this divided by `p.entry_price`
        # in the pnl calc below, a zero-priced position (stub data, unset
        # entry, bad source row) would raise ZeroDivisionError mid-loop,
        # leaving the per-class loss partially summed and the total margin
        # silently undercounting. Skip with a structural warning so the
        # operator sees the data-quality issue rather than getting a
        # quietly-wrong number on-chain.
        if p.entry_price <= 0:
            print(
                f"WARN: skipping zero-price position {p.trader} {p.instrument} "
                f"(entry_price={p.entry_price}) from SPAN calc"
            )
            continue
        by_class[p.correlation_class].append(p)

    class_worst = 0.0
    for cls_positions in by_class.values():
        worst_loss_for_class = 0.0
        for direction, mag_bps in SCENARIOS_BPS:
            net_loss = 0.0
            for p in cls_positions:
                shock = p.entry_price * (1 + direction * mag_bps / 10_000)
                pnl_at_shock = p.notional_signed * (shock - p.entry_price) / p.entry_price
                net_loss -= pnl_at_shock
            if net_loss > worst_loss_for_class:
                worst_loss_for_class = net_loss
        class_worst += worst_loss_for_class

    total_notional = sum(abs(p.notional_signed) for p in positions)
    floor = total_notional * MIN_INITIAL_MARGIN_BPS / 10_000
    with_buffer = class_worst * (1 + MAINT_BUFFER_BPS / 10_000)
    return max(with_buffer, floor)


def fetch_synthetic_pairs_from_candles(start: datetime, end: datetime, limit: int) -> list[Trade]:
    """Build SYNTHETIC perfectly-hedged trade pairs from Hyperliquid candles.

    This is NOT a real trader-history backtest. The Hyperliquid public
    /info endpoint exposes candles (OHLC), not per-trader trade ticks; the
    full archive requires the founder's paid API key. This function fakes
    a hedged-pair portfolio at each candle close so the SPAN math has
    something to chew on for harness sanity checks.

    Renamed from `fetch_hyperliquid_trades` (pre-fix name), the old name
    falsely implied "real Hyperliquid trade history" to anyone reading the
    main() flow. Output downstream MUST flag `data_mode: synthetic-pairs`
    so the on-chain ResearchAttestation consumer can refuse to render this
    as a real backtest claim.
    """
    url = "https://api.hyperliquid.xyz/info"
    payload = {
        "type": "candleSnapshot",
        "req": {
            "coin": "AAPL",
            "interval": "1h",
            "startTime": int(start.timestamp() * 1000),
            "endTime": int(end.timestamp() * 1000),
        },
    }
    with httpx.Client(timeout=10.0) as client:
        r = client.post(url, json=payload)
        r.raise_for_status()
        rows = r.json()
    # Audit fix (iteration 28): Hyperliquid sometimes returns an error
    # object {"error": "..."} instead of an array on rate-limit or bad
    # input. Pre-fix `len(rows)` would TypeError, but only AFTER printing
    # a warn line that looked like it was reading the array. Bail on a
    # non-list response so the error path is unambiguous.
    if not isinstance(rows, list):
        raise RuntimeError(f"Hyperliquid /info returned non-list response: {rows!r}")
    # Audit fix: docstring promised "abort cleanly if it can't fetch
    # enough data rather than padding the result" but pre-fix code only
    # warned. Restore the contract: refuse to run with under half the
    # requested sample, since the SPAN savings number is meaningless on
    # tiny samples.
    if len(rows) < max(1, limit // 2):
        raise RuntimeError(
            f"only {len(rows)} candles returned (asked for {limit}); "
            f"refusing to run backtest with too-small sample"
        )
    out: list[Trade] = []
    for i, row in enumerate(rows[:limit]):
        out.append(Trade(
            trader=f"synthetic-{i % 100:03d}",
            timestamp=datetime.fromtimestamp(row["t"] / 1000),
            instrument="AAPL-USD-PERP",
            notional_signed=10_000.0 if i % 2 == 0 else -10_000.0,
            entry_price=float(row["c"]),
            correlation_class=0,
        ))
    return out


def fetch_real_trades(start: datetime, end: datetime, limit: int) -> list[Trade]:
    """Fetch real per-trader Hyperliquid HIP-3 trade history.

    This path requires the founder's paid Hyperliquid archive key. The
    public /info endpoint does not expose per-trader history, so this
    cannot be a public-API implementation. Tracked as Wave-1 engineering;
    until wired, raise a clear error so nobody publishes a "real-trades"
    backtest that's actually synthetic.
    """
    _ = (start, end, limit)  # silence unused-arg lint
    raise NotImplementedError(
        "real-trades data mode not wired (requires paid Hyperliquid archive API). "
        "Use --data-mode synthetic-pairs for harness testing only, its results "
        "must not be published as a real backtest claim."
    )


def group_into_portfolios(trades: list[Trade]) -> list[PortfolioSnapshot]:
    by_trader = defaultdict(list)
    for t in trades:
        by_trader[t.trader].append(t)
    return [PortfolioSnapshot(trader=k, positions=v) for k, v in by_trader.items()]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", required=True)
    ap.add_argument("--end", required=True)
    ap.add_argument("--limit", type=int, default=500)
    ap.add_argument("--output", required=True)
    # Audit fix (iteration 28): the data-mode gate is REQUIRED, no
    # default. Pre-fix `fetch_hyperliquid_trades` silently synthesized
    # hedged pairs from candle data, but the result was published on-chain
    # as a real "Q1 2026 backtest" via ResearchAttestation. Now operators
    # must explicitly pick the mode; the synthetic path's JSON output is
    # tagged so the verify-app refuses to render it as a published claim.
    ap.add_argument(
        "--data-mode",
        required=True,
        choices=["real-trades", "synthetic-pairs"],
        help=(
            "real-trades: paid HL archive (Wave-1, not yet wired). "
            "synthetic-pairs: harness sanity check, output tagged "
            "synthetic; MUST NOT be published as a real backtest."
        ),
    )
    args = ap.parse_args()

    start = datetime.fromisoformat(args.start)
    end = datetime.fromisoformat(args.end)

    try:
        if args.data_mode == "real-trades":
            trades = fetch_real_trades(start, end, args.limit)
        else:
            trades = fetch_synthetic_pairs_from_candles(start, end, args.limit)
    except httpx.HTTPError as e:
        print(f"ERROR: could not fetch source data: {e}")
        return 2
    except (RuntimeError, NotImplementedError) as e:
        # Audit fix: structurally distinct failure mode (sample too small,
        # wrong response shape, not-yet-wired path). Exit 4 so cron + CI
        # can distinguish "data source unavailable" from "data source
        # refused to provide usable data".
        print(f"ERROR: backtest pre-conditions not met: {e}")
        return 4

    if not trades:
        print("ERROR: no trades fetched; refusing to write a fake result")
        return 3

    portfolios = group_into_portfolios(trades)
    for p in portfolios:
        p.isolated_margin_required = isolated_margin_required(p.positions)
        p.atrium_span_margin_required = atrium_span_margin_required(p.positions)

    total_isolated = sum(p.isolated_margin_required for p in portfolios)
    total_atrium = sum(p.atrium_span_margin_required for p in portfolios)
    avg_saving_bps = 0
    if total_isolated > 0:
        avg_saving_bps = round((total_isolated - total_atrium) / total_isolated * 10_000)

    result = {
        "schema_version": 2,
        # Audit fix: pre-fix used `datetime.utcnow().isoformat() + "Z"`
        # which is deprecated in Python 3.12+. `now(timezone.utc)` carries
        # tzinfo and ISO-formats with "+00:00", equivalent semantics,
        # future-proof.
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period_start": args.start,
        "period_end": args.end,
        # Audit fix (iteration 28): data_mode propagates into the JSON so
        # downstream consumers (IPFS pinner, verify-app) can refuse to
        # display or publish synthetic results as real backtest claims.
        # Schema bump to v2 signals the new field is required.
        "data_mode": args.data_mode,
        "is_publishable": args.data_mode == "real-trades",
        "trades_count": len(trades),
        "portfolio_count": len(portfolios),
        "total_isolated_margin": total_isolated,
        "total_atrium_margin": total_atrium,
        "average_saving_bps": avg_saving_bps,
        "per_portfolio": [
            {
                "trader": p.trader,
                "positions_count": len(p.positions),
                "isolated_required": p.isolated_margin_required,
                "atrium_required": p.atrium_span_margin_required,
                "saving_bps": p.saving_bps,
            }
            for p in portfolios
        ],
    }
    Path(args.output).write_text(json.dumps(result, indent=2))
    print(f"WROTE {args.output}")
    print(f"data_mode={args.data_mode}  trades_count={len(trades)}  avg_saving_bps={avg_saving_bps}")
    if args.data_mode == "synthetic-pairs":
        print("WARNING: synthetic-pairs output. MUST NOT be published as a real backtest.")
        print("The output JSON carries is_publishable=false; downstream consumers honor that flag.")
    else:
        print("Next step: pin to IPFS and call ResearchAttestation.publish(ipfs_hash, trades_count, avg_saving_bps, notebook_url)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
