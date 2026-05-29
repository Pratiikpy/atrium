/**
 * SSRF guard for webhook delivery (audit CRT-02, FULL_AUDIT #8).
 * Validates that a webhook URL is HTTPS and resolves to a public IP, and
 * returns the *validated* IP so the caller can PIN the connection to it.
 * Pinning defeats DNS-rebinding: without it, fetch/https re-resolves the
 * hostname at connect time and an attacker can flip the record to a private
 * IP between this check and the request (TOCTOU). See deliverWebhook.
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

/** A webhook target that passed the SSRF guard, with the resolved IP to pin. */
export interface ValidatedTarget {
  url: URL;
  /** The single public IP the connection must be pinned to. */
  address: string;
  /** 4 or 6 — the address family of `address`. */
  family: 4 | 6;
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
  /^::1$/,        // loopback
  /^::$/,         // unspecified
  /^fc00:/i,      // unique-local
  /^fd00:/i,      // unique-local
  /^fe80:/i,      // link-local
];

/**
 * Extract the embedded IPv4 from an IPv4-mapped (`::ffff:1.2.3.4`) or
 * IPv4-compatible (`::1.2.3.4`) IPv6 address. Node's `isIP` reports these as
 * family 6, so without this they bypass the IPv4 private-range checks
 * (e.g. `::ffff:127.0.0.1` and `::ffff:169.254.169.254` would read as public).
 */
function embeddedIpv4(ip: string): string | null {
  // Dotted forms: ::ffff:1.2.3.4 (mapped) and ::1.2.3.4 (compat).
  const mappedDotted = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mappedDotted) return mappedDotted[1];
  const compatDotted = ip.match(/^::(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (compatDotted) return compatDotted[1];
  // Hex-grouped mapped form: the WHATWG URL parser canonicalises
  // `::ffff:127.0.0.1` to `::ffff:7f00:1`. Decode the two trailing hex groups
  // back into dotted IPv4 so the private-range check still fires.
  const mappedHex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }
  return null;
}

function isPrivateIp(ip: string): boolean {
  const v4 = embeddedIpv4(ip);
  if (v4) {
    // An IPv4-mapped/compat IPv6 is only as safe as its embedded IPv4.
    return PRIVATE_IPV4_PATTERNS.some((p) => p.test(v4));
  }
  if (ip.includes(':')) {
    return PRIVATE_IPV6_PATTERNS.some((p) => p.test(ip));
  }
  return PRIVATE_IPV4_PATTERNS.some((p) => p.test(ip));
}

/**
 * Validates a webhook URL is HTTPS and resolves to a public IP only, and
 * returns the validated IP so the caller can pin the connection to it.
 * Throws SsrfError if validation fails.
 */
export async function assertPublicHttps(url: string): Promise<ValidatedTarget> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new SsrfError('webhook_https_required', `URL must use HTTPS, got ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets

  // If hostname is already an IP literal, check directly (no DNS, no rebinding).
  const literalFamily = isIP(hostname);
  if (literalFamily) {
    if (isPrivateIp(hostname)) {
      throw new SsrfError('webhook_private_ip', `IP ${hostname} is not a public address`);
    }
    return { url: parsed, address: hostname, family: literalFamily as 4 | 6 };
  }

  // Resolve DNS and check ALL returned addresses; reject if any is private.
  const addresses = await lookup(hostname, { all: true });
  if (addresses.length === 0) {
    throw new SsrfError('webhook_private_ip', `${hostname} did not resolve to any address`);
  }
  for (const addr of addresses) {
    if (isPrivateIp(addr.address)) {
      throw new SsrfError('webhook_private_ip', `${hostname} resolves to private IP ${addr.address}`);
    }
  }

  // Pin to the first resolved address. The caller MUST connect to exactly this
  // IP (not re-resolve `hostname`) so a rebind after this check cannot redirect
  // the request to a private address.
  const pinned = addresses[0];
  return { url: parsed, address: pinned.address, family: (pinned.family === 6 ? 6 : 4) };
}
