# Email routing setup

Status: **not yet configured**

## Addresses to provision

| Address | Purpose | Forward to |
|---------|---------|-----------|
| `security@atrium.fi` | Vulnerability disclosures | Founder F3 personal inbox |
| `press@atrium.fi` | Media inquiries | Shared team inbox |
| `legal@atrium.fi` | Legal notices, GDPR requests | Founder F3 personal inbox |

## Provider options

1. **Cloudflare Email Routing** (free tier) — forward-only, no sending. Good enough for receiving disclosures.
2. **Google Workspace** — full send/receive. Required if we need to reply from `@atrium.fi`.
3. **Fastmail** — privacy-focused alternative.

## Steps (Cloudflare Email Routing)

1. Domain `atrium.fi` must be on Cloudflare DNS (already the case if using Cloudflare for CDN).
2. Dashboard → Email → Email Routing → Enable.
3. Add destination addresses (personal inboxes of founders).
4. Create routing rules for each `@atrium.fi` address.
5. Verify MX records are set (Cloudflare does this automatically).

## Blockers

- Domain `atrium.fi` DNS provider access required.
- Founders must verify their personal email addresses as destinations.

## Timeline

Configure after domain is live and founders have confirmed personal addresses.
