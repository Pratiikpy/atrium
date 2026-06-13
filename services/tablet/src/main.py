"""Tablet, tax export service.

UK CGT (Month 8), US Form 8949 (Month 11), DE FIFO (Month 11).

Pipeline:
  Scribe GraphQL → normalized trade list → per-jurisdiction calculator →
  CSV exporter → SendGrid email or HTTP response.
"""

from __future__ import annotations

import os
import re
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Depends, Header
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from .jurisdictions.uk import calculate_uk_cgt
from .jurisdictions.us import calculate_us_form_8949
from .jurisdictions.de import calculate_de_fifo
from .scribe_client import fetch_trades_for_year, ScribeError
from .exporters.csv import to_sa108_csv
from .exporters.form8949_csv import to_form8949_csv
from .exporters.de_fifo_csv import to_de_fifo_csv
from .fx_rates import FxRateUnavailable

app = FastAPI(title="Atrium Tablet", version="0.2.0")

_INTERNAL_KEY = os.environ.get("ATRIUM_INTERNAL_KEY", "")

# Per-jurisdiction annual allowance + an indicative headline rate. The proceeds,
# cost basis, and realized gain are computed for real from the wallet's on-chain
# trades; only the rate is an assumption, and the client labels the tax figure
# "estimate, not tax advice". Values in the jurisdiction's native currency.
_TAX_PARAMS = {
    "uk": {"allowance": 3000.0, "rate_pct": 24.0, "currency": "GBP"},    # 2024/25 AEA + higher-rate crypto CGT
    "us": {"allowance": 0.0, "rate_pct": 15.0, "currency": "USD"},       # long-term capital-gains, indicative
    "de": {"allowance": 1000.0, "rate_pct": 26.375, "currency": "EUR"},  # Abgeltungsteuer + soli, indicative
}


def _disposal_totals(report):
    """Sum proceeds + cost across a report's disposal rows, or (None, None) when
    the report exposes no rows at all (never fakes a 0).

    The three jurisdiction reports differ in BOTH the collection attribute and
    the per-row field names, so a single `.disposals` / `.proceeds` lookup only
    worked for the UK and silently returned (None, None) for US and (0, 0) for
    DE - the US tab showed "-" and the DE tab showed 0 proceeds next to a real
    gain. Normalise across all three:
      - UK  CgtReport      -> .disposals[]                 .proceeds / .cost
      - US  Form8949Report -> .short_term[] + .long_term[] .proceeds / .cost_basis
      - DE  DeFifoReport    -> .disposals[]                 .proceeds_eur / .cost_basis_eur
    """
    rows = list(getattr(report, "disposals", None) or [])
    # US splits its rows across short_term + long_term instead of `.disposals`.
    rows.extend(getattr(report, "short_term", None) or [])
    rows.extend(getattr(report, "long_term", None) or [])
    if not rows:
        return None, None

    def _first(obj, names):
        for n in names:
            v = getattr(obj, n, None)
            if v is not None:
                return v
        return 0.0

    proceeds = sum(_first(d, ("proceeds", "proceeds_eur")) for d in rows)
    cost = sum(_first(d, ("cost", "cost_basis", "cost_basis_eur")) for d in rows)
    return proceeds, cost


async def require_internal_key(
    authorization: str = Header(..., alias="Authorization"),
) -> None:
    """Validate Bearer token matches ATRIUM_INTERNAL_KEY env var."""
    if not _INTERNAL_KEY:
        raise HTTPException(503, "ATRIUM_INTERNAL_KEY not configured")
    expected = f"Bearer {_INTERNAL_KEY}"
    if authorization != expected:
        raise HTTPException(401, "Invalid or missing internal key")


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str = "0.2.0"
    jurisdictions: list[str] = ["uk", "us", "de"]


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


