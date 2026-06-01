"""086-BE13 regression: the synthesized close leg must price at the real exit
(derived from realizedPnlSigned), not at the entry price.

Pre-fix the close leg reused the entry price, so every closed position reported
~zero realized gain and realizedPnlSigned (queried from Scribe) was discarded.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from src.scribe_client import fetch_trades_for_year


def _run(position: dict):
    class MockResponse:
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            return {"data": {"positions": [position]}}

    async def mock_post(url, json=None, **kwargs):
        # One position < page size, so the cursor loop returns it once then stops.
        cursor = json["variables"]["cursor"]
        return MockResponse() if cursor == "" else _empty()

    class _empty:
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            return {"data": {"positions": []}}

    with patch("src.scribe_client.httpx.AsyncClient") as MockClient:
        instance = AsyncMock()
        instance.post = mock_post
        instance.__aenter__ = AsyncMock(return_value=instance)
        instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = instance
        return asyncio.run(
            fetch_trades_for_year(
                "https://api.studio.thegraph.com/query/test",
                "0x" + "a" * 40,
                "2024-01-01",
                "2024-12-31",
            )
        )


def test_long_close_leg_priced_at_real_exit_not_entry():
    entry = 3000
    notional = 10**18  # long (positive)
    pnl = 3 * 10**17  # on-chain realized profit, same value unit as notional
    trades = _run({
        "id": "pos-1",
        "venueId": "1",
        "instrumentId": "ETH-USD",
        "notionalSigned": str(notional),
        "entryPriceQ64": str(entry * 2**64),
        "openedAtTimestamp": "1704067200",
        "closedAtTimestamp": "1704153600",
        "realizedPnlSigned": str(pnl),
    })

    assert len(trades) == 2
    open_leg, close_leg = trades
    assert open_leg.side == "buy" and close_leg.side == "sell"

    qty = open_leg.quantity
    expected_exit = entry + (pnl / qty)
    assert close_leg.price == pytest.approx(expected_exit, rel=1e-9)
    # The core bug: the close must NOT be priced at entry (which gave ~zero gain).
    assert close_leg.price != open_leg.price
    # Realized gain reconstructed from the legs equals the on-chain pnl.
    reconstructed_gain = qty * (close_leg.price - open_leg.price)
    assert reconstructed_gain == pytest.approx(pnl, rel=1e-9)


def test_short_close_leg_uses_exit_below_entry_on_profit():
    entry = 3000
    notional = -(10**18)  # short (negative)
    pnl = 3 * 10**17  # short profits when price falls
    trades = _run({
        "id": "pos-2",
        "venueId": "1",
        "instrumentId": "ETH-USD",
        "notionalSigned": str(notional),
        "entryPriceQ64": str(entry * 2**64),
        "openedAtTimestamp": "1704067200",
        "closedAtTimestamp": "1704153600",
        "realizedPnlSigned": str(pnl),
    })
    open_leg, close_leg = trades
    assert open_leg.side == "sell" and close_leg.side == "buy"
    qty = open_leg.quantity
    # short exit = entry - pnl/qty (bought back cheaper on a profitable short)
    assert close_leg.price == pytest.approx(entry - (pnl / qty), rel=1e-9)
    assert close_leg.price < open_leg.price
