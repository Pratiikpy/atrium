#!/usr/bin/env node
/**
 * Generate raster brand assets from the canonical SVGs shipped under
 * apps/verify/public/brand/assets/. Uses sharp (already in the
 * monorepo's lockfile via Next image optimization) — no GUI tools.
 *
 * Phase eta.10 (2026-05-25): the /brand Download section linked to
 * PNG/ICO files that did not exist. SVGs ship from the codex E.2
 * commit; this script generates the rasters.
 *
 * Outputs (overwrites in place):
 *   apps/verify/public/brand/assets/atrium-wordmark-2x.png   (560x176)
 *   apps/verify/public/brand/assets/atrium-wordmark-4x.png   (1120x352)
 *   apps/verify/public/brand/assets/atrium-icon-2x.png       (128x128)
 *   apps/verify/public/brand/assets/atrium-icon-4x.png       (256x256)
 *   apps/verify/public/brand/assets/apple-touch-icon.png     (180x180)
 *   apps/verify/public/brand/assets/android-icon-192.png     (192x192)
 *   apps/verify/public/brand/assets/android-icon-512.png     (512x512)
 *   apps/verify/public/favicon.ico                           (16/32/48 multi-res)
 *
 * Usage:
 *   node scripts/generate-brand-rasters.mjs
 *
 * Run when any SVG under apps/verify/public/brand/assets/ changes.
 * .github/workflows/brand-assets.yml fires this automatically on CI.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ASSETS = resolve(ROOT, 'apps/verify/public/brand/assets');
const PUBLIC = resolve(ROOT, 'apps/verify/public');

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function renderPng(svgPath, outPath, { width, height, background }) {
  const svg = await readFile(svgPath);
  await sharp(svg, { density: 384 })
    .resize(width, height, { fit: 'contain', background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`Wrote ${outPath} (${width}x${height})`);
}

async function renderIco(svgPath, outPath, sizes) {
  // sharp does not write .ico natively in 0.33; emit a PNG and let the
  // browser/OS handle the multi-resolution path. Most modern targets
  // accept favicon.png; we keep favicon.ico as a 32x32 PNG renamed for
  // backwards compatibility. A pure-JS .ico encoder (png-to-ico) can be
  // added later if true ICO format is required for a specific OS path.
  const svg = await readFile(svgPath);
  // Use the largest size so OS-side scaling has the cleanest source.
  const maxSize = Math.max(...sizes);
  await sharp(svg, { density: 384 })
    .resize(maxSize, maxSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`Wrote ${outPath} (${maxSize}x${maxSize}, .ico path)`);
}

async function main() {
  await ensureDir(ASSETS);

  const wordmarkSvg = resolve(ASSETS, 'atrium-wordmark.svg');
  const wordmarkDarkSvg = resolve(ASSETS, 'atrium-wordmark-dark.svg');
  const iconSvg = resolve(ASSETS, 'atrium-icon.svg');

  // Wordmark rasters (parchment background baked in for the 2x/4x).
  await renderPng(wordmarkSvg, resolve(ASSETS, 'atrium-wordmark-2x.png'),
    { width: 560, height: 176, background: { r: 251, g: 250, b: 247, alpha: 1 } });
  await renderPng(wordmarkSvg, resolve(ASSETS, 'atrium-wordmark-4x.png'),
    { width: 1120, height: 352, background: { r: 251, g: 250, b: 247, alpha: 1 } });
  // Dark variant for press kits + dark UI surfaces.
  await renderPng(wordmarkDarkSvg, resolve(ASSETS, 'atrium-wordmark-dark-2x.png'),
    { width: 560, height: 176, background: { r: 14, g: 14, b: 15, alpha: 1 } });

  // App icon rasters at common sizes.
  await renderPng(iconSvg, resolve(ASSETS, 'atrium-icon-2x.png'),  { width: 128, height: 128 });
  await renderPng(iconSvg, resolve(ASSETS, 'atrium-icon-4x.png'),  { width: 256, height: 256 });

  // OS-specific icons (no background  the SVG already has the ink tile).
  await renderPng(iconSvg, resolve(ASSETS, 'apple-touch-icon.png'), { width: 180, height: 180 });
  await renderPng(iconSvg, resolve(ASSETS, 'android-icon-192.png'), { width: 192, height: 192 });
  await renderPng(iconSvg, resolve(ASSETS, 'android-icon-512.png'), { width: 512, height: 512 });

  // Favicon  emit as 64x64 PNG renamed to .ico for cross-OS compatibility.
  await renderIco(iconSvg, resolve(PUBLIC, 'favicon.ico'), [16, 32, 48, 64]);

  console.log('\nAll brand rasters generated.');
}

main().catch((err) => {
  console.error('generate-brand-rasters failed:', err);
  process.exit(1);
});
