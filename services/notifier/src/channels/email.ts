import type { Alert, ChannelConfig } from '../types.js';

/**
 * Resend transactional email delivery. Free tier ships 3K emails/month
 * which comfortably covers Year-1 testnet alert volume.
 *
 * Founder ops: create Resend account, verify atrium.fi domain, generate
 * API key, set RESEND_API_KEY env on the notifier deploy.
 *
 * Templates: per docs/conventions/writing.md, plain prose, no marketing
 * fluff. Brand-kit canon palette in inline CSS for color signals.
 */
export async function deliverEmail(alert: Alert, config: ChannelConfig): Promise<void> {
  if (!config.emailAddress) throw new Error('emailAddress missing');
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[notifier] RESEND_API_KEY not set; skipping email delivery');
    return;
  }

  const html = formatEmailHtml(alert);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Atrium Alerts <alerts@atrium.fi>',
      to: [config.emailAddress],
      subject: `[Atrium ${alert.severity}] ${alert.title}`,
      html,
      text: `${alert.title}\n\n${alert.body}\n\n${alert.link ?? ''}`,
    }),
  });
  if (!r.ok) {
    throw new Error(`resend_${r.status}: ${await r.text()}`);
  }
}

function formatEmailHtml(alert: Alert): string {
  const accent =
    alert.severity === 'critical' ? '#A1352A' :
    alert.severity === 'warning'  ? '#CC8E2D' :
                                    '#43864F';
  const linkRow = alert.link
    ? `<p style="margin: 24px 0 0;"><a href="${alert.link}" style="display: inline-block; padding: 10px 20px; border-radius: 999px; background: #1A1714; color: #FBFAF7; text-decoration: none; font-size: 14px;">View on Arbiscan</a></p>`
    : '';
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#FBFAF7;font-family:Geist,system-ui,sans-serif;color:#1A1714;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#FFFFFF;border:1px solid #DBD8D2;border-radius:14px;padding:32px;">
    <tr><td>
      <div style="font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:28px;color:#1A1714;">Atrium</div>
      <div style="font-family:'Geist Mono',monospace;font-size:10.5px;letter-spacing:0.16em;text-transform:uppercase;color:${accent};margin-top:18px;">${alert.severity}</div>
      <h1 style="margin:8px 0 16px;font-size:22px;font-weight:500;letter-spacing:-0.012em;color:#1A1714;">${escapeHtml(alert.title)}</h1>
      <p style="margin:0;font-size:15px;line-height:1.55;color:#4A453F;">${escapeHtml(alert.body)}</p>
      ${linkRow}
      <p style="margin:32px 0 0;border-top:1px solid #DBD8D2;padding-top:16px;font-size:11px;color:#807872;">
        You are receiving this because you enabled email alerts in /app/settings/notifications. <a href="https://verify.atrium.fi/app/settings/notifications" style="color:#807872;">Unsubscribe / adjust</a>.
      </p>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
