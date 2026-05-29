"""Shared test fixtures for tablet tests."""

from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def mock_fx_rates_for_calculators():
    """Mock FX rates to return 1.0 for all existing calculator tests.

    Phase 6 added FX conversion to DE and UK calculators. Existing tests
    use synthetic dates that won't have real rates. Mocking at 1.0 preserves
    the original test semantics (prices were already in target currency).
    """
    with patch("src.jurisdictions.de.get_usd_to_eur_rate", return_value=1.0), \
         patch("src.jurisdictions.uk.get_usd_to_gbp_rate", return_value=1.0):
        yield
