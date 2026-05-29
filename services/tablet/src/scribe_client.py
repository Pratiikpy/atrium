"""Scribe GraphQL client for Tablet."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, getcontext
import logging

import httpx

from .models import Trade

# Audit fix (iteration 27): set Decimal precision high enough to handle
# wei-scale * Q64 multiplication without truncation. wei is 1e18, Q64 is
# 2^64 ~ 1.8e19, so the intermediate product can be up to ~3.6e37 — well
# within Decimal's default 28-digit context but worth pinning explicitly
# so a future config change doesn't silently degrade tax accuracy.
getcontext().prec = 50

_TWO_POW_64 = Decimal(2) ** 64
_log = logging.getLogger(__name__)


class ScribeError(Exception):
    """Raised when Scribe returns a structured error or the response shape
    doesn't match what we asked for. Distinct from httpx network errors so
    the FastAPI handler can map it to a 502 with a clear message instead
    of silently returning an empty trades list (which would mean the user
    gets a tax export claiming zero activity — wrong in either direction)."""


async def fetch_trades_for_year(
    scribe_url: str,
    address: str,
    tax_year_start: str,
    tax_year_end: str,
) -> list[Trade]:
    start_ts = int(datetime.fromisoformat(tax_year_start).timestamp())
    end_ts = int(datetime.fromisoformat(tax_year_end).timestamp())

    query = """
      query Trades($owner: ID!, $start: BigInt!, $end: BigInt!, $first: Int!, $cursor: String!) {
        positions(
          where: {
            owner: $owner,
            openedAtTimestamp_gte: $start,
            openedAtTimestamp_lte: $end,
            id_gt: $cursor
          },
          first: $first,
          orderBy: id
        ) {
          id
          venueId
          instrumentId
          notionalSigned
          entryPriceQ64
          openedAtTimestamp
          closedAtTimestamp
          realizedPnlSigned
        }
      }
    """
    PAGE_SIZE = 1000
    all_positions: list[dict] = []
    cursor = ""

    async with httpx.AsyncClient(timeout=10.0) as client:
        while True:
            r = await client.post(
                scribe_url,
                json={
                    "query": query,
                    "variables": {
                        "owner": address,
                        "start": str(start_ts),
                        "end": str(end_ts),
                        "first": PAGE_SIZE,
                        "cursor": cursor,
                    },
                },
            )
            r.raise_for_status()
            payload = r.json()

            errors = payload.get("errors")
            if errors:
                raise ScribeError(f"Scribe returned GraphQL errors: {errors}")
            data = payload.get("data")
            if data is None:
                raise ScribeError(f"Scribe response missing 'data' field: {payload}")
            positions = data.get("positions")
            if positions is None:
                raise ScribeError(
                    f"Scribe response missing 'positions' field — "
                    f"schema drift or wrong subgraph deployed: {data}"
                )
            if not isinstance(positions, list):
                raise ScribeError(f"Scribe 'positions' is not a list: {type(positions).__name__}")

            all_positions.extend(positions)
            if len(positions) < PAGE_SIZE:
                break
            cursor = positions[-1]["id"]

    trades: list[Trade] = []
    for p in all_positions:
        # Audit fix (iteration 27): pre-fix this did
        #   notional = float(p["notionalSigned"])
        #   price    = float(p["entryPriceQ64"]) / (2 ** 64)
        #   qty      = abs(notional) / max(price, 1e-12)
        # Float has 15-decimal-digit precision (~2^53 ~ 9e15). Wei-scale
        # notionals are routinely 1e18+ for ETH-denominated positions and
        # Q64 prices for assets like ETH-USD reach ~7e22. Both bypass float
        # precision by 5+ orders of magnitude, producing qty values that
        # are silently wrong by similar margins — UNDER-reported tax for
        # gains, OVER-reported for losses.
        #
        # Bounded fix: do the heavy arithmetic in Decimal (prec=50), cast
        # to float at the Trade boundary so the rest of the calculators
        # (uk/us/de) keep their existing float-typed APIs. A full Decimal
        # migration of Trade + the calculators is tracked for follow-up.
        notional_d = Decimal(str(p["notionalSigned"]))
        price_q64_d = Decimal(str(p["entryPriceQ64"]))
        price_d = price_q64_d / _TWO_POW_64
        side = "buy" if notional_d > 0 else "sell"
        if price_d <= 0:
            # Stub or unset entry_price_q64 from a venue that doesn't
            # publish prices yet. Pre-fix this divided by 1e-12 → qty
            # of 1e12 * notional, garbage that flowed into the tax
            # output. Skip with a warning so the operator sees the gap.
            _log.warning(
                "skipping position id=%s — entryPriceQ64=%s yields non-positive price",
                p.get("id"),
                p.get("entryPriceQ64"),
            )
            continue
        qty_d = abs(notional_d) / price_d
        # Cast to float for the Trade boundary. Precision loss here is
        # bounded: qty is at the asset-unit scale (e.g. 0.0001-1000 ETH),
        # well within float's 15-digit window. The previous bug came from
        # doing the WEI-scale arithmetic in float, not from the final cast.
        # (notional is not stored on Trade; `side` was computed above from
        # the Decimal sign, so no float-cast for notional is needed.)
        price = float(price_d)
        qty = float(qty_d)
        ts = datetime.fromtimestamp(int(p["openedAtTimestamp"]))
        trades.append(Trade(
            timestamp=ts,
            venue_id=int(p["venueId"]),
            instrument_id=p["instrumentId"],
            side=side,
            quantity=qty,
            price=price,
        ))
        # Also synthesize the close as the opposite side
        if p.get("closedAtTimestamp"):
            close_ts = datetime.fromtimestamp(int(p["closedAtTimestamp"]))
            trades.append(Trade(
                timestamp=close_ts,
                venue_id=int(p["venueId"]),
                instrument_id=p["instrumentId"],
                side="sell" if side == "buy" else "buy",
                quantity=qty,
                price=price,
            ))
    return trades
