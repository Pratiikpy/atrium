import { redirect } from 'next/navigation';

// /lantern/sla previously duplicated the Withdrawal SLA byte-for-byte from
// /sla (two identical page components, a maintainability + drift hazard).
// De-duped to a single canonical source: the Withdrawal SLA lives at /sla.
// (A dedicated Lantern attestation-cadence SLA — "1 publish / hour ± 15min
// jitter", per the loadtest SLOs — can be authored here later if a distinct
// page is wanted; redirecting avoids two-copies drift until then.)
export default function LanternSlaRedirect() {
  redirect('/sla');
}
