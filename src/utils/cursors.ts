/**
 * Custom SVG data-URI cursors mirroring `_ve_con_tro` in the PyQt6 source:
 * - chon: crosshair with open center, optional orange intersection ring, and step badge (1 / 2 / 3)
 * - them: crosshair with open center, optional orange intersection ring, and green (+) badge
 * - xoa:  crosshair with open center and red (x) badge
 */

export type CursorKey =
  | { kind: 'default' }
  | { kind: 'std'; css: string }
  | { kind: 'custom'; mode: 'chon' | 'them' | 'xoa'; orangeRing: boolean; stepText: string };

const cursorCache = new Map<string, string>();

function buildCustomCursorSvg(
  mode: 'chon' | 'them' | 'xoa',
  orangeRing: boolean,
  stepText: string
): string {
  const n = 32;
  const c = 16; // hotspot center
  const bx = 25;
  const by = 25;

  const arms = [
    [c - 11, c, c - 4, c],
    [c + 4, c, c + 11, c],
    [c, c - 11, c, c - 4],
    [c, c + 4, c, c + 11],
  ];

  const whiteCross = arms
    .map(
      ([x1, y1, x2, y2]) =>
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round"/>`
    )
    .join('');

  const blackCross = arms
    .map(
      ([x1, y1, x2, y2]) =>
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000000" stroke-width="1.4" stroke-linecap="round"/>`
    )
    .join('');

  const ring = orangeRing
    ? `<circle cx="${c}" cy="${c}" r="7.5" fill="none" stroke="#ffffff" stroke-width="3.6"/>` +
      `<circle cx="${c}" cy="${c}" r="7.5" fill="none" stroke="#e67800" stroke-width="2.0"/>`
    : '';

  const badgeBg =
    mode === 'chon' ? '#d81b60' : mode === 'them' ? '#2e7d32' : '#d32f2f';

  let badgeGlyph = '';
  if (mode === 'them') {
    badgeGlyph =
      `<line x1="${bx - 3}" y1="${by}" x2="${bx + 3}" y2="${by}" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round"/>` +
      `<line x1="${bx}" y1="${by - 3}" x2="${bx}" y2="${by + 3}" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round"/>`;
  } else if (mode === 'xoa') {
    badgeGlyph =
      `<line x1="${bx - 2.6}" y1="${by - 2.6}" x2="${bx + 2.6}" y2="${by + 2.6}" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round"/>` +
      `<line x1="${bx - 2.6}" y1="${by + 2.6}" x2="${bx + 2.6}" y2="${by - 2.6}" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round"/>`;
  } else {
    badgeGlyph = `<text x="${bx}" y="${by + 3.5}" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="700" fill="#ffffff">${stepText}</text>`;
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 ${n} ${n}">` +
    whiteCross +
    blackCross +
    ring +
    `<circle cx="${bx}" cy="${by}" r="6" fill="${badgeBg}" stroke="#ffffff" stroke-width="1.6"/>` +
    badgeGlyph +
    `</svg>`;

  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${c} ${c}, crosshair`;
}

export function resolveCursorCss(key: CursorKey): string {
  if (key.kind === 'default') return 'default';
  if (key.kind === 'std') return key.css;
  const cacheKey = `${key.mode}|${key.orangeRing ? 1 : 0}|${key.stepText}`;
  let css = cursorCache.get(cacheKey);
  if (!css) {
    css = buildCustomCursorSvg(key.mode, key.orangeRing, key.stepText);
    cursorCache.set(cacheKey, css);
  }
  return css;
}
