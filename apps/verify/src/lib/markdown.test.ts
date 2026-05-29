import { describe, it, expect } from 'vitest';
import { renderMarkdownToHtml, extractFrontMatter } from './markdown';

describe('renderMarkdownToHtml', () => {
  it('renders headings at each level', () => {
    expect(renderMarkdownToHtml('# Title')).toContain('<h1');
    expect(renderMarkdownToHtml('### Sub')).toContain('<h3');
    expect(renderMarkdownToHtml('# Title')).toContain('Title');
  });

  it('renders paragraphs and joins wrapped lines', () => {
    const html = renderMarkdownToHtml('one line\ntwo line');
    expect(html).toContain('<p');
    expect(html).toContain('one line two line');
  });

  it('renders fenced code without applying inline formatting inside', () => {
    const html = renderMarkdownToHtml('```\nconst x = `a` **b**\n```');
    expect(html).toContain('<pre');
    expect(html).toContain('<code');
    // inside code, backticks/asterisks are literal, not converted
    expect(html).not.toContain('<strong');
  });

  it('renders inline code, bold, italic, and links', () => {
    expect(renderMarkdownToHtml('use `foo`')).toContain('<code');
    expect(renderMarkdownToHtml('**bold**')).toContain('<strong');
    expect(renderMarkdownToHtml('a *em* b')).toContain('<em>em</em>');
    const link = renderMarkdownToHtml('[docs](https://x.io)');
    expect(link).toContain('href="https://x.io"');
    expect(link).toContain('>docs</a>');
  });

  it('renders unordered and ordered lists', () => {
    expect(renderMarkdownToHtml('- a\n- b')).toContain('<ul');
    expect(renderMarkdownToHtml('1. a\n2. b')).toContain('<ol');
  });

  it('renders GFM tables', () => {
    const html = renderMarkdownToHtml('| A | B |\n| --- | --- |\n| 1 | 2 |');
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('<td');
    expect(html).toContain('>1<');
  });

  it('renders blockquotes and horizontal rules', () => {
    expect(renderMarkdownToHtml('> quoted')).toContain('<blockquote');
    expect(renderMarkdownToHtml('---')).toContain('<hr');
  });

  it('escapes raw HTML in text to prevent injection', () => {
    const html = renderMarkdownToHtml('a <script>alert(1)</script> b');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('strips unsafe link schemes (javascript:) to plain text', () => {
    const html = renderMarkdownToHtml('[click](javascript:alert(1))');
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('click');
  });

  it('keeps safe relative and mailto links', () => {
    expect(renderMarkdownToHtml('[x](/docs/y)')).toContain('href="/docs/y"');
    expect(renderMarkdownToHtml('[m](mailto:a@b.io)')).toContain('href="mailto:a@b.io"');
  });
});

describe('extractFrontMatter', () => {
  it('pulls the first h1 as title and first paragraph as summary', () => {
    const { title, summary } = extractFrontMatter('# Incident: Lantern\n\nWhat to do when the attestor stalls.', 'fallback');
    expect(title).toBe('Incident: Lantern');
    expect(summary).toBe('What to do when the attestor stalls.');
  });

  it('falls back to the provided title when there is no h1', () => {
    const { title } = extractFrontMatter('no heading here', 'my-slug');
    expect(title).toBe('my-slug');
  });
});
