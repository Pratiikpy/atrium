"""FX rate layer, ECB Frankfurter API + SQLite cache + CSV fallback.

Provides USD→GBP and USD→EUR historical rates for tax calculations.
"""

from __future__ import annotations

import csv
import io
import logging
import os
import sqlite3
import zipfile
from datetime import date, datetime
from pathlib import Path

import httpx

_log = logging.getLogger(__name__)

_DATA_DIR = Path(os.environ.get("TABLET_DATA_DIR", str(Path(__file__).resolve().parent.parent / "data")))
_DB_PATH = _DATA_DIR / "fx-cache.sqlite"
_CSV_PATH = _DATA_DIR / "eurofxref-hist.csv"

_FRANKFURTER_URL = "https://api.frankfurter.app"
_ECB_ZIP_URL = "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-hist.zip"


class FxRateUnavailable(Exception):
    """Raised when FX rate cannot be obtained from any source."""


def _ensure_db() -> sqlite3.Connection:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH))
    conn.execute(
        "CREATE TABLE IF NOT EXISTS fx_rates "
        "(date TEXT PRIMARY KEY, gbp_rate REAL, eur_rate REAL, fetched_at TEXT)"
    )
    conn.commit()
    return conn


def _cache_get(conn: sqlite3.Connection, d: date) -> tuple[float | None, float | None]:
    row = conn.execute("SELECT gbp_rate, eur_rate FROM fx_rates WHERE date = ?", (d.isoformat(),)).fetchone()
    if row:
        return row[0], row[1]
    return None, None


def _cache_set(conn: sqlite3.Connection, d: date, gbp: float | None, eur: float | None) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO fx_rates (date, gbp_rate, eur_rate, fetched_at) VALUES (?, ?, ?, ?)",
        (d.isoformat(), gbp, eur, datetime.utcnow().isoformat()),
    )
    conn.commit()


def _fetch_from_api(d: date) -> tuple[float | None, float | None]:
    """Fetch USD→GBP,EUR from Frankfurter API."""
    try:
        r = httpx.get(f"{_FRANKFURTER_URL}/{d.isoformat()}?from=USD&to=GBP,EUR", timeout=10.0)
        r.raise_for_status()
        rates = r.json().get("rates", {})
        return rates.get("GBP"), rates.get("EUR")
    except Exception as exc:
        _log.warning("Frankfurter API failed for %s: %s", d, exc)
        return None, None


def _fetch_from_csv(d: date) -> tuple[float | None, float | None]:
    """Fall back to ECB CSV zip download."""
    if not _CSV_PATH.exists():
        try:
            r = httpx.get(_ECB_ZIP_URL, timeout=30.0)
            r.raise_for_status()
            _DATA_DIR.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
                for name in zf.namelist():
                    if name.endswith(".csv"):
                        _CSV_PATH.write_bytes(zf.read(name))
                        break
        except Exception as exc:
            _log.warning("ECB CSV download failed: %s", exc)
            return None, None

    try:
        with _CSV_PATH.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("Date") == d.isoformat():
                    usd = float(row.get("USD", "0"))
                    gbp = float(row.get("GBP", "0"))
                    eur_val = 1.0  # ECB rates are EUR-based
                    if usd <= 0:
                        return None, None
                    # ECB CSV: rates are X per 1 EUR. We need USD→X.
                    # USD→GBP = GBP_per_EUR / USD_per_EUR
                    # USD→EUR = 1 / USD_per_EUR
                    return gbp / usd, eur_val / usd
    except Exception as exc:
        _log.warning("ECB CSV parse failed for %s: %s", d, exc)
    return None, None


def get_rate(d: date, currency: str) -> float | None:
    """Get USD→target rate for a given date. Returns None on failure."""
    conn = _ensure_db()
    gbp_cached, eur_cached = _cache_get(conn, d)

    if currency.upper() == "GBP" and gbp_cached is not None:
        return gbp_cached
    if currency.upper() == "EUR" and eur_cached is not None:
        return eur_cached

    # Try API first
    gbp, eur = _fetch_from_api(d)
    if gbp is None or eur is None:
        gbp_csv, eur_csv = _fetch_from_csv(d)
        gbp = gbp if gbp is not None else gbp_csv
        eur = eur if eur is not None else eur_csv

    if gbp is not None or eur is not None:
        _cache_set(conn, d, gbp, eur)

    if currency.upper() == "GBP":
        return gbp
    if currency.upper() == "EUR":
        return eur
    _log.warning("Unsupported currency: %s", currency)
    return None


def get_usd_to_eur_rate(d: date) -> float:
    """Get USD→EUR rate. Raises FxRateUnavailable if unavailable."""
    rate = get_rate(d, "EUR")
    if rate is None:
        raise FxRateUnavailable(f"USD→EUR rate unavailable for {d.isoformat()}")
    return rate


def get_usd_to_gbp_rate(d: date) -> float:
    """Get USD→GBP rate. Raises FxRateUnavailable if unavailable."""
    rate = get_rate(d, "GBP")
    if rate is None:
        raise FxRateUnavailable(f"USD→GBP rate unavailable for {d.isoformat()}")
    return rate
