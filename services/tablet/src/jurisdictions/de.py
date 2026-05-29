"""German tax — FIFO per asset per venue.

Rules (per § 23 EStG, German Einkommensteuergesetz):
  - FIFO (first-in-first-out) at the asset level
  - 1-year holding period for tax-free private sale gains (Spekulationsfrist)
    Note: this exemption is contested for crypto in recent rulings; we flag
    long-held positions but mark them as "verify with tax adviser" rather
    than asserting exemption.
  - Per-asset granularity (BTC and ETH are separate pools; same instrument
    on different venues is also separate per § 23 EStG strict reading)

Output: list of disposal rows + per-asset summary in EUR.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Iterable

from ..models import Trade
from ..fx_rates import get_usd_to_eur_rate, FxRateUnavailable

HOLDING_EXEMPTION_DAYS = 365


@dataclass
class DeDisposalRow:
    asset_key: str
    date_acquired: str
    date_sold: str
    quantity: float
    proceeds_eur: float
    cost_basis_eur: float
    holding_days: int
    flag_exemption_review: bool

    @property
    def gain_eur(self) -> float:
        return self.proceeds_eur - self.cost_basis_eur


@dataclass
class DeFifoReport:
    disposals: list[DeDisposalRow] = field(default_factory=list)

    @property
    def total_gain_eur(self) -> float:
        return sum(d.gain_eur for d in self.disposals if d.gain_eur > 0)

    @property
    def total_loss_eur(self) -> float:
        return sum(-d.gain_eur for d in self.disposals if d.gain_eur < 0)


def calculate_de_fifo(trades: Iterable[Trade]) -> DeFifoReport:
    """Calculate German FIFO across per-asset-per-venue pools."""
    trades = sorted(trades, key=lambda t: (t.timestamp, 0 if t.side == "buy" else 1))
    pools: dict[tuple[int, str], deque[Trade]] = {}
    report = DeFifoReport()

    for t in trades:
        key = (t.venue_id, t.instrument_id)
        pools.setdefault(key, deque())
        if t.side == "buy":
            pools[key].append(t)
            continue
        # Sell: FIFO match
        remaining = t.quantity
        sell_eur_rate = get_usd_to_eur_rate(t.timestamp.date())
        while remaining > 0 and pools[key]:
            front = pools[key][0]
            match_qty = min(front.remaining_qty, remaining)
            holding_days = (t.timestamp - front.timestamp).days
            buy_eur_rate = get_usd_to_eur_rate(front.timestamp.date())
            row = DeDisposalRow(
                asset_key=f"venue:{t.venue_id} {t.instrument_id}",
                date_acquired=front.timestamp.date().isoformat(),
                date_sold=t.timestamp.date().isoformat(),
                quantity=match_qty,
                proceeds_eur=match_qty * t.price * sell_eur_rate,
                cost_basis_eur=match_qty * front.price * buy_eur_rate,
                holding_days=holding_days,
                flag_exemption_review=holding_days > HOLDING_EXEMPTION_DAYS,
            )
            report.disposals.append(row)
            front.remaining_qty -= match_qty
            remaining -= match_qty
            if front.remaining_qty <= 0:
                pools[key].popleft()

    return report
