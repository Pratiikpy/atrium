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
 * (1200x630) work for both og:image and twitter:image, `./twitter-
 * image.tsx` re-exports this so the Twitter card matches the OG.
 *
 * Routes can override per-page metadata via their own opengraph-image
 * file under the route segment; this top-level one is the fallback.
 *
 * Font handling (Vercel deploy fix, 2026-06-03): Satori (the engine
 * behind next/og) renders glyphs from font *buffers*, not OS font names.
 * It has no system "serif" / "system-ui" to fall back to, and passing a
 * `fonts` array disables next/og's bundled default font. So EVERY text
 * family used in the card must be supplied here, or that text renders
 * blank (a 200 image/png with a 0-byte body, exactly the symptom that
 * shipped before this fix). We ship two real static TTFs committed under
 * public/fonts: Instrument Serif Italic for the wordmark, Geist Regular
 * for the body + pill. They load via `new URL(..., import.meta.url)` so
 * Turbopack traces + bundles them for the edge runtime.
 */
export const runtime = 'edge';
export const alt = 'Atrium · cross-venue portfolio margin on Arbitrum Sepolia';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PARCHMENT = '#FBFAF7';
const INK = '#1A1714';
const AMBER = 'rgb(207, 156, 67)';

export default async function OpengraphImage() {
  const [serifItalic, sans] = await Promise.all([
    fetch(new URL('../../public/fonts/InstrumentSerif-Italic.ttf', import.meta.url)).then((r) =>
      r.arrayBuffer(),
    ),
    fetch(new URL('../../public/fonts/Geist-Regular.ttf', import.meta.url)).then((r) =>
      r.arrayBuffer(),
    ),
  ]);

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
          fontFamily: 'Geist',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span
            style={{
              fontFamily: 'Instrument Serif',
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
              fontFamily: 'Geist',
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
              fontFamily: 'Geist',
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
              fontFamily: 'Geist',
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
    {
      ...size,
      fonts: [
        {
          name: 'Instrument Serif',
          data: serifItalic,
          style: 'italic',
          weight: 400,
        },
        {
          name: 'Geist',
          data: sans,
          style: 'normal',
          weight: 400,
        },
      ],
    },
  );
}
