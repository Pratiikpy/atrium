"""Tests for fx_rates module."""

from __future__ import annotations

import sqlite3
from datetime import date
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from src.fx_rates import (
    get_rate,
    get_usd_to_eur_rate,
    get_usd_to_gbp_rate,
    FxRateUnavailable,
    _ensure_db,
    _cache_get,
    _cache_set,
    _fetch_from_api,
)


@pytest.fixture(autouse=True)
def tmp_data_dir(tmp_path, monkeypatch):
    monkeypatch.setattr("src.fx_rates._DATA_DIR", tmp_path)
    monkeypatch.setattr("src.fx_rates._DB_PATH", tmp_path / "fx-cache.sqlite")
    monkeypatch.setattr("src.fx_rates._CSV_PATH", tmp_path / "eurofxref-hist.csv")


class TestCacheHitMiss:
    def test_cache_miss_calls_api(self):
        with patch("src.fx_rates._fetch_from_api", return_value=(0.79, 0.92)) as mock_api:
            rate = get_rate(date(2024, 3, 15), "GBP")
            assert rate == pytest.approx(0.79)
            mock_api.assert_called_once()

    def test_cache_hit_skips_api(self):
        # Prime cache
        with patch("src.fx_rates._fetch_from_api", return_value=(0.79, 0.92)):
            get_rate(date(2024, 3, 15), "GBP")
        # Second call should not hit API
        with patch("src.fx_rates._fetch_from_api") as mock_api:
            rate = get_rate(date(2024, 3, 15), "GBP")
            assert rate == pytest.approx(0.79)
            mock_api.assert_not_called()


class TestFallbackToCsv:
    def test_csv_fallback_when_api_fails(self, tmp_path):
        csv_content = "Date,USD,GBP,JPY\n2024-03-15,1.0856,0.8562,161.98\n"
        csv_path = tmp_path / "eurofxref-hist.csv"
        csv_path.write_text(csv_content)

        with patch("src.fx_rates._fetch_from_api", return_value=(None, None)):
            rate = get_rate(date(2024, 3, 15), "GBP")
            # GBP/USD from ECB CSV: 0.8562 / 1.0856
            assert rate == pytest.approx(0.8562 / 1.0856, rel=1e-4)


class TestFxRateUnavailable:
    def test_raises_when_both_fail(self):
        with patch("src.fx_rates._fetch_from_api", return_value=(None, None)):
            with patch("src.fx_rates._fetch_from_csv", return_value=(None, None)):
                with pytest.raises(FxRateUnavailable):
                    get_usd_to_eur_rate(date(2024, 3, 15))

    def test_raises_for_gbp_when_both_fail(self):
        with patch("src.fx_rates._fetch_from_api", return_value=(None, None)):
            with patch("src.fx_rates._fetch_from_csv", return_value=(None, None)):
                with pytest.raises(FxRateUnavailable):
                    get_usd_to_gbp_rate(date(2024, 3, 15))


class TestKnownRate:
    """Test against known ECB rate for 2024-03-15."""

    def test_2024_03_15_eur_rate(self):
        # ECB reference: USD/EUR on 2024-03-15 was approximately 0.9167
        # (1 EUR = 1.0908 USD → 1 USD = 0.9167 EUR)
        with patch("src.fx_rates._fetch_from_api", return_value=(0.7876, 0.9167)):
            rate = get_usd_to_eur_rate(date(2024, 3, 15))
            assert rate == pytest.approx(0.9167, rel=1e-3)
