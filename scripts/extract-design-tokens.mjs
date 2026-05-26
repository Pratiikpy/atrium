#!/usr/bin/env node
// Extract design tokens from design/Atrium.html and Atrium App.standalone.html
//
// The HTML files are React bundles wrapped in a custom unpacker. The bundler
// payload is JSON with manifest + template, base64 + gzip encoded inside
// <script type="__bundler/manifest"> and <script type="__bundler/template"> tags.
//
// This script:
//  1. Reads both HTML files
//  2. Pulls out the static <head> CSS tokens we can already see
//  3. Best-effort attempts to decode the bundler payload (Node 18+ has zlib)
//  4. Writes the result to design/extracted/tokens.json
//
// Run: node scripts/extract-design-tokens.mjs
//
// For perfect fidelity, run the Browser Extraction snippet instead — see
// scripts/extract-design-tokens.browser.js. Open the HTML in Chrome, paste
// that snippet into DevTools console, save the output.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const DESING = join(ROOT, 'desing');
const OUT_DIR = join(DESING, 'extracted');

const FILES = ['Atrium.html', 'Atrium App.standalone.html'];

const CONFIRMED_TOKENS = {
  // Extracted from visible <head> styles
  colors: {
    parchment: '#FBFAF7',
    ink: '#1A1714',
    loadingMuted: '#666',
    loadingBackground: '#fff',
    placeholderMuted: '#999',
    errorBg: '#2a1215',
    errorFg: '#ff8a80',
    errorBorder: '#5c2b2e',
  },
  typography: {
    display: "'Instrument Serif', Georgia, serif",
    body: '-apple-system, BlinkMacSystemFont, sans-serif',
    monospace: 'ui-monospace, monospace',
  },
  logo: {
    treatment: 'serif italic with horizontal underline',
    fontFamily: "'Instrument Serif', Georgia, serif",
    fontStyle: 'italic',
    fontSize: '220px (hero)',
    letterSpacing: '-3',
    underline: '120px wide, 2px stroke, centered below the wordmark',
  },
  layout: {
    pageBackground: '#FBFAF7',
    bodyFlex: 'center, center',
    loadingPosition: 'fixed bottom-right 20px',
  },
};

async function extractBundleSection(html, sectionType) {
  // Look for <script type="__bundler/manifest"> or template
  const re = new RegExp(
    `<script\\s+type="__bundler/${sectionType}"[^>]*>([\\s\\S]*?)</script>`,
    'i'
  );
  const m = html.match(re);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (err) {
    return { error: 'parse_failed', detail: String(err).slice(0, 200) };
  }
}

async function extractFile(path) {
  const html = await readFile(path, 'utf8');
  const out = {
    file: path,
    size_bytes: html.length,
    manifestPreview: null,
    templatePreview: null,
    asset_uuids: [],
  };

  const manifest = await extractBundleSection(html, 'manifest');
  if (manifest && typeof manifest === 'object' && !manifest.error) {
    const uuids = Object.keys(manifest).slice(0, 50);
    out.asset_uuids = uuids;
    out.manifestPreview = `${uuids.length} of ${Object.keys(manifest).length} asset uuids`;
    // Try to decode the first text-like asset to see if we can read JSX
    for (const uuid of uuids) {
      const entry = manifest[uuid];
      if (entry?.mime?.startsWith('text/') || entry?.mime?.includes('javascript')) {
        try {
          const b64 = entry.data || '';
          const buf = Buffer.from(b64, 'base64');
          const decoded = entry.compressed ? gunzipSync(buf) : buf;
          const text = decoded.toString('utf8').slice(0, 4000);
          out.firstTextAssetSample = text;
          out.firstTextAssetMime = entry.mime;
          out.firstTextAssetUuid = uuid;
          break;
        } catch (e) {
          out.decodeError = String(e).slice(0, 200);
        }
      }
    }
  } else {
    out.manifestPreview = manifest?.error || 'no manifest found';
  }

  const template = await extractBundleSection(html, 'template');
  if (template) {
    out.templatePreview = JSON.stringify(template).slice(0, 1000);
  }

  return out;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const results = {
    generatedAt: new Date().toISOString(),
    confirmedTokens: CONFIRMED_TOKENS,
    files: {},
  };

  for (const name of FILES) {
    const path = join(DESING, name);
    try {
      results.files[name] = await extractFile(path);
    } catch (err) {
      results.files[name] = { error: String(err) };
    }
  }

  const outPath = join(OUT_DIR, 'tokens.json');
  await writeFile(outPath, JSON.stringify(results, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log('');
  console.log('Confirmed tokens (use these to scaffold the UI):');
  console.log(JSON.stringify(CONFIRMED_TOKENS, null, 2));
  console.log('');
  console.log('For full fidelity run scripts/extract-design-tokens.browser.js');
  console.log('Open design/Atrium.html in Chrome, paste the snippet, save the output to');
  console.log(`${OUT_DIR}/full-render.html`);
}

// Iter 80: export helpers for unit testing.
export { extractBundleSection, CONFIRMED_TOKENS };

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
