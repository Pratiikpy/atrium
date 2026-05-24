import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';

/**
 * /brand — the Atrium brand kit page.
 *
 * Source of truth for everything visual: tokens, typography, palette, logo
 * treatment, button states, card style, status colors. Renders the same
 * tokens that `desing/Atrium.html` and `desing/Atrium App.standalone.html`
 * embed — so anyone (a contributor, a designer, a judge) can compare the
 * shipped UI to the design canon in one view.
 *
 * Per `.claude/rules/ui.md`: design source of truth is `desing/`. This
 * page does not invent tokens; it surfaces the four confirmed tokens from
 * `desing/extracted/tokens.json` plus the semantic + status palette we
 * extend from there.
 */
export const metadata = {
  title: 'Atrium · brand',
  description: 'Atrium brand kit. Tokens, typography, palette, logo. Source of truth.',
};

export default function BrandPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="flex items-center justify-between">
        <Wordmark size="md" />
        <nav className="flex gap-6 text-sm text-ink-soft">
          <Link href="/" className="hover:text-ink">Home</Link>
          <Link href="/verify/1" className="hover:text-ink">Verify</Link>
          <Link href="/security" className="hover:text-ink">Security</Link>
        </nav>
      </header>

      <section className="mt-16">
        <h1 className="font-display text-5xl text-ink">Brand kit</h1>
        <p className="mt-4 max-w-prose text-ink-soft">
          The tokens, typography, and palette that ship in every Atrium surface.
          Source of truth: <code className="font-mono text-ink">desing/Atrium.html</code> and
          <code className="font-mono text-ink"> desing/Atrium App.standalone.html</code>.
          The four confirmed tokens (parchment, ink, Instrument Serif, archway underline)
          come from the static asset extraction at <code className="font-mono text-ink">desing/extracted/tokens.json</code>.
          The rest of this palette extends those tokens, and any disagreement
          with the design HTMLs is a bug — open a PR.
        </p>
      </section>

      {/* ============ LOGO + WORDMARK ============ */}
      <section className="mt-16">
        <h2 className="font-display text-3xl text-ink">Logo</h2>
        <p className="mt-3 max-w-prose text-sm text-ink-soft">
          Serif italic wordmark with a horizontal underline 55% the wordmark width.
          Per <code className="font-mono text-ink">tokens.json</code>: Instrument Serif italic, 220px hero, letter-spacing -3, 120px × 2px underline.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-4">
          <div className="rounded-md border border-divider bg-parchment p-6 text-center">
            <Wordmark size="hero" />
            <p className="mt-3 text-xs text-muted">hero</p>
          </div>
          <div className="rounded-md border border-divider bg-parchment p-6 text-center">
            <Wordmark size="lg" />
            <p className="mt-3 text-xs text-muted">lg</p>
          </div>
          <div className="rounded-md border border-divider bg-parchment p-6 text-center">
            <Wordmark size="md" />
            <p className="mt-3 text-xs text-muted">md</p>
          </div>
          <div className="rounded-md border border-divider bg-parchment p-6 text-center">
            <Wordmark size="sm" />
            <p className="mt-3 text-xs text-muted">sm</p>
          </div>
        </div>
      </section>

      {/* ============ PALETTE ============ */}
      <section className="mt-16">
        <h2 className="font-display text-3xl text-ink">Palette</h2>
        <p className="mt-3 max-w-prose text-sm text-ink-soft">
          Parchment + ink are the only confirmed colors from the design HTML.
          Terracotta is the single accent. The semantic palette (success, warning,
          danger, info) and the status triplet (amber/green/red, used by the
          breathing favicon) are restrained near-neutrals.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Swatch name="parchment" hex="#FBFAF7" note="background — confirmed token" />
          <Swatch name="parchment-soft" hex="#F5F2EA" note="card recessed surface" />
          <Swatch name="ink" hex="#1A1714" note="primary text — confirmed token" />
          <Swatch name="ink-soft" hex="#4A453F" note="secondary text" />
          <Swatch name="muted" hex="#8A8278" note="labels, meta" />
          <Swatch name="terracotta" hex="#B5523F" note="accent (sparingly)" />
          <Swatch name="success" hex="#2D6A4F" note="tx confirmed" />
          <Swatch name="warning" hex="#B8860B" note="degraded path / not wired" />
          <Swatch name="danger" hex="#C04A39" note="error / pause / chaos trip" />
          <Swatch name="info" hex="#1E3A5F" note="info banner" />
          <Swatch name="status-amber" hex="#CC8E2D" note="favicon: testnet heartbeat" />
          <Swatch name="status-green" hex="#43864F" note="favicon: tx success" />
          <Swatch name="status-red" hex="#A1352A" note="favicon: chaos / failure" />
        </div>
      </section>

      {/* ============ TYPOGRAPHY ============ */}
      <section className="mt-16">
        <h2 className="font-display text-3xl text-ink">Typography</h2>
        <p className="mt-3 max-w-prose text-sm text-ink-soft">
          Display is Instrument Serif italic. Body is Geist 300; system stack
          fallback. Monospace for code, addresses, tx hashes.
        </p>
        <div className="mt-6 space-y-6">
          <div className="rounded-md border border-divider bg-parchment p-6">
            <p className="font-display text-6xl text-ink">Display 64</p>
            <p className="font-display text-4xl text-ink">Display 36</p>
            <p className="font-display text-2xl text-ink">Display 24</p>
            <p className="mt-3 text-xs text-muted">font-display: Instrument Serif italic</p>
          </div>
          <div className="rounded-md border border-divider bg-parchment p-6">
            <p className="text-lg text-ink">Body large 18 — the lede sentence on a section.</p>
            <p className="mt-2 text-base text-ink-soft">Body 16 — the standard paragraph length, capped at ~70 chars per line.</p>
            <p className="mt-2 text-sm text-muted">Body small 14 — meta and labels.</p>
            <p className="mt-3 text-xs text-muted">font-body: Geist 300, system fallback</p>
          </div>
          <div className="rounded-md border border-divider bg-parchment p-6">
            <p className="font-mono text-sm text-ink">0xC2c1F4e7b6D89A3f0A...8aDcB1</p>
            <p className="font-mono text-sm text-ink">function open_position()</p>
            <p className="mt-3 text-xs text-muted">font-mono: ui-monospace stack</p>
          </div>
        </div>
      </section>

      {/* ============ BUTTONS ============ */}
      <section className="mt-16">
        <h2 className="font-display text-3xl text-ink">Buttons</h2>
        <p className="mt-3 max-w-prose text-sm text-ink-soft">
          One primary action per view. Touch target ≥ 44px per ui.md. Focus
          ring is terracotta 2px with 2px offset.
        </p>
        {/* Brand-kit page: these are style samples, not real CTAs. `type="button"`
            prevents accidental form submission; `aria-label` names them as
            examples so screen readers don't promise an action. */}
        <div className="mt-6 flex flex-wrap gap-4">
          <button
            type="button"
            aria-label="Primary action button sample"
            className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-sm min-h-[44px] font-medium text-parchment hover:bg-ink/90"
          >
            Primary action
          </button>
          <button
            type="button"
            aria-label="Secondary button sample"
            className="inline-flex items-center gap-2 rounded-md border border-divider bg-parchment px-5 py-3 text-sm min-h-[44px] font-medium text-ink hover:border-ink/30"
          >
            Secondary
          </button>
          <button
            type="button"
            disabled
            aria-label="Disabled state sample"
            className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-sm min-h-[44px] font-medium text-parchment opacity-60"
          >
            Disabled
          </button>
          <button
            type="button"
            aria-label="Danger / Kill Switch style sample"
            className="inline-flex items-center gap-2 rounded-md bg-danger px-5 py-3 text-sm min-h-[44px] font-medium text-parchment hover:bg-danger/90"
          >
            Kill Switch
          </button>
        </div>
      </section>

      {/* ============ CARDS ============ */}
      <section className="mt-16">
        <h2 className="font-display text-3xl text-ink">Cards</h2>
        <p className="mt-3 max-w-prose text-sm text-ink-soft">
          Soft border, parchment-soft fill for recessed surfaces, archway-light
          shadow. No drop-shadow drama.
        </p>
        {/* Audit U-22: brand-kit sample cards previously carried captions
            like "live from Scribe" / "live" — looked like real product
            metrics. Renamed to neutral "value slot" / "value · subtitle"
            captions so the page is unambiguously a style sample. */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-divider bg-parchment p-5">
            <p className="text-xs uppercase tracking-wider text-muted">card · default</p>
            <p className="mt-2 text-lg text-ink">value slot</p>
            <p className="text-xs text-muted">caption</p>
          </div>
          <div className="rounded-md border border-divider bg-parchment-soft/40 p-5">
            <p className="text-xs uppercase tracking-wider text-muted">card · recessed</p>
            <p className="mt-2 text-lg text-ink">value slot</p>
            <p className="text-xs text-muted">caption</p>
          </div>
          <div className="rounded-md border border-warning/30 bg-warning/5 p-5">
            <p className="text-xs uppercase tracking-wider text-warning">card · warning</p>
            <p className="mt-2 text-sm text-ink">Warning copy goes here.</p>
          </div>
        </div>
      </section>

      {/* ============ STATUS PILLS ============ */}
      <section className="mt-16">
        <h2 className="font-display text-3xl text-ink">Status pills</h2>
        <p className="mt-3 max-w-prose text-sm text-ink-soft">
          The favicon breathing-status colors used on-page. Amber = testnet
          heartbeat (default), green = success / tx confirmed, red = chaos /
          failure / paused. Wired to <code className="font-mono text-ink">window.setAtriumFavicon</code>.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Pill color="amber" label="Heartbeat" />
          <Pill color="green" label="Live" />
          <Pill color="red" label="Paused" />
        </div>
      </section>

      <footer className="mt-24 border-t border-divider pt-6 text-xs text-muted">
        Any disagreement between this page and <code className="font-mono text-ink">desing/Atrium*.html</code> is a bug.
        Open an issue or PR. Tokens live in <code className="font-mono text-ink">apps/verify/src/app/globals.css</code>.
      </footer>
    </main>
  );
}

function Swatch({ name, hex, note }: { name: string; hex: string; note: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-divider">
      <div
        className="h-20 w-full"
        style={{ background: hex }}
        aria-label={`${name} swatch`}
      />
      <div className="bg-parchment p-3">
        <p className="font-mono text-xs text-ink">{name}</p>
        <p className="font-mono text-xs text-muted">{hex}</p>
        <p className="mt-1 text-xs text-ink-soft">{note}</p>
      </div>
    </div>
  );
}

function Pill({ color, label }: { color: 'amber' | 'green' | 'red'; label: string }) {
  const bg =
    color === 'amber'
      ? 'bg-[var(--color-status-amber)]'
      : color === 'green'
      ? 'bg-[var(--color-status-green)]'
      : 'bg-[var(--color-status-red)]';
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-divider bg-parchment px-3 py-1.5 text-xs text-ink">
      <span className={`size-2 rounded-full ${bg}`} aria-hidden />
      {label}
    </span>
  );
}
