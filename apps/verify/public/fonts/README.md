# Self-hosted fonts

This directory holds the TTF font files used for server-side OG image rendering (next/og and Satori need raw TTF/OTF, not WOFF2). The two specimens used by the OG image are committed so it renders without a network fetch.

## Fonts

| Font | Weight | Style | Use |
|------|--------|-------|-----|
| Geist | Variable | Normal | Body text, UI |
| Instrument Serif | 400 | Italic | OG image headings |

## Licensing

Both fonts are licensed under the **SIL Open Font License 1.1**, which permits redistribution in original or modified form. Source: Google Fonts.

## How it works

`scripts/download-fonts.mjs` (run via the `prebuild` hook) fetches the TTF files from the Google Fonts CDN. The two specimens the OG image needs (`Geist-Regular.ttf`, `InstrumentSerif-Italic.ttf`) are small and committed so the image renders deterministically at build time.

If you need to regenerate manually: `node scripts/download-fonts.mjs` from the repo root.
