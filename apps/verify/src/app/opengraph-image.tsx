import { ImageResponse } from 'next/og';

/**
 * Phase theta.7 fix (2026-05-25). Pre-fix the verify-app shipped with NO
 * og:image / twitter:card metadata, so every link share on Twitter,
 * Farcaster, Discord, Slack, etc. rendered as a bare URL with no
 * preview. For a launch surface that gets shared into trading-firm
 * group chats, that's a wasted impression.
 *
 * The image renders dynamically (Next.js dynamic OG image): parchment
 * background, italic Instrument Serif wordmark, the testnet pill, and
 * the subtitle that names the product in one line. Same dimensions
 * (1200x630) work for both og:image and twitter:image — `./twitter-
 * image.tsx` re-exports this so the Twitter card matches the OG.
 *
 * Routes can override per-page metadata via their own opengraph-image
 * file under the route segment; this top-level one is the fallback.
 */
export const runtime = 'edge';
export const alt = 'Atrium — cross-venue portfolio margin on Arbitrum Sepolia';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PARCHMENT = '#FBFAF7';
const INK = '#1A1714';
const AMBER = 'rgb(207, 156, 67)';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: PARCHMENT,
          padding: 80,
          fontFamily: 'serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span
            style={{
              fontStyle: 'italic',
              fontSize: 160,
              lineHeight: 1,
              color: INK,
              letterSpacing: '-0.04em',
            }}
          >
            Atrium
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignSelf: 'flex-start',
              marginTop: 24,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(207, 156, 67, 0.14)',
              border: '1px solid rgba(207, 156, 67, 0.30)',
              color: AMBER,
              fontFamily: 'system-ui, sans-serif',
              fontStyle: 'normal',
              fontSize: 20,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            testnet
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p
            style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: 44,
              lineHeight: 1.25,
              color: INK,
              margin: 0,
              maxWidth: '85%',
            }}
          >
            Cross-venue portfolio margin on Arbitrum Sepolia.
          </p>
          <p
            style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: 26,
              lineHeight: 1.4,
              color: '#5C544B',
              margin: 0,
              maxWidth: '80%',
            }}
          >
            One wallet posts collateral once. Trades across venues with one
            margin number.
          </p>
        </div>
      </div>
    ),
    { ...size },
  );
}
