import { redirect } from 'next/navigation';

/**
 * Root /sla → /lantern/sla (canonical location).
 * Audit fix D-23: footer linked /sla but the page lived at /lantern/sla.
 */
export default function SlaRedirect() {
  redirect('/lantern/sla');
}
