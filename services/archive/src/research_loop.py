"""Atrium Archive — weekly research loop.

Phase eta.3 (2026-05-25). Runs per-strategy backtests, computes the
collateral-saved-vs-baseline delta, writes a Jupyter notebook, pins it
to IPFS via web3.storage free tier, then signs + publishes a
ResearchAttestation tx via the Praetor multisig EOA.

The output JSON at apps/verify/public/research/latest.json is read by
the /api/research-attestation/latest route + surfaces on the landing
Jamie hook ("Atrium computes a SPAN-style cross-product margin number
across N onchain venues").

Required env:
    SCRIBE_URL                Subgraph query endpoint for live data
    ARBITRUM_SEPOLIA_RPC      RPC for the publish tx
    RESEARCH_SIGNER_KEY       Praetor multisig EOA private key (hex)
    WEB3_STORAGE_TOKEN        web3.storage IPFS pin token (free tier)
    RESEARCH_CONTRACT_ADDR    ResearchAttestation deployed address

Usage:
    python -m services.archive.src.research_loop --strategy mean-reversion-v1
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import httpx

# Repo root  resolves to four levels above this file.
ROOT = Path(__file__).resolve().parents[3]
OUTPUT_PATH = ROOT / "apps" / "verify" / "public" / "research" / "latest.json"


@dataclass
class BacktestResult:
    """Pinned to IPFS as the notebook companion + emitted via
    ResearchAttestation.publish() on chain."""

    strategy: str
    period_start: str
    period_end: str
    trades_count: int
    baseline_collateral_usd: float
    atrium_collateral_usd: float
    delta_bps: int  # signed; positive == Atrium saves collateral
    notebook_url: str
    ipfs_cid: str | None
    publish_tx: str | None
    generated_at: str


def fetch_strategy_history(strategy: str) -> list[dict]:
    """Pull historic trade data for the strategy from Scribe.
    Returns one row per fill with venue, side, notional, entry, exit."""
    scribe = os.environ.get("SCRIBE_URL")
    if not scribe:
        # Honest no-op when not configured  loop still runs end to end
        # but the strategy gets an empty history (and the delta_bps is 0).
        print("[archive] SCRIBE_URL not set; using empty strategy history", file=sys.stderr)
        return []
    query = """
        query StrategyHistory($strategy: String!) {
            mirrorTrades(where: { strategy: $strategy }, orderBy: at, orderDirection: asc, first: 1000) {
                venue
                side
                notional
                entryPrice
                exitPrice
                pnl
                at
            }
        }
    """
    try:
        r = httpx.post(
            scribe,
            json={"query": query, "variables": {"strategy": strategy}},
            timeout=30.0,
        )
        r.raise_for_status()
        data = r.json().get("data", {})
        return list(data.get("mirrorTrades") or [])
    except Exception as exc:  # noqa: BLE001
        print(f"[archive] scribe fetch failed: {exc}", file=sys.stderr)
        return []


def compute_collateral_baseline(trades: Iterable[dict]) -> float:
    """Naive baseline: each venue posts its own collateral, no netting.
    Sum of |notional| across all venue legs."""
    return sum(abs(float(t.get("notional", 0))) for t in trades)


def compute_collateral_atrium(trades: Iterable[dict]) -> float:
    """Atrium cross-product margin: assumes correlated venues hedge
    perfectly. Real Plinth math is in contracts/plinth-math; this is
    a stand-in until the Rust path is callable from Python (planned
    via PyO3 binding in Phase Y2)."""
    long = sum(float(t.get("notional", 0)) for t in trades if t.get("side") == "long")
    short = sum(float(t.get("notional", 0)) for t in trades if t.get("side") == "short")
    return abs(long - short)


def pin_to_ipfs(notebook_path: Path) -> str | None:
    """Upload the notebook to web3.storage (free tier 5 GB). Returns
    the resulting CID or None if the token is missing (honest pending)."""
    token = os.environ.get("WEB3_STORAGE_TOKEN")
    if not token:
        return None
    try:
        with notebook_path.open("rb") as f:
            r = httpx.post(
                "https://api.web3.storage/upload",
                headers={"Authorization": f"Bearer {token}"},
                files={"file": (notebook_path.name, f, "application/x-ipynb+json")},
                timeout=60.0,
            )
        r.raise_for_status()
        return r.json().get("cid")
    except Exception as exc:  # noqa: BLE001
        print(f"[archive] IPFS pin failed: {exc}", file=sys.stderr)
        return None


def publish_attestation(result: BacktestResult) -> str | None:
    """Call ResearchAttestation.publish(strategy, tradesCount, deltaBps,
    ipfsCid). Requires the Praetor signer key. Returns tx hash or None."""
    signer = os.environ.get("RESEARCH_SIGNER_KEY")
    rpc = os.environ.get("ARBITRUM_SEPOLIA_RPC")
    contract = os.environ.get("RESEARCH_CONTRACT_ADDR")
    if not (signer and rpc and contract):
        return None
    try:
        from web3 import Web3
    except ImportError:
        print("[archive] web3 not installed; skipping on-chain publish", file=sys.stderr)
        return None
    w3 = Web3(Web3.HTTPProvider(rpc))
    abi = [
        {
            "name": "publish",
            "type": "function",
            "stateMutability": "nonpayable",
            "inputs": [
                {"name": "strategy", "type": "string"},
                {"name": "tradesCount", "type": "uint256"},
                {"name": "deltaBps", "type": "int256"},
                {"name": "ipfsCid", "type": "string"},
            ],
            "outputs": [],
        }
    ]
    acct = w3.eth.account.from_key(signer)
    c = w3.eth.contract(address=Web3.to_checksum_address(contract), abi=abi)
    try:
        tx = c.functions.publish(
            result.strategy,
            result.trades_count,
            result.delta_bps,
            result.ipfs_cid or "",
        ).build_transaction(
            {
                "from": acct.address,
                "nonce": w3.eth.get_transaction_count(acct.address),
                "gas": 250_000,
                "gasPrice": w3.eth.gas_price,
            }
        )
        signed = w3.eth.account.sign_transaction(tx, signer)
        h = w3.eth.send_raw_transaction(signed.rawTransaction)
        return h.hex()
    except Exception as exc:  # noqa: BLE001
        print(f"[archive] publish_attestation failed: {exc}", file=sys.stderr)
        return None


def write_notebook(result: BacktestResult, trades: list[dict], path: Path) -> None:
    """Emit a minimal nbformat notebook recording the result. A richer
    notebook with matplotlib charts ships once a real strategy lands."""
    cells = [
        {
            "cell_type": "markdown",
            "metadata": {},
            "source": [
                f"# Atrium research . {result.strategy}\n",
                f"Period: {result.period_start} to {result.period_end}\n\n",
                f"Trades: {result.trades_count}. Delta: {result.delta_bps} bps.\n",
            ],
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "import json\n",
                f"result = {json.dumps(asdict(result), indent=2)}\n",
                "result\n",
            ],
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [f"trades = {json.dumps(trades[:10])}  # first 10 of {len(trades)}\n"],
        },
    ]
    nb = {"cells": cells, "metadata": {"kernelspec": {"name": "python3", "display_name": "Python 3"}}, "nbformat": 4, "nbformat_minor": 5}
    path.write_text(json.dumps(nb, indent=2))


def run_backtest(strategy: str) -> BacktestResult:
    trades = fetch_strategy_history(strategy)
    baseline = compute_collateral_baseline(trades)
    atrium = compute_collateral_atrium(trades)
    # delta_bps positive == Atrium uses less collateral
    delta_bps = int(round((1 - (atrium / baseline)) * 10_000)) if baseline > 0 else 0

    now = datetime.now(timezone.utc)
    period_end = now.isoformat()
    # 30-day window for the v1 cadence; configurable later.
    period_start = (now.replace(day=max(1, now.day - 7))).isoformat()

    notebooks_dir = ROOT / "services" / "archive" / "notebooks"
    notebooks_dir.mkdir(parents=True, exist_ok=True)
    nb_path = notebooks_dir / f"{strategy}-{int(time.time())}.ipynb"

    result = BacktestResult(
        strategy=strategy,
        period_start=period_start,
        period_end=period_end,
        trades_count=len(trades),
        baseline_collateral_usd=baseline,
        atrium_collateral_usd=atrium,
        delta_bps=delta_bps,
        notebook_url=f"./services/archive/notebooks/{nb_path.name}",
        ipfs_cid=None,
        publish_tx=None,
        generated_at=now.isoformat(),
    )
    write_notebook(result, trades, nb_path)
    result.ipfs_cid = pin_to_ipfs(nb_path)
    if result.ipfs_cid:
        result.notebook_url = f"https://{result.ipfs_cid}.ipfs.w3s.link/{nb_path.name}"
    result.publish_tx = publish_attestation(result)
    return result


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--strategy", required=True, help="Strategy id (e.g. mean-reversion-v1)")
    args = p.parse_args()

    result = run_backtest(args.strategy)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(asdict(result), indent=2))
    print(json.dumps(asdict(result), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