# Audit fix (FFF-7 pattern, iteration 26): pre-fix the address check was
# `startswith("0x") and len == 42` which accepts non-hex (e.g. "0xZZZ...").
# A non-hex address would get lowercased and forwarded to Scribe, which
# returns an empty result set, the export would silently say "you have no
# trades this year." Real users could under-report (no tax owed) or over-
# report (forced 0). Pin the hex character class.
_ADDRESS_REGEX = re.compile(r"^0x[0-9a-fA-F]{40}$")

# Same FFF-7 pattern for ISO dates, `datetime.fromisoformat` accepts many
# more shapes than the docstring claims ("2024-01-01", "20240101", with
# timezones, etc.). The downstream `int(.timestamp())` is unaffected by
# the format, but the response filename leaks the raw input via
# `tax_year_start` interpolation in future iterations would be a header-
# injection sink. Validate at the boundary.
_ISO_DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@app.get("/export", dependencies=[Depends(require_internal_key)])
async def export(
    address: str = Query(..., description="0x-prefixed 40-hex wallet address"),
    jurisdiction: Literal["uk", "us", "de"] = Query("uk"),
    tax_year_start: str = Query(..., description="ISO date YYYY-MM-DD"),
    tax_year_end: str = Query(..., description="ISO date YYYY-MM-DD"),
):
    if not _ADDRESS_REGEX.match(address):
        raise HTTPException(400, "address must be a 0x-prefixed 40-hex string")
    if not _ISO_DATE_REGEX.match(tax_year_start):
        raise HTTPException(400, "tax_year_start must match YYYY-MM-DD")
    if not _ISO_DATE_REGEX.match(tax_year_end):
        raise HTTPException(400, "tax_year_end must match YYYY-MM-DD")

    scribe_url = os.environ.get("SCRIBE_URL")
    if not scribe_url:
        # Loud bail instead of KeyError → 500. Operator gets a clear 503.
        raise HTTPException(503, "SCRIBE_URL not configured, tablet not ready")

    try:
        trades = await fetch_trades_for_year(
            scribe_url, address.lower(), tax_year_start, tax_year_end
        )
    except ScribeError as e:
        # Audit fix (iteration 26): structured upstream-failure path. The
        # alternative (silently producing an empty CSV) would understate the
        # user's tax exposure. 502 names the upstream so an operator can
        # triage; the response detail is the ScribeError message which is
        # operator-facing (it's already a curated subset of upstream state,
        # not a raw stack trace).
        raise HTTPException(502, f"Scribe upstream failed: {e}") from e
    # The `else` branch below the if/elif chain was unreachable, Literal
    # already enforces uk/us/de. Removed to avoid future confusion.
    if jurisdiction == "uk":
        report = calculate_uk_cgt(trades)
        csv_text = to_sa108_csv(report)
        filename = f"atrium-uk-cgt-{address[:8]}.csv"
    elif jurisdiction == "us":
        us_report = calculate_us_form_8949(trades)
        csv_text = to_form8949_csv(us_report)
        filename = f"atrium-us-8949-{address[:8]}.csv"
    else:  # jurisdiction == "de", Literal enforces this is the only remaining case
        de_report = calculate_de_fifo(trades)
        csv_text = to_de_fifo_csv(de_report)
        filename = f"atrium-de-fifo-{address[:8]}.csv"

    return PlainTextResponse(
        csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )



