# Email routing setup

Status: **not yet configured**

## Addresses to provision

| Address | Purpose | Forward to |
|---------|---------|-----------|
| `security@useatrium.me` | Vulnerability disclosures | Founder F3 personal inbox |
| `press@useatrium.me` | Media inquiries | Shared team inbox |
| `legal@useatrium.me` | Legal notices, GDPR requests | Founder F3 personal inbox |

## Provider options

1. **Cloudflare Email Routing** (free tier), forward-only, no sending. Good enough for receiving disclosures.
2. **Google Workspace**, full send/receive. Required if we need to reply from `@useatrium.me`.
3. **Fastmail**, privacy-focused alternative.

## Steps (Cloudflare Email Routing)

1. Domain `useatrium.me` must be on Cloudflare DNS (already the case if using Cloudflare for CDN).
2. Dashboard → Email → Email Routing → Enable.
3. Add destination addresses (personal inboxes of founders).
4. Create routing rules for each `@useatrium.me` address.
5. Verify MX records are set (Cloudflare does this automatically).

## Blockers

- Domain `useatrium.me` DNS provider access required.
- Founders must verify their personal email addresses as destinations.

## Timeline

Configure after domain is live and founders have confirmed personal addresses.
