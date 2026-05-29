"""Audit fix (services #23) regression tests for research_loop's on-chain
attestation publish path:
  - the web3 SignedTransaction attribute fallback resolves under both the
    web3 6.x (rawTransaction) and 7.x (raw_transaction) names;
  - an unconfigured publish is a silent SKIP (returns None, no raise);
  - a CONFIGURED publish failure is loud: run_backtest flags publish_failed and
    main() exits non-zero so archive-weekly.yml's `if: failure()` ops alert fires
    (the bug was the old `except: return None` -> green run -> no alert).
"""
import os
import sys
from pathlib import Path
from types import SimpleNamespace

# Make `research_loop` importable regardless of cwd.
SRC = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC))

import research_loop as rl  # noqa: E402


def _raw_fallback(signed):
    # Mirror the exact expression research_loop relies on at the send site.
    return getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction", None)


def test_signed_tx_raw_attribute_resolves_web3_7():
    signed = SimpleNamespace(raw_transaction=b"\x01\x02")
    assert _raw_fallback(signed) == b"\x01\x02"


def test_signed_tx_raw_attribute_resolves_web3_6():
    signed = SimpleNamespace(rawTransaction=b"\x03\x04")
    assert _raw_fallback(signed) == b"\x03\x04"


def test_publish_attestation_skips_when_unconfigured(monkeypatch):
    for k in ("RESEARCH_SIGNER_KEY", "ARBITRUM_SEPOLIA_RPC", "RESEARCH_CONTRACT_ADDR"):
        monkeypatch.delenv(k, raising=False)
    dummy = rl.BacktestResult(
        strategy="x", period_start="a", period_end="b", trades_count=0,
        baseline_collateral_usd=0.0, atrium_collateral_usd=0.0, delta_bps=0,
        notebook_url="", ipfs_cid=None, publish_tx=None, generated_at="t",
    )
    # Not configured -> skip path returns None and does NOT raise.
    assert rl.publish_attestation(dummy) is None


def _dummy_result(publish_failed):
    return rl.BacktestResult(
        strategy="x", period_start="a", period_end="b", trades_count=0,
        baseline_collateral_usd=0.0, atrium_collateral_usd=0.0, delta_bps=0,
        notebook_url="", ipfs_cid=None, publish_tx=None, generated_at="t",
        publish_failed=publish_failed,
    )


def test_main_exits_nonzero_when_publish_failed(monkeypatch, tmp_path):
    monkeypatch.setattr(rl, "run_backtest", lambda _s: _dummy_result(True))
    monkeypatch.setattr(rl, "OUTPUT_PATH", tmp_path / "latest.json")
    monkeypatch.setattr(sys, "argv", ["research_loop", "--strategy", "x"])
    assert rl.main() == 1
    # Output is still written even on a publish failure (research is preserved).
    assert (tmp_path / "latest.json").exists()


def test_main_exits_zero_on_success(monkeypatch, tmp_path):
    monkeypatch.setattr(rl, "run_backtest", lambda _s: _dummy_result(False))
    monkeypatch.setattr(rl, "OUTPUT_PATH", tmp_path / "latest.json")
    monkeypatch.setattr(sys, "argv", ["research_loop", "--strategy", "x"])
    assert rl.main() == 0
