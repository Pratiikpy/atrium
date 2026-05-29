"""Test that cursor pagination in scribe_client fetches all rows."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from src.scribe_client import fetch_trades_for_year


def test_pagination_fetches_all_2000_trades():
    """2000 mock positions should return 2000 trades (not just 1000)."""
    total_positions = 2000
    page_size = 1000

    def make_position(i: int) -> dict:
        return {
            "id": f"pos-{i:05d}",
            "venueId": "1",
            "instrumentId": "ETH-USD",
            "notionalSigned": str(10**18),
            "entryPriceQ64": str(3000 * 2**64),
            "openedAtTimestamp": str(1704067200 + i),
            "closedAtTimestamp": None,
            "realizedPnlSigned": "0",
        }

    all_positions = [make_position(i) for i in range(total_positions)]

    call_count = 0

    class MockResponse:
        status_code = 200

        def __init__(self, positions):
            self._positions = positions

        def raise_for_status(self):
            pass

        def json(self):
            return {"data": {"positions": self._positions}}

    async def mock_post(url, json=None, **kwargs):
        nonlocal call_count
        cursor = json["variables"]["cursor"]
        start = 0
        if cursor:
            for idx, p in enumerate(all_positions):
                if p["id"] == cursor:
                    start = idx + 1
                    break
        page = all_positions[start : start + page_size]
        call_count += 1
        return MockResponse(page)

    with patch("src.scribe_client.httpx.AsyncClient") as MockClient:
        instance = AsyncMock()
        instance.post = mock_post
        instance.__aenter__ = AsyncMock(return_value=instance)
        instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = instance

        trades = asyncio.run(fetch_trades_for_year(
            "https://api.studio.thegraph.com/query/test",
            "0x" + "a" * 40,
            "2024-01-01",
            "2024-12-31",
        ))

    # Should have made 3 calls: page 1 (1000), page 2 (1000), page 3 (0)
    assert call_count == 3
    # Each position generates 1 trade (no closedAtTimestamp)
    assert len(trades) == total_positions
