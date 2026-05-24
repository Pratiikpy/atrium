"""Unit tests for German FIFO tax calculator — § 23 EStG.

Iter 76 audit fix: pins the § 23 EStG holding-period exemption flag
on src/jurisdictions/de.py. Pre-iter-76 zero tests pinned this
despite German taxpayers depending on the holding-period flag to
decide whether to claim Spekulationsfrist exemption.

Note: the calculator FLAGS long-held positions but does NOT assert
exemption. The flag triggers `flag_exemption_review: True` so the
exporter renders "verify with tax adviser" — honest given recent
contested rulings on crypto holdings.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from src.jurisdictions.de import calculate_de_fifo, HOLDING_EXEMPTION_DAYS
from src.models import Trade


def t(day_offset: int, side: str, qty: float, price: float, venue_id: int = 1, instrument_id: str = "0xaaaa") -> Trade:
    return Trade(
        timestamp=datetime(2026, 1, 1) + timedelta(days=day_offset),
        venue_id=venue_id,
        instrument_id=instrument_id,
        side=side,  # type: ignore[arg-type]
        quantity=qty,
        price=price,
    )


# ── FIFO matching ─────────────────────────────────────────────────────


def test_fifo_matches_oldest_lot_first():
    trades = [
        t(0, "buy", 100, 5.0),    # older
        t(10, "buy", 100, 7.0),   # newer
        t(50, "sell", 100, 10.0),
    ]
    report = calculate_de_fifo(trades)
    assert len(report.disposals) == 1
    # FIFO: matches the $5 lot. Gain = (10 - 5) * 100 = 500 EUR.
    assert report.disposals[0].cost_basis_eur == 500.0
    assert report.disposals[0].proceeds_eur == 1000.0
    assert report.disposals[0].gain_eur == 500.0


def test_partial_fifo_match_leaves_remainder_in_pool():
    # Buy 100, sell 60 → 1 disposal of 60; remaining 40 carries forward.
    trades = [
        t(0, "buy", 100, 5.0),
        t(10, "sell", 60, 10.0),
        t(20, "sell", 40, 12.0),  # consume the rest
    ]
    report = calculate_de_fifo(trades)
    assert len(report.disposals) == 2
    assert report.disposals[0].quantity == 60
    assert report.disposals[1].quantity == 40
    # Second disposal's basis still from the original $5 lot.
    assert report.disposals[1].cost_basis_eur == 40 * 5.0


def test_sell_spanning_multiple_lots_produces_multiple_disposals():
    # Two lots @ $5 and $7. Sell 150 → 100 from first lot + 50 from second.
    trades = [
        t(0, "buy", 100, 5.0),
        t(5, "buy", 100, 7.0),
        t(50, "sell", 150, 10.0),
    ]
    report = calculate_de_fifo(trades)
    assert len(report.disposals) == 2
    # First disposal from $5 lot: gain = (10 - 5) * 100 = 500.
    assert report.disposals[0].gain_eur == 500.0
    # Second from $7 lot: gain = (10 - 7) * 50 = 150.
    assert report.disposals[1].gain_eur == 150.0


# ── Per-asset-per-venue isolation (§ 23 EStG strict reading) ──────────


def test_pools_isolated_by_venue_id():
    # Same instrument on different venues = separate pools per § 23 EStG
    # strict reading. A sell on venue 2 with empty inventory must NOT
    # match against the venue-1 buy.
    trades = [
        t(0, "buy", 100, 5.0, venue_id=1),
        t(10, "sell", 100, 10.0, venue_id=2),
    ]
    report = calculate_de_fifo(trades)
    # The sell on venue 2 has no matching pool → no disposal row created
    # (this calculator's behavior; unlike US it doesn't generate phantom
    # income rows). Confirm the venue-1 buy is NOT consumed.
    # Subsequent venue-1 sale must match the original lot intact.
    venue1_sell = [t(50, "sell", 100, 11.0, venue_id=1)]
    report2 = calculate_de_fifo(trades + venue1_sell)
    venue1_disposals = [d for d in report2.disposals if "venue:1" in d.asset_key]
    assert len(venue1_disposals) == 1
    assert venue1_disposals[0].quantity == 100


def test_pools_isolated_by_instrument():
    trades = [
        t(0, "buy", 100, 5.0, instrument_id="0xbtc"),
        t(10, "sell", 50, 10.0, instrument_id="0xeth"),
    ]
    report = calculate_de_fifo(trades)
    # ETH sell has no pool → no disposal. BTC pool intact.
    assert len(report.disposals) == 0


# ── Spekulationsfrist (1-year holding-period exemption flag) ──────────


def test_flag_exemption_review_when_held_above_365_days():
    # Held 400 days (> 365) → flag_exemption_review = True.
    trades = [t(0, "buy", 100, 5.0), t(400, "sell", 100, 10.0)]
    report = calculate_de_fifo(trades)
    assert report.disposals[0].flag_exemption_review is True
    assert report.disposals[0].holding_days == 400


def test_flag_exemption_review_NOT_set_within_365_days():
    trades = [t(0, "buy", 100, 5.0), t(200, "sell", 100, 10.0)]
    report = calculate_de_fifo(trades)
    assert report.disposals[0].flag_exemption_review is False


def test_holding_threshold_boundary_strictly_greater_than_365():
    # Exactly 365 days → NOT flagged. Threshold is `> 365` strict.
    trades = [t(0, "buy", 100, 5.0), t(HOLDING_EXEMPTION_DAYS, "sell", 100, 10.0)]
    report = calculate_de_fifo(trades)
    assert report.disposals[0].flag_exemption_review is False

    # 366 days → flagged.
    trades2 = [t(0, "buy", 100, 5.0), t(HOLDING_EXEMPTION_DAYS + 1, "sell", 100, 10.0)]
    report2 = calculate_de_fifo(trades2)
    assert report2.disposals[0].flag_exemption_review is True


# ── Report aggregation ────────────────────────────────────────────────


def test_total_gain_sums_only_positive_gains():
    # Mix of gain + loss disposals. total_gain_eur sums only the gains.
    trades = [
        t(0, "buy", 100, 5.0),
        t(50, "sell", 100, 10.0),   # gain 500
        t(60, "buy", 100, 15.0),
        t(100, "sell", 100, 12.0),  # loss -300
    ]
    report = calculate_de_fifo(trades)
    assert report.total_gain_eur == 500.0
    assert report.total_loss_eur == 300.0  # absolute value


def test_zero_gain_disposal_classified_neither_gain_nor_loss():
    # Sell at cost = no gain, no loss. Aggregates should both be 0.
    trades = [t(0, "buy", 100, 10.0), t(50, "sell", 100, 10.0)]
    report = calculate_de_fifo(trades)
    assert report.disposals[0].gain_eur == 0.0
    assert report.total_gain_eur == 0.0
    assert report.total_loss_eur == 0.0


def test_iso_date_formatting_in_disposal_row():
    # Spot-check date serialization is ISO yyyy-mm-dd (string), as expected
    # by the CSV/PDF exporters downstream.
    trades = [t(0, "buy", 100, 5.0), t(50, "sell", 100, 10.0)]
    report = calculate_de_fifo(trades)
    assert report.disposals[0].date_acquired == "2026-01-01"
    assert report.disposals[0].date_sold == "2026-02-20"  # day 50 after 2026-01-01
