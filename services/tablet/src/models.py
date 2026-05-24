"""Shared data models for Tablet."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal


@dataclass
class Trade:
    """A normalized trade event from Scribe.

    `remaining_qty` tracks how much of this acquisition is still unmatched
    against subsequent disposals.
    """
    timestamp: datetime
    venue_id: int
    instrument_id: str
    side: Literal["buy", "sell"]
    quantity: float
    price: float
    remaining_qty: float = 0.0

    def __post_init__(self) -> None:
        if self.side == "buy" and self.remaining_qty == 0.0:
            self.remaining_qty = self.quantity
