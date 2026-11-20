import type { Theme } from './theme';

/*
 * Rangoli / muggu: white rice-flour powder lines drawn on the packed earth in front of a house.
 * The floor is swept brown-ochre soil; the board lines and points are grainy white powder; each
 * piece is a quick little powder design (a yellow-orange flower versus a violet star).
 * All filters are defined once in `defs` and shared; the piece filter is deliberately light.
 */

const POWDER = '#fffaf0';

/** n small dots on a circle (kolam-style), as SVG circles. */
function dotRing(cx: number, cy: number, r: number, n: number, dot: number, fill: string, offset = 0): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = ((i / n) * 360 + offset) * (Math.PI / 180);
    out += `<circle cx="${(cx + r * Math.cos(a)).toFixed(1)}" cy="${(cy + r * Math.sin(a)).toFixed(1)}" r="${dot}" fill="${fill}"/>`;
  }
  return out;
}

/** A tiny coloured-powder flower (petal dots around a centre dot) for the board corners. */
function cornerFlower(cx: number, cy: number): string {
  return `<g>${dotRing(cx, cy, 11, 8, 3.6, '#ff5fa2')}${dotRing(cx, cy, 5.5, 5, 2.4, '#ffd23f', 18)}<circle cx="${cx}" cy="${cy}" r="2.6" fill="#ffffff"/></g>`;
}

/** Faint powder lotus in the centre of the board. */
function lotus(cx: number, cy: number): string {
  let petals = '';
  for (let i = 0; i < 8; i++) {
    petals += `<ellipse cx="${cx}" cy="${cy - 30}" rx="10" ry="19" fill="#ff7ab8" opacity="0.8" transform="rotate(${i * 45} ${cx} ${cy})"/>`;
  }
  let inner = '';
  for (let i = 0; i < 8; i++) {
    inner += `<ellipse cx="${cx}" cy="${cy - 15}" rx="6" ry="10" fill="#ffd23f" opacity="0.85" transform="rotate(${22.5 + i * 45} ${cx} ${cy})"/>`;
  }
  return `<g filter="url(#rg-soft)" opacity="0.8">${petals}${inner}<circle cx="${cx}" cy="${cy}" r="6" fill="#ff5a1f"/>${dotRing(cx, cy, 44, 24, 2.2, POWDER)}</g>`;
}

