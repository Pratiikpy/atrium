"""US Form 8949 — short-term vs long-term capital gains classification.

Rules (per IRS Publication 544):
  - Short-term: held ≤ 1 year (365 days)
  - Long-term: held > 1 year
  - Wash-sale rule applies to losses within 30 days (advanced; v1.5 simplification: flag only)
  - FIFO matching by default unless taxpayer specifies lot ID at sale time

Output: list of disposal rows compatible with IRS Form 8949 columns:
  description, date acquired, date sold, proceeds, cost basis, gain/loss, holding period
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Iterable, Literal

from ..models import Trade

LONG_TERM_THRESHOLD_DAYS = 365


@dataclass
class DisposalRow:
    description: str
    date_acquired: datetime
    date_sold: datetime
    proceeds: float
    cost_basis: float
    holding_period: Literal["short", "long"]
    wash_sale_flag: bool = False

    @property
    def gain(self) -> float:
        return self.proceeds - self.cost_basis


@dataclass
class Form8949Report:
    short_term: list[DisposalRow] = field(default_factory=list)
    long_term: list[DisposalRow] = field(default_factory=list)

    @property
    def short_term_total(self) -> float:
        return sum(r.gain for r in self.short_term)

    @property
    def long_term_total(self) -> float:
        return sum(r.gain for r in self.long_term)


def calculate_us_form_8949(trades: Iterable[Trade]) -> Form8949Report:
    """Calculate Form 8949 rows from a list of trades.

    Audit I-8 fix: wash-sale loop now actually flags the disposal row and
    adjusts cost basis per IRC §1091. Previously the inner `if` body was a
    bare `pass` so wash sales were never marked and the disallowed loss was
    never propagated forward.
    """
    trades = sorted(trades, key=lambda t: (t.timestamp, 0 if t.side == "buy" else 1))

    # Per-asset FIFO queue of (remaining_qty, price, acquired_at)
    inventory: dict[tuple[int, str], deque[Trade]] = {}
    report = Form8949Report()
    # Track recent disposals (with row references) for wash-sale flagging.
    # Each entry is (disposal_timestamp, DisposalRow). We need the row
    # reference to mutate `wash_sale_flag` and to add the disallowed loss
    # forward to a later replacement-share basis.
    recent_disposals: dict[tuple[int, str], list[tuple[datetime, DisposalRow]]] = {}

    for t in trades:
        key = (t.venue_id, t.instrument_id)
        inventory.setdefault(key, deque())
        recent_disposals.setdefault(key, [])

        if t.side == "buy":
            inventory[key].append(t)
            # IRC §1091: if a substantially identical security was disposed
            # of at a loss within the 30 days BEFORE this buy, the loss is
            # disallowed and added to the basis of the replacement shares.
            window_start = t.timestamp - timedelta(days=30)
            disallowed_total = 0.0
            for prev_dispose_ts, prev_row in recent_disposals[key]:
                if (
                    window_start <= prev_dispose_ts <= t.timestamp
                    and prev_row.gain < 0
                    and not prev_row.wash_sale_flag
                ):
                    prev_row.wash_sale_flag = True
                    disallowed_total += abs(prev_row.gain)
            if disallowed_total > 0 and inventory[key]:
                # Add disallowed loss to the basis of the just-acquired lot
                # (the most recently appended item — index -1).
                replacement = inventory[key][-1]
                # `Trade.price` is per-unit; convert disallowed amount to
                # per-unit basis bump using replacement quantity.
                if replacement.remaining_qty > 0:
                    bump_per_unit = disallowed_total / replacement.remaining_qty
                    replacement.price = replacement.price + bump_per_unit
            continue

        # Sell: FIFO-match against the inventory queue
        remaining = t.quantity
        proceeds_per_unit = t.price
        while remaining > 0 and inventory[key]:
            front = inventory[key][0]
            match_qty = min(front.remaining_qty, remaining)
            holding_days = (t.timestamp - front.timestamp).days
            holding = "long" if holding_days > LONG_TERM_THRESHOLD_DAYS else "short"
            row = DisposalRow(
                description=f"venue:{t.venue_id} {t.instrument_id}",
                date_acquired=front.timestamp,
                date_sold=t.timestamp,
                proceeds=match_qty * proceeds_per_unit,
                cost_basis=match_qty * front.price,
                holding_period=holding,
            )
            # IRC §1091 forward-leg: if a replacement-share buy occurred
            # within 30 days AFTER this disposal AND this disposal is a
            # loss, the loss is disallowed. We can't know the future from
            # here in a single pass, so the post-disposal buy-leg above
            # mutates this row's `wash_sale_flag` retroactively. Either
            # leg of the bilateral 30-day window catches it.
            if holding == "long":
                report.long_term.append(row)
            else:
                report.short_term.append(row)
            recent_disposals[key].append((t.timestamp, row))
            front.remaining_qty -= match_qty
            remaining -= match_qty
            if front.remaining_qty <= 0:
                inventory[key].popleft()
        # If still some quantity unmatched, taxpayer has phantom income (cost basis = 0)
        if remaining > 0:
            row = DisposalRow(
                description=f"venue:{t.venue_id} {t.instrument_id} (unmatched)",
                date_acquired=t.timestamp,
                date_sold=t.timestamp,
                proceeds=remaining * proceeds_per_unit,
                cost_basis=0.0,
                holding_period="short",
            )
            report.short_term.append(row)

    return report
