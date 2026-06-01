"""Unit tests for US Form 8949 calculator, IRS Publication 544 + IRC §1091.

Iter 76 audit fix: pins the I-8 wash-sale fix on
src/jurisdictions/us.py. Pre-iter-76 zero tests pinned it despite
the IRS §1091 wash-sale rule being a load-bearing tax-correctness
invariant for any US user with offsetting buys around losses.

- I-8: pre-fix the wash-sale loop had a bare `pass` in its inner
  body, so wash sales were never marked (`wash_sale_flag` stayed
  False) AND the disallowed loss never propagated forward to the
  replacement-share basis. Users would receive Form 8949 rows
  reporting a loss the IRS would have disallowed, a tax-fraud
  audit risk on its face.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from src.jurisdictions.us import calculate_us_form_8949, LONG_TERM_THRESHOLD_DAYS
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


# ── Short-term vs long-term classification ────────────────────────────


def test_short_term_when_held_below_365_days():
    # Buy day 0, sell day 200 → 200 days held → short-term.
    trades = [t(0, "buy", 100, 10.0), t(200, "sell", 100, 12.0)]
    report = calculate_us_form_8949(trades)
    assert len(report.short_term) == 1
    assert len(report.long_term) == 0
    assert report.short_term[0].holding_period == "short"
    assert report.short_term[0].gain == 200.0


def test_long_term_when_held_above_365_days():
    # Buy day 0, sell day 400 → > 365 days → long-term.
    trades = [t(0, "buy", 100, 10.0), t(400, "sell", 100, 12.0)]
    report = calculate_us_form_8949(trades)
    assert len(report.long_term) == 1
    assert len(report.short_term) == 0
    assert report.long_term[0].holding_period == "long"


def test_holding_threshold_boundary_is_strictly_greater_than_365():
    # Exactly 365 days held → SHORT-term (rule is > 1 year).
    trades = [t(0, "buy", 100, 10.0), t(LONG_TERM_THRESHOLD_DAYS, "sell", 100, 12.0)]
    report = calculate_us_form_8949(trades)
    assert len(report.short_term) == 1
    assert len(report.long_term) == 0

    # 366 days → long-term.
    trades2 = [t(0, "buy", 100, 10.0), t(LONG_TERM_THRESHOLD_DAYS + 1, "sell", 100, 12.0)]
    report2 = calculate_us_form_8949(trades2)
    assert len(report2.long_term) == 1
    assert len(report2.short_term) == 0


# ── FIFO matching ─────────────────────────────────────────────────────


def test_fifo_matches_oldest_lot_first():
    # Two buys at different prices, one sell. FIFO matches the older lot.
    trades = [
        t(0, "buy", 100, 5.0),    # older basis $5
        t(10, "buy", 100, 7.0),   # newer basis $7
        t(50, "sell", 100, 10.0), # sell 100 @ $10
    ]
    report = calculate_us_form_8949(trades)
    assert len(report.short_term) == 1
    # FIFO: matches the $5 lot, gain = (10 - 5) * 100 = 500.
    assert report.short_term[0].cost_basis == 500.0
    assert report.short_term[0].proceeds == 1000.0
    assert report.short_term[0].gain == 500.0


def test_partial_fifo_match_splits_lot():
    # Buy 100, then sell 60. Lot of 40 remains.
    trades = [t(0, "buy", 100, 5.0), t(10, "sell", 60, 10.0)]
    report = calculate_us_form_8949(trades)
    assert len(report.short_term) == 1
    # 60 @ $10 proceeds = 600; 60 @ $5 basis = 300; gain = 300.
    assert report.short_term[0].proceeds == 600.0
    assert report.short_term[0].cost_basis == 300.0


def test_phantom_income_when_sale_exceeds_inventory():
    # Sell 100 with empty inventory → row with cost_basis=0 + "(unmatched)" label.
    trades = [t(0, "sell", 100, 10.0)]
    report = calculate_us_form_8949(trades)
    assert len(report.short_term) == 1
    row = report.short_term[0]
    assert row.cost_basis == 0.0
    assert row.proceeds == 1000.0
    assert "unmatched" in row.description


def test_per_asset_inventory_isolated_across_instruments():
    # Buying BTC and selling ETH must NOT match against each other.
    trades = [
        t(0, "buy", 100, 5.0, instrument_id="0xbtc"),
        t(10, "sell", 50, 8.0, instrument_id="0xeth"),
    ]
    report = calculate_us_form_8949(trades)
    # ETH sale has zero inventory → phantom income row.
    assert len(report.short_term) == 1
    assert report.short_term[0].cost_basis == 0.0


# ── I-8: §1091 wash-sale rule (load-bearing audit fix) ────────────────


def test_wash_sale_flag_set_when_replacement_buy_within_30_days():
    # Sell at a loss, then buy "substantially identical" security within 30 days.
    # IRC §1091: loss disallowed, basis bumped on replacement.
    trades = [
        t(0, "buy", 100, 10.0),     # acquire at $10
        t(5, "sell", 100, 8.0),     # sell at loss ($200 loss)
        t(15, "buy", 100, 9.0),     # replacement buy within 30 days
    ]
    report = calculate_us_form_8949(trades)
    # The disposal row at day 5 must be wash-sale-flagged.
    assert len(report.short_term) == 1
    assert report.short_term[0].wash_sale_flag is True
    # Pre-I-8: this was False (bare `pass` in the inner if).


def test_wash_sale_NOT_flagged_when_replacement_buy_outside_30_days():
    # Replacement buy > 30 days after loss → wash-sale window not triggered.
    trades = [
        t(0, "buy", 100, 10.0),
        t(5, "sell", 100, 8.0),     # loss
        t(40, "buy", 100, 9.0),     # too late
    ]
    report = calculate_us_form_8949(trades)
    assert report.short_term[0].wash_sale_flag is False


def test_wash_sale_NOT_flagged_when_disposal_was_a_gain():
    # §1091 only applies to losses. A gain disposal with a replacement buy
    # within 30 days must NOT be flagged.
    trades = [
        t(0, "buy", 100, 10.0),
        t(5, "sell", 100, 12.0),    # gain (+$200)
        t(15, "buy", 100, 11.0),    # within 30 days
    ]
    report = calculate_us_form_8949(trades)
    assert report.short_term[0].wash_sale_flag is False


def test_wash_sale_bumps_basis_of_replacement_lot():
    # The disallowed loss is added to the basis of the replacement lot.
    # Setup: lose $200 then buy 100 replacement shares at $9. Replacement
    # basis becomes $9 + ($200 / 100) = $11 per unit. Then sell those for
    # $12 → gain should be ($12 - $11) * 100 = $100, NOT $300 (which is
    # what naive (no-basis-bump) accounting would report).
    trades = [
        t(0, "buy", 100, 10.0),
        t(5, "sell", 100, 8.0),     # $200 loss → wash sale → disallow + bump replacement
        t(15, "buy", 100, 9.0),     # replacement; basis bumped to $11
        t(50, "sell", 100, 12.0),   # later disposal of the bumped lot
    ]
    report = calculate_us_form_8949(trades)
    # Two disposals.
    assert len(report.short_term) == 2
    # First is the wash sale.
    assert report.short_term[0].wash_sale_flag is True
    # Second is the post-replacement sell. Cost basis should reflect the
    # bumped basis: 100 * $11 = $1100. Proceeds: 100 * $12 = $1200. Gain $100.
    second = report.short_term[1]
    assert second.cost_basis == 1100.0
    assert second.proceeds == 1200.0
    assert second.gain == 100.0


def test_wash_sale_does_not_double_flag_same_disposal():
    # If two replacement buys happen within 30 days, the SAME disposal
    # must only be flagged once. Pre-fix this could double-bump the basis.
    trades = [
        t(0, "buy", 100, 10.0),
        t(5, "sell", 100, 8.0),     # $200 loss
        t(10, "buy", 100, 9.0),     # replacement A
        t(20, "buy", 100, 9.0),     # replacement B, must NOT re-flag
    ]
    report = calculate_us_form_8949(trades)
    # Only the day-5 disposal exists. Flagged once.
    assert len(report.short_term) == 1
    assert report.short_term[0].wash_sale_flag is True


# ── Report aggregation ────────────────────────────────────────────────


def test_short_term_total_sums_gains():
    trades = [
        t(0, "buy", 100, 5.0),
        t(50, "sell", 100, 10.0),    # gain 500
        t(100, "buy", 100, 7.0),
        t(150, "sell", 100, 12.0),   # gain 500
    ]
    report = calculate_us_form_8949(trades)
    assert report.short_term_total == 1000.0


def test_long_term_total_sums_gains():
    trades = [
        t(0, "buy", 100, 5.0),
        t(400, "sell", 100, 10.0),   # long-term, gain 500
    ]
    report = calculate_us_form_8949(trades)
    assert report.long_term_total == 500.0
    assert report.short_term_total == 0.0
