#!/usr/bin/env node
/**
 * scripts/download-fonts.mjs
 * Downloads self-hosted WOFF2 fonts for the OG image renderer and offline use.
 * Run: node scripts/download-fonts.mjs
 *
 * Fonts fetched:
 *   - Geist (400, 600) — Vercel's system font
 *   - Instrument Serif Italic (400) — display headings in OG images
 *
 * License: Both fonts are SIL Open Font License 1.1 (redistribution allowed).
 * Source: Google Fonts CDN (fonts.google.com).
 */
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = resolve(__dirname, '../apps/verify/public/fonts');

const FONTS = [
  {
    name: 'GeistVF.woff2',
    url: 'https://fonts.gstatic.com/s/geist/v1/gyBhhwUxId8gMGYQMKR3pzfaWI_RnOQ.woff2',
  },
  {
    name: 'InstrumentSerif-Italic.woff2',
    url: 'https://fonts.gstatic.com/s/instrumentserif/v4/jizHRFtNs2ka5fXjeivQ4LroWlx-2zIZj1bIkNo.woff2',
  },
];

async function main() {
  mkdirSync(FONTS_DIR, { recursive: true });

  for (const font of FONTS) {
    const dest = resolve(FONTS_DIR, font.name);
    // Audit fix (build-deploy #31): skip ONLY when the file exists AND is a
    // real font, not a 0-byte (or truncated) stub. A real woff2 is several KB;
    // an empty stub from a failed prior run used to pass the existsSync check
    // and never re-download, silently shipping broken/invisible fonts.
    if (existsSync(dest) && statSync(dest).size > 1024) {
      console.log(`✓ ${font.name} present (${statSync(dest).size} bytes), skipping`);
      continue;
    }
    console.log(`⬇ Downloading ${font.name}...`);
    const res = await fetch(font.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AtriumBuild/1.0)' },
    });
    if (!res.ok) {
      console.error(`✗ Failed to download ${font.name}: ${res.status}`);
      process.exit(1);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buf);
    console.log(`✓ ${font.name} (${buf.length} bytes)`);
  }
  console.log('✓ All fonts downloaded to apps/verify/public/fonts/');
}

main().catch((e) => { console.error(e); process.exit(1); });
