// Browser-side design token extractor for Atrium.html / Atrium App.standalone.html
//
// HOW TO USE
//   1. Open desing/Atrium.html in Chrome.
//   2. Wait for the loading message to disappear (the React bundle unpacks).
//   3. Open DevTools → Console.
//   4. Paste this entire file into the console and press Enter.
//   5. The script prints a JSON blob with every computed style token.
//   6. Save the printed JSON to desing/extracted/full-render-tokens.json.
//
// What it captures:
//   - Every distinct color used in computed styles
//   - Every distinct font-family
//   - Every distinct font-size
//   - Every distinct border-radius
//   - Every distinct box-shadow
//   - Every distinct spacing (margin/padding)
//   - The full rendered <html> snapshot for visual reference

(function extractAtriumTokens() {
  const tokens = {
    capturedAt: new Date().toISOString(),
    url: location.href,
    title: document.title,
    colors: new Set(),
    fontFamilies: new Set(),
    fontSizes: new Set(),
    fontWeights: new Set(),
    lineHeights: new Set(),
    letterSpacings: new Set(),
    borderRadii: new Set(),
    boxShadows: new Set(),
    spacings: new Set(),
    backgrounds: new Set(),
    transitions: new Set(),
    cursors: new Set(),
  };

  function walk(node) {
    if (!(node instanceof Element)) return;
    const cs = getComputedStyle(node);
    [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderBottomColor, cs.borderLeftColor, cs.borderRightColor, cs.fill, cs.stroke]
      .filter((c) => c && c !== 'rgba(0, 0, 0, 0)' && c !== 'rgb(0, 0, 0)')
      .forEach((c) => tokens.colors.add(c));

    if (cs.fontFamily) tokens.fontFamilies.add(cs.fontFamily);
    if (cs.fontSize) tokens.fontSizes.add(cs.fontSize);
    if (cs.fontWeight && cs.fontWeight !== '400') tokens.fontWeights.add(cs.fontWeight);
    if (cs.lineHeight && cs.lineHeight !== 'normal') tokens.lineHeights.add(cs.lineHeight);
    if (cs.letterSpacing && cs.letterSpacing !== 'normal') tokens.letterSpacings.add(cs.letterSpacing);
    if (cs.borderRadius && cs.borderRadius !== '0px') tokens.borderRadii.add(cs.borderRadius);
    if (cs.boxShadow && cs.boxShadow !== 'none') tokens.boxShadows.add(cs.boxShadow);
    if (cs.background && !cs.background.startsWith('rgba(0, 0, 0, 0)')) tokens.backgrounds.add(cs.background);
    if (cs.transition && cs.transition !== 'all 0s ease 0s') tokens.transitions.add(cs.transition);
    if (cs.cursor && cs.cursor !== 'auto' && cs.cursor !== 'default') tokens.cursors.add(cs.cursor);

    for (const prop of ['marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight']) {
      const v = cs[prop];
      if (v && v !== '0px') tokens.spacings.add(v);
    }

    for (const child of node.children) walk(child);
  }

  walk(document.documentElement);

  const serializable = Object.fromEntries(
    Object.entries(tokens).map(([k, v]) => [k, v instanceof Set ? [...v].sort() : v])
  );
  serializable.htmlSnapshot = document.documentElement.outerHTML.slice(0, 500_000);

  console.log('--- ATRIUM DESIGN TOKENS ---');
  console.log(JSON.stringify(serializable, null, 2));
  console.log('--- END ---');
  console.log('Copy everything between the two markers and save to desing/extracted/full-render-tokens.json');

  return serializable;
})();