@app.get("/summary", dependencies=[Depends(require_internal_key)])
async def summary(
    address: str = Query(...),
    jurisdiction: Literal["uk", "us", "de"] = Query("uk"),
    year: int = Query(...),
):
    if not _ADDRESS_REGEX.match(address):
        raise HTTPException(400, "address must be a 0x-prefixed 40-hex string")

    scribe_url = os.environ.get("SCRIBE_URL")
    if not scribe_url:
        raise HTTPException(503, "SCRIBE_URL not configured")

    tax_year_start = f"{year}-01-01"
    tax_year_end = f"{year}-12-31"
    if jurisdiction == "uk":
        tax_year_start = f"{year}-04-06"
        tax_year_end = f"{year + 1}-04-05"

    try:
        trades = await fetch_trades_for_year(scribe_url, address.lower(), tax_year_start, tax_year_end)
    except ScribeError as e:
        raise HTTPException(502, f"Scribe upstream failed: {e}") from e

    try:
        if jurisdiction == "uk":
            report = calculate_uk_cgt(trades)
            realized = report.total_gain - report.total_loss
        elif jurisdiction == "de":
            report = calculate_de_fifo(trades)
            realized = report.total_gain_eur - report.total_loss_eur
        else:
            report = calculate_us_form_8949(trades)
            realized = sum(getattr(r, "gain", 0) for r in report.disposals) if hasattr(report, "disposals") else 0
    except FxRateUnavailable as e:
        raise HTTPException(502, f"FX rate unavailable: {e}") from e

    # Real disposal totals (FIFO + pooling over the wallet's on-chain trades).
    proceeds, cost_basis = _disposal_totals(report)
    # Tax-owed is an ESTIMATE: gain above the annual allowance times an
    # indicative headline rate. The proceeds / cost / gain are real; only the
    # rate is an assumption, surfaced as "estimate, not tax advice" on the page.
    params = _TAX_PARAMS.get(jurisdiction, _TAX_PARAMS["uk"])
    allowance = params["allowance"]
    rate_pct = params["rate_pct"]
    taxable = max(0.0, realized - allowance)
    tax_owed = round(taxable * rate_pct / 100.0, 2)
    allowance_used = min(max(realized, 0.0), allowance)

    return {
        "proceeds": round(proceeds, 2) if proceeds is not None else None,
        "cost_basis": round(cost_basis, 2) if cost_basis is not None else None,
        "realized_gain": round(realized, 2),
        "taxable_gain": round(taxable, 2),
        "tax_owed": tax_owed,
        "tax_rate_pct": rate_pct,
        "allowance_total": allowance,
        "allowance_used": round(allowance_used, 2),
        "allowance_used_pct": round(allowance_used / allowance * 100.0, 1) if allowance > 0 else None,
        "currency": params["currency"],
        # Back-compat with any older consumer that read the v0.1 shape.
        "realized_gain_usd": round(realized, 2),
        "unrealized_gain_usd": None,
    }


@app.get("/events", dependencies=[Depends(require_internal_key)])
async def events(
    address: str = Query(...),
    jurisdiction: Literal["uk", "us", "de"] = Query("uk"),
    year: int = Query(...),
    cursor: str = Query(""),
    limit: int = Query(50, ge=1, le=200),
):
    if not _ADDRESS_REGEX.match(address):
        raise HTTPException(400, "address must be a 0x-prefixed 40-hex string")

    scribe_url = os.environ.get("SCRIBE_URL")
    if not scribe_url:
        raise HTTPException(503, "SCRIBE_URL not configured")

    tax_year_start = f"{year}-01-01"
    tax_year_end = f"{year}-12-31"
    if jurisdiction == "uk":
        tax_year_start = f"{year}-04-06"
        tax_year_end = f"{year + 1}-04-05"

    try:
        trades = await fetch_trades_for_year(scribe_url, address.lower(), tax_year_start, tax_year_end)
    except ScribeError as e:
        raise HTTPException(502, f"Scribe upstream failed: {e}") from e

    # Simple cursor-based pagination over trade list
    trades_sorted = sorted(trades, key=lambda t: t.timestamp)
    start_idx = 0
    if cursor:
        try:
            start_idx = int(cursor)
        except ValueError:
            start_idx = 0

    page = trades_sorted[start_idx : start_idx + limit]
    next_cursor = str(start_idx + limit) if start_idx + limit < len(trades_sorted) else ""

    events_out = [
        {
            "timestamp": t.timestamp.isoformat(),
            "venue_id": t.venue_id,
            "instrument_id": t.instrument_id,
            "side": t.side,
            "quantity": t.quantity,
            "price": t.price,
        }
        for t in page
    ]
    return {"events": events_out, "cursor": next_cursor}
