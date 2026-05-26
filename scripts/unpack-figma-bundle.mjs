#!/usr/bin/env node
/**
 * Unpack a Figma-Make standalone HTML bundle into its rendered template
 * + extracted assets. The bundle stores:
 *   - <script type="__bundler/manifest">  JSON map of uuid -> { data: base64, compressed: bool, mime: string }
 *   - <script type="__bundler/template">  JSON string of the rendered HTML, with uuid tokens where assets go
 *   - <script type="__bundler/ext_resources">  external resource list
 *
 * Output:
 *   design/extracted/<basename>/index.html  the rendered template (uuids replaced with relative asset paths)
 *   design/extracted/<basename>/assets/<uuid>.<ext>  each decoded asset
 *
 * Usage:
 *   node scripts/unpack-figma-bundle.mjs "design/Atriumnew.html"
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, basename, extname, resolve, join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const MIME_EXT = {
  'text/html': 'html',
  'text/css': 'css',
  'text/javascript': 'js',
  'application/javascript': 'js',
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'font/woff2': 'woff2',
  'font/woff': 'woff',
  'application/json': 'json',
};

function extractScriptBody(html, type) {
  const re = new RegExp(`<script[^>]*type=["']${type}["'][^>]*>([\\s\\S]*?)<\\/script>`, 'i');
  const m = html.match(re);
  if (!m) throw new Error(`script type=${type} not found in bundle`);
  return m[1].trim();
}

function decodeAsset(entry) {
  const bin = Buffer.from(entry.data, 'base64');
  return entry.compressed ? gunzipSync(bin) : bin;
}

function main() {
  const src = process.argv[2];
  if (!src) {
    console.error('Usage: node scripts/unpack-figma-bundle.mjs <path-to-bundle.html>');
    process.exit(1);
  }
  const html = readFileSync(src, 'utf8');

  const manifest = JSON.parse(extractScriptBody(html, '__bundler/manifest'));
  let template = JSON.parse(extractScriptBody(html, '__bundler/template'));

  const outDir = resolve(dirname(src), 'extracted', basename(src, extname(src)));
  const assetsDir = join(outDir, 'assets');
  mkdirSync(assetsDir, { recursive: true });

  const uuids = Object.keys(manifest);
  console.log(`Bundle has ${uuids.length} assets. Decoding...`);

  for (const uuid of uuids) {
    const entry = manifest[uuid];
    let bytes;
    try {
      bytes = decodeAsset(entry);
    } catch (err) {
      console.warn(`asset ${uuid} (${entry.mime}) decode failed: ${err.message}`);
      bytes = Buffer.alloc(0);
    }
    const ext = MIME_EXT[entry.mime] ?? 'bin';
    const filename = `${uuid}.${ext}`;
    const outPath = join(assetsDir, filename);
    writeFileSync(outPath, bytes);
    // Replace every occurrence of the uuid in the template with a relative
    // asset path so the extracted index.html renders standalone.
    template = template.split(uuid).join(`./assets/${filename}`);
  }

  // Cosmetic: strip SRI integrity attrs that would fail when the bytes
  // were repackaged (same logic as the bundler runtime).
  template = template.replace(/\s+integrity="[^"]*"/gi, '').replace(/\s+crossorigin="[^"]*"/gi, '');

  const indexPath = join(outDir, 'index.html');
  writeFileSync(indexPath, template);

  console.log(`Wrote ${indexPath}`);
  console.log(`Wrote ${uuids.length} assets to ${assetsDir}`);
}

main();
