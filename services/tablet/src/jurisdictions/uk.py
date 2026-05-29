"""UK Capital Gains Tax — same-day → bed-and-breakfasting → s.104 pool.

References:
  - HMRC HS284 "Shares and Capital Gains Tax"
  - HMRC SA108 form schema

Algorithm:
  1. For each disposal (sell), match against:
     (a) Acquisitions on the SAME day (same-day rule)
     (b) Acquisitions within 30 days AFTER the disposal (bed-and-breakfasting rule)
     (c) Remaining basis from the s.104 average-cost pool
  2. Pool maintains running quantity and total cost; cost per unit = total / qty.
  3. Output: per-disposal gain/loss + per-asset totals.

Year-1 simplification: per-asset s.104 pool keyed by (venue_id, instrument_id).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Iterable

from ..models import Trade
from ..fx_rates import get_usd_to_gbp_rate, FxRateUnavailable


@dataclass
class DisposalReport:
    disposal: Trade
    matched_same_day: list[Trade] = field(default_factory=list)
    matched_bnb: list[Trade] = field(default_factory=list)
    matched_pool_qty: float = 0.0
    matched_pool_cost: float = 0.0
    proceeds: float = 0.0
    cost: float = 0.0

    @property
    def gain(self) -> float:
        return self.proceeds - self.cost


@dataclass
class CgtReport:
    disposals: list[DisposalReport]
    total_gain: float
    total_loss: float

    @property
    def net(self) -> float:
        return self.total_gain - self.total_loss


@dataclass
class Pool:
    qty: float = 0.0
    cost: float = 0.0

    def add(self, qty: float, cost: float) -> None:
        self.qty += qty
        self.cost += cost

    def take(self, qty: float) -> float:
        if self.qty <= 0:
            return 0.0
        take_qty = min(qty, self.qty)
        cost_per_unit = self.cost / self.qty
        taken_cost = cost_per_unit * take_qty
        self.qty -= take_qty
        self.cost -= taken_cost
        return taken_cost


def calculate_uk_cgt(trades: Iterable[Trade]) -> CgtReport:
    """Calculate UK CGT across all disposals in a tax year.

    Audit I-7 fix: the prior single-pass implementation appended buys to
    `acquisitions[key]` as it walked the chronological trade list, so when
    a disposal was processed the BnB filter could only see buys that had
    ALREADY been appended — future buys within the 30-day post-disposal
    window were invisible. HMRC HS284 requires looking forward 30 days,
    not just backward.

    Solution: do TWO passes. First pass populates `acquisitions[key]` with
    every buy in order. Second pass processes disposals in chronological
    order, and at each disposal the BnB filter has access to all future
    buys within the 30-day window. Pool-fill at each disposal moves only
    buys older than the current disposal that aren't already consumed
    by same-day or BnB matching of an earlier disposal.
    """
    trades = sorted(trades, key=lambda t: (t.timestamp, 0 if t.side == "buy" else 1))

    # Pass 1: populate all acquisitions up front so BnB can see future buys.
    acquisitions: dict[tuple[int, str], list[Trade]] = {}
    for t in trades:
        if t.side != "buy":
            continue
        key = (t.venue_id, t.instrument_id)
        acquisitions.setdefault(key, []).append(t)

    pools: dict[tuple[int, str], Pool] = {}
    disposals_out: list[DisposalReport] = []

    # Pass 2: walk disposals in order, applying HMRC matching priority.
    for t in trades:
        if t.side != "sell":
            continue
        key = (t.venue_id, t.instrument_id)
        acquisitions.setdefault(key, [])
        pools.setdefault(key, Pool())

        report = DisposalReport(disposal=t)
        remaining_qty = t.quantity
        sell_gbp_rate = get_usd_to_gbp_rate(t.timestamp.date())
        proceeds = t.quantity * t.price * sell_gbp_rate

        # 1. Same-day buys
        for a in acquisitions[key]:
            if remaining_qty <= 0:
                break
            if not _same_day(a.timestamp, t.timestamp):
                continue
            if a.remaining_qty <= 0:
                continue
            match = min(a.remaining_qty, remaining_qty)
            report.matched_same_day.append(_clone_partial(a, match))
            buy_gbp_rate = get_usd_to_gbp_rate(a.timestamp.date())
            report.cost += match * a.price * buy_gbp_rate
            a.remaining_qty -= match
            remaining_qty -= match

        # 2. Bed-and-breakfasting: buys within 30 days AFTER this disposal
        bnb_window_end = t.timestamp + timedelta(days=30)
        for a in acquisitions[key]:
            if remaining_qty <= 0:
                break
            if not (t.timestamp < a.timestamp <= bnb_window_end):
                continue
            if a.remaining_qty <= 0:
                continue
            match = min(a.remaining_qty, remaining_qty)
            report.matched_bnb.append(_clone_partial(a, match))
            bnb_gbp_rate = get_usd_to_gbp_rate(a.timestamp.date())
            report.cost += match * a.price * bnb_gbp_rate
            a.remaining_qty -= match
            remaining_qty -= match

        # 3. s.104 pool. Fold every pre-disposal acquisition that hasn't
        # been consumed by same-day / BnB matching of any prior disposal
        # into the pool, then take from the pool.
        for a in acquisitions[key]:
            if a.timestamp >= t.timestamp:
                continue
            if a.remaining_qty <= 0:
                continue
            pool_gbp_rate = get_usd_to_gbp_rate(a.timestamp.date())
            pools[key].add(a.remaining_qty, a.remaining_qty * a.price * pool_gbp_rate)
            a.remaining_qty = 0
        if remaining_qty > 0:
            cost = pools[key].take(remaining_qty)
            report.matched_pool_qty = remaining_qty
            report.matched_pool_cost = cost
            report.cost += cost

        report.proceeds = proceeds
        disposals_out.append(report)

    total_gain = sum(d.gain for d in disposals_out if d.gain > 0)
    total_loss = sum(-d.gain for d in disposals_out if d.gain < 0)
    return CgtReport(disposals=disposals_out, total_gain=total_gain, total_loss=total_loss)


def _same_day(a: datetime, b: datetime) -> bool:
    return a.date() == b.date()


def _clone_partial(t: Trade, matched_qty: float) -> Trade:
    return Trade(
        timestamp=t.timestamp,
        venue_id=t.venue_id,
        instrument_id=t.instrument_id,
        side=t.side,
        quantity=matched_qty,
        price=t.price,
        remaining_qty=0.0,
    )
