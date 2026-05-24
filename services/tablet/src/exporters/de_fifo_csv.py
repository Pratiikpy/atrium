"""German FIFO CSV exporter."""

from __future__ import annotations

import csv
import io

from ..jurisdictions.de import DeFifoReport


def to_de_fifo_csv(report: DeFifoReport) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "Asset",
        "Date acquired",
        "Date sold",
        "Quantity",
        "Proceeds (EUR)",
        "Cost basis (EUR)",
        "Gain/(loss) (EUR)",
        "Holding days",
        "Exemption review needed",
    ])
    for d in report.disposals:
        w.writerow([
            d.asset_key,
            d.date_acquired,
            d.date_sold,
            f"{d.quantity:.8f}",
            f"{d.proceeds_eur:.2f}",
            f"{d.cost_basis_eur:.2f}",
            f"{d.gain_eur:.2f}",
            d.holding_days,
            "Y" if d.flag_exemption_review else "",
        ])
    w.writerow([])
    w.writerow(["Total gains", f"{report.total_gain_eur:.2f}"])
    w.writerow(["Total losses", f"{report.total_loss_eur:.2f}"])
    return buf.getvalue()
