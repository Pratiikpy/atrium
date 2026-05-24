"""IRS Form 8949 CSV exporter."""

from __future__ import annotations

import csv
import io

from ..jurisdictions.us import Form8949Report


def to_form8949_csv(report: Form8949Report) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "Description of property",
        "Date acquired",
        "Date sold",
        "Proceeds (USD)",
        "Cost basis (USD)",
        "Gain/(loss) (USD)",
        "Holding period",
        "Wash sale flag",
    ])
    for row in report.short_term + report.long_term:
        w.writerow([
            row.description,
            row.date_acquired.date().isoformat(),
            row.date_sold.date().isoformat(),
            f"{row.proceeds:.2f}",
            f"{row.cost_basis:.2f}",
            f"{row.gain:.2f}",
            row.holding_period,
            "Y" if row.wash_sale_flag else "",
        ])
    w.writerow([])
    w.writerow(["Short-term total", f"{report.short_term_total:.2f}"])
    w.writerow(["Long-term total", f"{report.long_term_total:.2f}"])
    return buf.getvalue()
