# Self-hosted fonts

This directory contains WOFF2 font files fetched at build time by `scripts/download-fonts.mjs`.

## Fonts

| Font | Weight | Style | Use |
|------|--------|-------|-----|
| Geist | Variable | Normal | Body text, UI |
| Instrument Serif | 400 | Italic | OG image headings |

## Licensing

Both fonts are licensed under the **SIL Open Font License 1.1**, which permits redistribution in original or modified form. Source: Google Fonts.

## How it works

The `prebuild` script in `apps/verify/package.json` runs `node ../../scripts/download-fonts.mjs` which fetches the WOFF2 files from Google Fonts CDN and writes them here. Files are `.gitignore`d to avoid large binaries in the repo.

If you need to regenerate manually: `node scripts/download-fonts.mjs` from the repo root.
