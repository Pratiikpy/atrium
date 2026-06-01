#!/usr/bin/env node
/**
 * scripts/build-press-kit.mjs
 * Builds a ZIP of apps/verify/public/brand/** into apps/verify/public/press/atrium-press-kit.zip.
 * Run: node scripts/build-press-kit.mjs
 */
import { readdirSync, statSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDeflateRaw } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRAND_DIR = resolve(__dirname, '../apps/verify/public/brand');
const OUT_DIR = resolve(__dirname, '../apps/verify/public/press');
const OUT_FILE = resolve(OUT_DIR, 'atrium-press-kit.zip');

function collectFiles(dir, base) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, base));
    } else {
      results.push({ path: relative(base, full).replace(/\\/g, '/'), data: readFileSync(full) });
    }
  }
  return results;
}

// Minimal ZIP creation (store method, no compression, keeps it simple and dependency-free)
function createZip(files) {
  const parts = [];
  const centralDir = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.path, 'utf8');
    const data = file.data;

    // Local file header
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // compression: store
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc32(data), 14); // crc32
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(name.length, 26); // filename length
    local.writeUInt16LE(0, 28); // extra field length
    name.copy(local, 30);

    parts.push(local, data);

    // Central directory entry
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralDir.push(central);

    offset += local.length + data.length;
  }

  const centralDirBuf = Buffer.concat(centralDir);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, centralDirBuf, eocd]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

try {
  const files = collectFiles(BRAND_DIR, BRAND_DIR);
  if (files.length === 0) {
    console.log('⚠ No files found in brand directory, skipping ZIP creation');
    process.exit(0);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const zip = createZip(files);
  writeFileSync(OUT_FILE, zip);
  console.log(`✓ Press kit created: ${OUT_FILE} (${files.length} files, ${zip.length} bytes)`);
} catch (e) {
  console.error('✗ Failed to build press kit:', e.message);
  process.exit(1);
}
