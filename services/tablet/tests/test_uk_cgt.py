"""Unit tests for UK CGT calculator, matches HMRC HS284 worked examples."""

from __future__ import annotations

from datetime import datetime, timedelta

from src.jurisdictions.uk import calculate_uk_cgt
from src.models import Trade


def t(day_offset: int, side: str, qty: float, price: float) -> Trade:
    return Trade(
        timestamp=datetime(2026, 4, 6) + timedelta(days=day_offset),
        venue_id=1,
        instrument_id="0xaaaa",
        side=side,  # type: ignore[arg-type]
        quantity=qty,
        price=price,
    )


def test_same_day_rule_offsets_basis():
    # Buy 100 @ 10, sell 100 @ 12 same day → gain = 200, all matched same-day
    trades = [t(0, "buy", 100, 10.0), t(0, "sell", 100, 12.0)]
    report = calculate_uk_cgt(trades)
    assert len(report.disposals) == 1
    d = report.disposals[0]
    assert d.proceeds == 1200.0
    assert d.cost == 1000.0
    assert d.gain == 200.0


def test_bed_and_breakfasting_30_day_rule():
    # Buy 100 @ 10 (day 0). Sell 100 @ 15 day 10. Buy 100 @ 11 day 20.
    # Same-day: 0 matched.
    # BnB rule matches the day-20 buy (within 30 days after sale).
    trades = [
        t(0, "buy", 100, 10.0),
        t(10, "sell", 100, 15.0),
        t(20, "buy", 100, 11.0),
    ]
    report = calculate_uk_cgt(trades)
    assert len(report.disposals) == 1
    d = report.disposals[0]
    assert d.proceeds == 1500.0
    # BnB matches against the day-20 buy at 11.0
    assert sum(m.quantity for m in d.matched_bnb) == 100.0
    assert d.cost == 1100.0  # 100 @ 11
    assert d.gain == 400.0


def test_s104_pool_rule_when_no_matches():
    # Two old buys forming a pool. Disposal happens months later.
    trades = [
        t(0, "buy", 100, 10.0),
        t(5, "buy", 100, 12.0),
        t(60, "sell", 50, 14.0),
    ]
    report = calculate_uk_cgt(trades)
    assert len(report.disposals) == 1
    d = report.disposals[0]
    # Pool avg cost = (1000+1200)/200 = 11; 50 sold → cost = 550
    assert d.proceeds == 700.0
    assert abs(d.cost - 550.0) < 1e-6
    assert abs(d.gain - 150.0) < 1e-6