const pebbles = [
  [70, 540, 7, 4, '#5a3320'],
  [540, 66, 6, 4, '#c79a6e'],
  [90, 36, 5, 3, '#c79a6e'],
  [566, 410, 6, 4, '#5a3320'],
  [28, 300, 5, 3, '#5a3320'],
  [410, 574, 7, 4, '#c79a6e'],
  [240, 24, 4, 3, '#5a3320'],
  [300, 560, 4, 3, '#c79a6e'],
]
  .map(([x, y, rx, ry, c]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" opacity="0.55"/>`)
  .join('');

export const rangoli: Theme = {
  id: 'rangoli',
  name: 'Rangoli',
  blurb: 'White powder lines on packed earth, with powder-flower pieces',
  sideNames: ['Yellow flowers', 'Violet stars'],
  scheme: 'dark',
  swatches: { side0: '#ffd23f', side1: '#4b1a8f', board: '#a66f43' },
  cssVars: {
    '--font': "'Trebuchet MS', 'Segoe UI', system-ui, -apple-system, sans-serif",
    '--bg': '#2a170d',
    '--bg-2': '#4b2a17',
    '--surface': '#3d2415',
    '--surface-2': '#53321e',
    '--panel': 'rgba(255, 232, 205, 0.09)',
    '--panel-strong': 'rgba(255, 232, 205, 0.16)',
    '--text': '#fff1de',
    '--text-dim': '#e6cbab',
    '--accent': '#ffb02e',
    '--accent-hover': '#ffc760',
    '--accent-ink': '#2a170d',
    '--accent-soft': 'rgba(255, 176, 46, 0.2)',
    '--accent-glow': 'rgba(255, 176, 46, 0.32)',
    '--danger': '#ff9d88',
    '--danger-soft': 'rgba(255, 120, 95, 0.18)',
    '--danger-border': 'rgba(255, 120, 95, 0.65)',
    '--on-danger': '#2a170d',
    '--good': '#9bea9b',
    '--info': '#9fd2ff',
    '--border': 'rgba(255, 232, 205, 0.3)',
    '--input-bg': 'rgba(20, 8, 2, 0.35)',
    '--backdrop': 'rgba(20, 9, 3, 0.72)',
    '--shadow': 'rgba(12, 5, 1, 0.55)',
    '--emblem-bg': 'linear-gradient(135deg, #b07a4c, #7a4a2c)',
    '--theme-color': '#4b2a17',
  },
  defs: `
    <linearGradient id="rg-earth" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#b9804f"/>
      <stop offset="55%" stop-color="#a66f43"/>
      <stop offset="100%" stop-color="#925f38"/>
    </linearGradient>
    <radialGradient id="rg-vignette" cx="50%" cy="50%" r="75%">
      <stop offset="65%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#2a1208" stop-opacity="0.4"/>
    </radialGradient>
    <!-- swept, dung-washed earth: broad soft mottling, faint broom streaks, fine grit -->
    <filter id="rg-mottle" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="8"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.32  0 0 0 0 0.17  0 0 0 0 0.08  1.9 0 0 0 -0.75"/>
    </filter>
    <filter id="rg-sweep" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.004 0.1" numOctaves="2" seed="3"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.96  0 0 0 0 0.78  0 0 0 0 0.55  1.7 0 0 0 -0.95"/>
    </filter>
    <filter id="rg-grit" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="15"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.13  0 0 0 0 0.06  0 0 0 1.1 -0.42"/>
    </filter>
    <!-- powder lines: ragged edges from displacement, grainy holes from a thresholded noise mask -->
    <filter id="rg-powder" x="-3%" y="-3%" width="106%" height="106%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="2" seed="21" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="5.5" result="ragged"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="1" seed="5" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  5.5 0 0 0 -1.15" result="mask"/>
      <feComposite in="ragged" in2="mask" operator="in"/>
    </filter>
    <filter id="rg-soft" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="1" seed="31" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="3" result="ragged"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="9" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  5 0 0 0 -0.9" result="mask"/>
      <feComposite in="ragged" in2="mask" operator="in"/>
    </filter>
    <filter id="rg-dust" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="3.5"/></filter>
    <!-- light filter shared by every piece -->
    <filter id="rg-piece" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="1" seed="12" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.6"/>
    </filter>
    <filter id="rg-shadow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4"/></filter>
    <filter id="rg-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  `,
  floor: `
    <rect x="0" y="0" width="600" height="600" rx="22" fill="url(#rg-earth)"/>
    <rect x="0" y="0" width="600" height="600" rx="22" filter="url(#rg-mottle)" opacity="0.85"/>
    <rect x="0" y="0" width="600" height="600" rx="22" filter="url(#rg-sweep)" opacity="0.12"/>
    <rect x="0" y="0" width="600" height="600" rx="22" filter="url(#rg-grit)" opacity="0.7"/>
    ${pebbles}
    <rect x="0" y="0" width="600" height="600" rx="22" fill="url(#rg-vignette)"/>
    <rect x="3" y="3" width="594" height="594" rx="20" fill="none" stroke="#4a2814" stroke-width="6" opacity="0.7"/>
    <g filter="url(#rg-soft)">
      <rect x="15" y="15" width="570" height="570" rx="14" fill="none" stroke="${POWDER}" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="0.1 11" opacity="0.5"/>
    </g>
    ${cornerFlower(34, 34)}${cornerFlower(566, 34)}${cornerFlower(34, 566)}${cornerFlower(566, 566)}
    ${lotus(300, 300)}
  `,
  lines: {
    stroke: POWDER,
    width: 7,
    filter: 'url(#rg-powder)',
    layers: [{ stroke: '#ffffff', width: 16, opacity: 0.16, filter: 'url(#rg-dust)' }],
    pointFill: POWDER,
    pointRadius: 9,
    pointFilter: 'url(#rg-soft)',
  },
  highlight: { target: '#2fe0cf', selected: '#ffffff', capture: '#ff4d6d', mill: '#ffe27a', millFilter: 'url(#rg-glow)' },
  piece(player, r) {
    const shadow = `<ellipse cx="1.5" cy="${r * 0.35}" rx="${r * 0.95}" ry="${r * 0.55}" fill="#2a1208" opacity="0.35" filter="url(#rg-shadow)"/>`;
    if (player === 0) {
      // Quick powder flower: yellow petals, orange inner petals, red-orange heart.
      let petals = '';
      let inner = '';
      for (let i = 0; i < 8; i++) {
        petals += `<ellipse cx="0" cy="${-r * 0.58}" rx="${r * 0.3}" ry="${r * 0.5}" fill="#ffd23f" transform="rotate(${i * 45})"/>`;
        inner += `<ellipse cx="0" cy="${-r * 0.38}" rx="${r * 0.15}" ry="${r * 0.24}" fill="#ff8a1e" transform="rotate(${i * 45 + 22.5})"/>`;
      }
      return `${shadow}<g filter="url(#rg-piece)">${petals}${inner}<circle r="${r * 0.2}" fill="#e8461a"/><circle r="${r * 0.07}" fill="#fffaf0"/></g>`;
    }
    // Quick powder star: violet eight-point star, pink inner star, dotted white rim.
    const star = (outer: number, innerR: number) => {
      const pts: string[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8 - Math.PI / 2;
        const rad = i % 2 === 0 ? outer : innerR;
        pts.push(`${(rad * Math.cos(a)).toFixed(1)},${(rad * Math.sin(a)).toFixed(1)}`);
      }
      return pts.join(' ');
    };
    let rim = '';
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      rim += `<circle cx="${(r * 1.12 * Math.cos(a)).toFixed(1)}" cy="${(r * 1.12 * Math.sin(a)).toFixed(1)}" r="${(r * 0.09).toFixed(1)}" fill="#fffaf0"/>`;
    }
    return `${shadow}<g filter="url(#rg-piece)">
      <polygon points="${star(r * 1.0, r * 0.55)}" fill="#4b1a8f"/>
      <polygon points="${star(r * 0.62, r * 0.32)}" fill="#ff6fb5"/>
      <circle r="${r * 0.13}" fill="#fffaf0"/>${rim}</g>`;
  },
};
