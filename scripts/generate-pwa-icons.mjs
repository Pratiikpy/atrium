#!/usr/bin/env node
/**
 * scripts/generate-pwa-icons.mjs
 * Generates PWA icons from apps/verify/public/icon.svg using sharp.
 *
 * Outputs:
 *   - icon-192.png (192×192)
 *   - icon-512.png (512×512)
 *   - apple-touch-icon.png (180×180)
 *   - icon-maskable-192.png (192×192 with safe-area padding)
 *   - icon-maskable-512.png (512×512 with safe-area padding)
 *
 * Run: node scripts/generate-pwa-icons.mjs
 * Requires: sharp (available in workspace devDependencies)
 */
import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '../apps/verify/public');
const SVG = resolve(PUBLIC, 'icon.svg');

if (!existsSync(SVG)) {
  console.error('✗ icon.svg not found at', SVG);
  process.exit(1);
}

async function generate(size, name) {
  await sharp(SVG).resize(size, size).png().toFile(resolve(PUBLIC, name));
  console.log(`✓ ${name} (${size}×${size})`);
}

async function generateMaskable(size, name) {
  // Maskable icons need 10% safe-area padding on each side
  const inner = Math.round(size * 0.8);
  const padding = Math.round(size * 0.1);
  const icon = await sharp(SVG).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 251, g: 250, b: 247, alpha: 1 } } })
    .composite([{ input: icon, left: padding, top: padding }])
    .png()
    .toFile(resolve(PUBLIC, name));
  console.log(`✓ ${name} (${size}×${size} maskable)`);
}

async function main() {
  await generate(192, 'icon-192.png');
  await generate(512, 'icon-512.png');
  await generate(180, 'apple-touch-icon.png');
  await generateMaskable(192, 'icon-maskable-192.png');
  await generateMaskable(512, 'icon-maskable-512.png');
  console.log('✓ All PWA icons generated');
}

main().catch((e) => { console.error(e); process.exit(1); });
