import type { Theme } from './theme';

/** Granite: speckled stone with chalk lines at Low/Medium; at High/Ultra a carved black-granite slab on a wooden table. Tiger's eye versus lapis cabochons. */
export const granite: Theme = {
  id: 'granite',
  name: 'Granite',
  blurb: 'Carved granite slab, tiger\'s eye and lapis stones',
  sideNames: ['Tiger\'s eye', 'Lapis'],
  scheme: 'dark',
  swatches: { side0: '#d99a3a', side1: '#142a85', board: '#555550' },
  cssVars: {
    '--font': "'Segoe UI', 'Helvetica Neue', system-ui, -apple-system, sans-serif",
    '--bg': '#1a1612',
    '--bg-2': '#2c241c',
    '--surface': '#2a231c',
    '--surface-2': '#382e24',
    '--panel': 'rgba(255, 238, 214, 0.07)',
    '--panel-strong': 'rgba(255, 238, 214, 0.13)',
    '--text': '#f6efe4',
    '--text-dim': '#d2c5b2',
    '--accent': '#e6b36e',
    '--accent-hover': '#f3c88e',
    '--accent-ink': '#251a0d',
    '--accent-soft': 'rgba(230, 179, 110, 0.16)',
    '--accent-glow': 'rgba(230, 179, 110, 0.28)',
    '--danger': '#ff9478',
    '--danger-soft': 'rgba(255, 148, 120, 0.16)',
    '--danger-border': 'rgba(255, 148, 120, 0.6)',
    '--on-danger': '#251a0d',
    '--good': '#a6e39a',
    '--info': '#a4cdff',
    '--border': 'rgba(255, 238, 214, 0.24)',
    '--input-bg': 'rgba(0, 0, 0, 0.3)',
    '--backdrop': 'rgba(10, 8, 5, 0.72)',
    '--shadow': 'rgba(0, 0, 0, 0.55)',
    '--emblem-bg': 'linear-gradient(135deg, #5b564e, #2c2925)',
    '--theme-color': '#2c241c',
  },
  // Raster assets for High / Ultra: a carved-granite board rendered from the game geometry (tools/assetgen),
  // a rustic wooden table as page background, and polished gemstone cabochons.
  assets: {
    board: { high: 'assets/granite/board.high.webp', ultra: 'assets/granite/board.ultra.webp' },
    boardIncludesLines: true,
    pieceShadow: 'assets/granite/piece_shadow.webp',
    background: { high: 'assets/granite/table.high.webp', ultra: 'assets/granite/table.ultra.webp' },
    pieces: [
      {
        high: 'assets/granite/piece_p1_0.high.webp',
        ultra: 'assets/granite/piece_p1_0.ultra.webp',
        ultraVariants: [0, 1, 2, 3, 4, 5].map((i) => `assets/granite/piece_p1_${i}.ultra.webp`),
      },
      {
        high: 'assets/granite/piece_p2_0.high.webp',
        ultra: 'assets/granite/piece_p2_0.ultra.webp',
        ultraVariants: [0, 1, 2, 3, 4, 5].map((i) => `assets/granite/piece_p2_${i}.ultra.webp`),
      },
    ],
  },
  defs: `
    <linearGradient id="gr-base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#99968f"/>
      <stop offset="50%" stop-color="#8b8882"/>
      <stop offset="100%" stop-color="#7c7a74"/>
    </linearGradient>
    <filter id="gr-mottle" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="21"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.12  0 0 0 0 0.13  1.6 0 0 0 -0.62"/>
    </filter>
    <filter id="gr-dark" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="2" seed="4"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.05  0 0 0 0 0.05  0 0 0 0 0.06  9 0 0 0 -5.75"/>
    </filter>
    <filter id="gr-pink" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="2" seed="9"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.80  0 0 0 0 0.58  0 0 0 0 0.56  9 0 0 0 -5.2"/>
    </filter>
    <filter id="gr-quartz" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="2"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.93  0 0 0 0 0.92  0 0 0 0 0.9  10 0 0 0 -6.6"/>
    </filter>
    <filter id="gr-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="1" seed="13"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.1  0 0 0 0 0.1  0 0 0 0.9 -0.35"/>
    </filter>
    <filter id="gr-chalk" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="17" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="2.4"/>
    </filter>
    <filter id="gr-shadow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="gr-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="gr-tiger" cx="38%" cy="30%" r="85%">
      <stop offset="0%" stop-color="#f0c060"/>
      <stop offset="55%" stop-color="#c98a2b"/>
      <stop offset="100%" stop-color="#7a4a12"/>
    </radialGradient>
    <radialGradient id="gr-lapis" cx="38%" cy="30%" r="85%">
      <stop offset="0%" stop-color="#4a6be0"/>
      <stop offset="55%" stop-color="#1f3fae"/>
      <stop offset="100%" stop-color="#0c1c66"/>
    </radialGradient>
  `,
  floor: `
    <rect x="0" y="0" width="600" height="600" rx="22" fill="url(#gr-base)"/>
    <rect x="0" y="0" width="600" height="600" rx="22" filter="url(#gr-mottle)" opacity="0.5"/>
    <rect x="0" y="0" width="600" height="600" rx="22" filter="url(#gr-pink)" opacity="0.8"/>
    <rect x="0" y="0" width="600" height="600" rx="22" filter="url(#gr-dark)" opacity="0.8"/>
    <rect x="0" y="0" width="600" height="600" rx="22" filter="url(#gr-quartz)" opacity="0.6"/>
    <rect x="0" y="0" width="600" height="600" rx="22" filter="url(#gr-grain)" opacity="0.35"/>
    <rect x="3" y="3" width="594" height="594" rx="20" fill="none" stroke="#3b3a37" stroke-width="6" opacity="0.85"/>
  `,
  lines: {
    stroke: '#fbfaf4',
    width: 7,
    filter: 'url(#gr-chalk)',
    layers: [{ stroke: '#000', width: 10, opacity: 0.35, dx: 1, dy: 2 }],
    pointFill: '#fbfaf4',
    pointRadius: 8,
    pointStroke: '#3b3a37',
    pointStrokeWidth: 1.5,
  },
  highlight: { target: '#ffd79a', selected: '#fff3da', capture: '#ff8a4d', mill: '#ffd27a', millFilter: 'url(#gr-glow)' },
  piece(player, r) {
    const shadow = `<ellipse cx="2" cy="${r * 0.5}" rx="${r * 0.95}" ry="${r * 0.55}" fill="#000" opacity="0.5" filter="url(#gr-shadow)"/>`;
    if (player === 0) {
      // Tiger's eye cabochon: golden brown with dark chatoyant bands and a soft highlight.
      const band = (x: number, w: number, o: number) => {
        const ry = 0.92 * Math.sqrt(Math.max(0, 1 - x * x)) * r;
        return `<ellipse cx="${x * r}" cy="0" rx="${w * r}" ry="${ry}" fill="#2a1406" opacity="${o}"/>`;
      };
      return `${shadow}
        <circle r="${r}" fill="url(#gr-tiger)" stroke="#4a2a0a" stroke-width="1.6"/>
        ${band(-0.32, 0.07, 0.75)}${band(0.12, 0.1, 0.8)}${band(0.45, 0.05, 0.6)}
        <ellipse cx="${-r * 0.3}" cy="${-r * 0.42}" rx="${r * 0.3}" ry="${r * 0.14}" fill="#fff" opacity="0.5" transform="rotate(-28 ${-r * 0.3} ${-r * 0.42})"/>`;
    }
    // Lapis lazuli cabochon: deep blue with gold pyrite flecks.
    const fleck = (x: number, y: number, k: number) => `<circle cx="${x * r}" cy="${y * r}" r="${k * r}" fill="#e8c158" opacity="0.9"/>`;
    return `${shadow}
      <circle r="${r}" fill="url(#gr-lapis)" stroke="#0a1650" stroke-width="1.6"/>
      ${fleck(0.35, 0.2, 0.05)}${fleck(-0.2, 0.45, 0.04)}${fleck(0.1, -0.4, 0.035)}${fleck(-0.5, -0.05, 0.03)}${fleck(0.55, -0.35, 0.03)}
      <ellipse cx="${-r * 0.3}" cy="${-r * 0.42}" rx="${r * 0.3}" ry="${r * 0.14}" fill="#fff" opacity="0.4" transform="rotate(-28 ${-r * 0.3} ${-r * 0.42})"/>`;
  },
};
