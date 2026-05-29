/**
 * SSRF guard for webhook delivery (audit CRT-02, FULL_AUDIT #8).
 * Validates that a webhook URL is HTTPS and resolves to a public IP.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class SsrfError extends Error {
  code: 'webhook_https_required' | 'webhook_private_ip';
  constructor(code: SsrfError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'SsrfError';
  }
}

const PRIVATE_IPV4_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // CGNAT
];

const PRIVATE_IPV6_PATTERNS = [
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    return PRIVATE_IPV6_PATTERNS.some((p) => p.test(ip));
  }
  return PRIVATE_IPV4_PATTERNS.some((p) => p.test(ip));
}

/**
 * Validates a webhook URL is HTTPS and resolves to public IPs only.
 * Throws SsrfError if validation fails.
 */
export async function assertPublicHttps(url: string): Promise<URL> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new SsrfError('webhook_https_required', `URL must use HTTPS, got ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets

  // If hostname is already an IP literal, check directly
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new SsrfError('webhook_private_ip', `IP ${hostname} is not a public address`);
    }
    return parsed;
  }

  // Resolve DNS and check all returned addresses
  const addresses = await lookup(hostname, { all: true });
  for (const addr of addresses) {
    if (isPrivateIp(addr.address)) {
      throw new SsrfError('webhook_private_ip', `${hostname} resolves to private IP ${addr.address}`);
    }
  }

  return parsed;
}
