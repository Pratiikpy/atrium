"""HMRC SA108 Capital Gains Summary CSV exporter."""

from __future__ import annotations

import csv
import io

from ..jurisdictions.uk import CgtReport


def to_sa108_csv(report: CgtReport) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Disposal date",
        "Asset",
        "Quantity sold",
        "Proceeds (GBP)",
        "Cost basis (GBP)",
        "Gain (GBP)",
        "Same-day matched qty",
        "B&B matched qty",
        "Pool matched qty",
    ])
    for d in report.disposals:
        writer.writerow([
            d.disposal.timestamp.date().isoformat(),
            f"{d.disposal.venue_id}:{d.disposal.instrument_id}",
            d.disposal.quantity,
            f"{d.proceeds:.2f}",
            f"{d.cost:.2f}",
            f"{d.gain:.2f}",
            sum(m.quantity for m in d.matched_same_day),
            sum(m.quantity for m in d.matched_bnb),
            d.matched_pool_qty,
        ])
    writer.writerow([])
    writer.writerow(["Totals"])
    writer.writerow(["Total gains", f"{report.total_gain:.2f}"])
    writer.writerow(["Total losses", f"{report.total_loss:.2f}"])
    writer.writerow(["Net", f"{report.net:.2f}"])
    return buf.getvalue()
