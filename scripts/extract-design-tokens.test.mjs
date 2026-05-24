#!/usr/bin/env node
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import { extractBundleSection, CONFIRMED_TOKENS } from './extract-design-tokens.mjs';

/**
 * Iter 80 audit fix: pins extractBundleSection's HTML script-tag regex
 * + CONFIRMED_TOKENS shape (read by UI scaffolding to mirror the
 * agency prototype's visual language).
 */

describe('extractBundleSection — script-tag matching', () => {
  it('finds manifest section with simple shape', async () => {
    const html = `<html><script type="__bundler/manifest">{"abc":1}</script></html>`;
    const result = await extractBundleSection(html, 'manifest');
    assert.deepEqual(result, { abc: 1 });
  });

  it('finds template section', async () => {
    const html = `<script type="__bundler/template">{"root":"x"}</script>`;
    const result = await extractBundleSection(html, 'template');
    assert.deepEqual(result, { root: 'x' });
  });

  it('returns null when no matching section', async () => {
    const html = `<html><body>no bundler here</body></html>`;
    const result = await extractBundleSection(html, 'manifest');
    assert.equal(result, null);
  });

  it('returns parse_failed object on malformed JSON', async () => {
    const html = `<script type="__bundler/manifest">{not-valid-json}</script>`;
    const result = await extractBundleSection(html, 'manifest');
    assert.equal(result.error, 'parse_failed');
    assert.ok(typeof result.detail === 'string');
  });

  it('is case-insensitive on the script tag', async () => {
    const html = `<SCRIPT TYPE="__bundler/manifest">{"k":1}</SCRIPT>`;
    const result = await extractBundleSection(html, 'manifest');
    assert.deepEqual(result, { k: 1 });
  });

  it('handles multi-line JSON content', async () => {
    const html = `<script type="__bundler/manifest">{
      "a": 1,
      "b": 2
    }</script>`;
    const result = await extractBundleSection(html, 'manifest');
    assert.deepEqual(result, { a: 1, b: 2 });
  });

  it('finds the first occurrence when multiple sections of same type exist', async () => {
    const html = `
      <script type="__bundler/manifest">{"v":"first"}</script>
      <script type="__bundler/manifest">{"v":"second"}</script>
    `;
    const result = await extractBundleSection(html, 'manifest');
    assert.equal(result.v, 'first');
  });

  it('does NOT cross-match between sectionType strings', async () => {
    // Searching for "manifest" must not match a "template" tag.
    const html = `<script type="__bundler/template">{"k":1}</script>`;
    const result = await extractBundleSection(html, 'manifest');
    assert.equal(result, null);
  });
});

describe('CONFIRMED_TOKENS — shape contract for UI scaffolding', () => {
  it('exposes the canonical parchment + ink colors', () => {
    assert.equal(CONFIRMED_TOKENS.colors.parchment, '#FBFAF7');
    assert.equal(CONFIRMED_TOKENS.colors.ink, '#1A1714');
  });

  it('every color token is a non-empty string', () => {
    for (const [name, value] of Object.entries(CONFIRMED_TOKENS.colors)) {
      assert.equal(typeof value, 'string', `colors.${name} must be string`);
      assert.ok(value.length > 0, `colors.${name} must be non-empty`);
    }
  });

  it('typography stack names the Instrument Serif display font', () => {
    // CLAUDE.md Prototype UI contract: "Preserve the Atrium wordmark
    // treatment: Instrument Serif, italic". A refactor that drops this
    // font would visually drift from the prototype contract.
    assert.ok(CONFIRMED_TOKENS.typography.display.includes('Instrument Serif'));
  });

  it('logo treatment names the underline motif', () => {
    // Prototype contract: "underline motif where used."
    assert.ok(CONFIRMED_TOKENS.logo.treatment.toLowerCase().includes('underline'));
  });
});
