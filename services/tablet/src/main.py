"""Tablet — tax export service.

UK CGT (Month 8), US Form 8949 (Month 11), DE FIFO (Month 11).

Pipeline:
  Scribe GraphQL → normalized trade list → per-jurisdiction calculator →
  CSV exporter → SendGrid email or HTTP response.
"""

from __future__ import annotations

import os
import re
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from .jurisdictions.uk import calculate_uk_cgt
from .jurisdictions.us import calculate_us_form_8949
from .jurisdictions.de import calculate_de_fifo
from .scribe_client import fetch_trades_for_year, ScribeError
from .exporters.csv import to_sa108_csv
from .exporters.form8949_csv import to_form8949_csv
from .exporters.de_fifo_csv import to_de_fifo_csv

app = FastAPI(title="Atrium Tablet", version="0.2.0")


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
# returns an empty result set — the export would silently say "you have no
# trades this year." Real users could under-report (no tax owed) or over-
# report (forced 0). Pin the hex character class.
_ADDRESS_REGEX = re.compile(r"^0x[0-9a-fA-F]{40}$")

# Same FFF-7 pattern for ISO dates — `datetime.fromisoformat` accepts many
# more shapes than the docstring claims ("2024-01-01", "20240101", with
# timezones, etc.). The downstream `int(.timestamp())` is unaffected by
# the format, but the response filename leaks the raw input via
# `tax_year_start` interpolation in future iterations would be a header-
# injection sink. Validate at the boundary.
_ISO_DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@app.get("/export")
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
        raise HTTPException(503, "SCRIBE_URL not configured — tablet not ready")

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
    # The `else` branch below the if/elif chain was unreachable — Literal
    # already enforces uk/us/de. Removed to avoid future confusion.
    if jurisdiction == "uk":
        report = calculate_uk_cgt(trades)
        csv_text = to_sa108_csv(report)
        filename = f"atrium-uk-cgt-{address[:8]}.csv"
    elif jurisdiction == "us":
        us_report = calculate_us_form_8949(trades)
        csv_text = to_form8949_csv(us_report)
        filename = f"atrium-us-8949-{address[:8]}.csv"
    else:  # jurisdiction == "de" — Literal enforces this is the only remaining case
        de_report = calculate_de_fifo(trades)
        csv_text = to_de_fifo_csv(de_report)
        filename = f"atrium-de-fifo-{address[:8]}.csv"

    return PlainTextResponse(
        csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
