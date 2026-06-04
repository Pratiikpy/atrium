/**
 * Minimal, dependency-free Markdown -> HTML renderer for the docs surfaces
 * (/docs/runbooks, /docs/adr). It covers the subset our repo markdown uses:
 * headings, paragraphs, fenced code, inline code, bold, italic, links,
 * unordered/ordered lists, blockquotes, GFM tables, and horizontal rules.
 *
 * Why hand-rolled instead of react-markdown: adding a renderer dependency
 * means a pnpm install, which on this Windows toolchain has hung for hours
 * and re-resolves the manually-placed lightningcss/oxide win32 native
 * bindings (see the win32-native-binaries note). A small, TESTED renderer
 * avoids touching the working dependency tree and gives full control over
 * styling to match the prototype. The companion test file is the safeguard
 * that makes a hand-rolled parser acceptable: every construct has a case.
 *
 * Source is trusted (our own committed .md files), but text is still HTML-
 * escaped before any inline formatting so a stray `<` in a runbook cannot
 * inject markup. The output is rendered via dangerouslySetInnerHTML inside a
 * styled container.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Allow only safe link schemes. Blocks `javascript:`, `data:`, `vbscript:`,
 * etc., so a tampered doc cannot inject a script-bearing href via the
 * `[text](url)` syntax. Relative, anchor, http(s), and mailto links pass.
 */
function safeHref(url: string): string | null {
  const u = url.trim();
  if (/^(https?:\/\/|mailto:|\/|#|\.\/|\.\.\/)/i.test(u)) return u;
  // bare relative path like "docs/X.md" with no scheme
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
  return null;
}

/** Inline formatting: code, links, bold, italic. Escapes first. */
function inline(text: string): string {
  let s = escapeHtml(text);
  // inline code `...` (run first; its content is already escaped)
  // `break-words` + overflow-wrap:anywhere so a long unbroken inline-code string
  // (a curl URL, a <script src>, an env-var value) wraps instead of pushing the
  // page wider than the viewport. Runbook pages incident-scribe/student-pack-setup/
  // vercel-env-scoping overflowed 23-75px on mobile/Redmi before this (use-everything
  // route-crawl 2026-06-03).
  s = s.replace(/`([^`]+)`/g, (_m, c) => `<code class="rounded bg-parchment-soft/70 px-1 py-0.5 font-mono text-[0.9em] text-ink break-words [overflow-wrap:anywhere]">${c}</code>`);
  // links [text](url) - href scheme validated; unsafe schemes render as plain
  // text. The url is also attribute-encoded (quotes -> entities) so a `"` in
  // the URL cannot break out of href="..." and inject an event-handler
  // attribute. escapeHtml ran first but does not touch quotes, so this is the
  // attribute-context guard.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => {
    const href = safeHref(u);
    if (!href) return t;
    const safe = href.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return `<a href="${safe}" class="text-accent underline-offset-2 hover:underline">${t}</a>`;
  });
  // bold **...**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-medium text-ink">$1</strong>');
  // italic *...* (not part of **) and _..._
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])/g, '$1<em>$2</em>');
  return s;
}

const H_CLASS: Record<number, string> = {
  1: 'mt-8 font-display text-3xl text-ink',
  2: 'mt-8 font-display text-2xl text-ink',
  3: 'mt-6 font-sans text-lg font-medium text-ink',
  4: 'mt-5 font-sans text-base font-medium text-ink',
  5: 'mt-4 font-sans text-sm font-medium text-ink',
  6: 'mt-4 font-mono text-xs uppercase tracking-wider text-muted',
};

function isTableSep(line: string): boolean {
  return /^\|?[\s:|-]+\|?$/.test(line.trim()) && line.includes('-');
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

/** Convert a Markdown string to an HTML string. */
export function renderMarkdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // blank
    if (line.trim() === '') {
      i++;
      continue;
    }

    // fenced code
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      out.push(
        `<pre class="mt-4 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-divider bg-parchment-soft/50 p-4 text-[12.5px] leading-relaxed"><code class="font-mono whitespace-pre-wrap break-words text-ink">${escapeHtml(
          body.join('\n'),
        )}</code></pre>`,
      );
      continue;
    }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level} class="${H_CLASS[level]}">${inline(h[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      out.push('<hr class="my-6 border-divider" />');
      i++;
      continue;
    }

    // table (header row + separator)
    if (/^\|.*\|/.test(line.trim()) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|/.test(lines[i].trim())) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const thead = `<thead><tr class="border-b border-divider text-left text-[11px] uppercase tracking-wider text-muted">${header
        .map((c) => `<th class="px-3 py-2 font-medium">${inline(c)}</th>`)
        .join('')}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map(
          (r) =>
            `<tr class="border-b border-divider/60 last:border-0">${r
              .map((c) => `<td class="px-3 py-2 align-top text-ink-soft">${inline(c)}</td>`)
              .join('')}</tr>`,
        )
        .join('')}</tbody>`;
      out.push(
        `<div class="mt-4 overflow-x-auto rounded-md border border-divider"><table class="w-full text-sm">${thead}${tbody}</table></div>`,
      );
      continue;
    }

    // unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      out.push(
        `<ul class="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-soft marker:text-muted">${items
          .map((it) => `<li>${inline(it)}</li>`)
          .join('')}</ul>`,
      );
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      out.push(
        `<ol class="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink-soft marker:text-muted">${items
          .map((it) => `<li>${inline(it)}</li>`)
          .join('')}</ol>`,
      );
      continue;
    }

    // blockquote
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(
        `<blockquote class="mt-4 border-l-2 border-divider pl-4 text-sm italic text-ink-soft">${inline(
          body.join(' '),
        )}</blockquote>`,
      );
      continue;
    }

    // paragraph (collect consecutive plain lines)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) {
      out.push(`<p class="mt-3 text-sm leading-relaxed text-ink-soft">${inline(para.join(' '))}</p>`);
    }
  }

  return out.join('\n');
}

/**
 * Extracts the first level-1 heading as a title, plus the first paragraph as a
 * short description. Used to build the docs index cards without hand-writing
 * a summary per file. Falls back to the slug-derived title.
 */
export function extractFrontMatter(md: string, fallbackTitle: string): { title: string; summary: string } {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let title = fallbackTitle;
  let summary = '';
  for (let i = 0; i < lines.length; i++) {
    const h1 = lines[i].match(/^#\s+(.*)$/);
    if (h1 && title === fallbackTitle) {
      title = h1[1].trim();
      continue;
    }
    const t = lines[i].trim();
    if (
      title !== fallbackTitle &&
      t !== '' &&
      !t.startsWith('#') &&
      !t.startsWith('>') &&
      !t.startsWith('|') &&
      !t.startsWith('```')
    ) {
      summary = t.replace(/[*_`]/g, '');
      break;
    }
  }
  return { title, summary };
}
