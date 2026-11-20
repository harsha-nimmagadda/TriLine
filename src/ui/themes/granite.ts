import type { Theme } from './theme';

/** Unpolished speckled granite floor, chalk lines, cowrie shells versus dark river stones. */
export const granite: Theme = {
  id: 'granite',
  name: 'Granite',
  blurb: 'Rough speckled granite, chalk lines, cowries and river stones',
  sideNames: ['Cowrie shells', 'River stones'],
  scheme: 'dark',
  swatches: { side0: '#f1e6cf', side1: '#1b1c1f', board: '#8b8882' },
  cssVars: {
    '--font': "'Segoe UI', 'Helvetica Neue', system-ui, -apple-system, sans-serif",
    '--bg': '#1c1e22',
    '--bg-2': '#2d3036',
    '--surface': '#2a2c31',
    '--surface-2': '#383a41',
    '--panel': 'rgba(255, 255, 255, 0.07)',
    '--panel-strong': 'rgba(255, 255, 255, 0.13)',
    '--text': '#f3f1ec',
    '--text-dim': '#c7c3ba',
    '--accent': '#f0b4a4',
    '--accent-hover': '#ffcdbf',
    '--accent-ink': '#2a1b18',
    '--accent-soft': 'rgba(240, 180, 164, 0.16)',
    '--accent-glow': 'rgba(240, 180, 164, 0.28)',
    '--danger': '#ff8c78',
    '--danger-soft': 'rgba(255, 140, 120, 0.16)',
    '--danger-border': 'rgba(255, 140, 120, 0.6)',
    '--on-danger': '#2a1b18',
    '--good': '#9be39a',
    '--info': '#9cc9ff',
    '--border': 'rgba(255, 255, 255, 0.24)',
    '--input-bg': 'rgba(0, 0, 0, 0.28)',
    '--backdrop': 'rgba(8, 9, 11, 0.7)',
    '--shadow': 'rgba(0, 0, 0, 0.55)',
    '--emblem-bg': 'linear-gradient(135deg, #8a8882, #5f5d59)',
    '--theme-color': '#2d3036',
  },
  // PLACEHOLDER raster assets (SDXL-Turbo drafts); to be replaced by full-quality generations.
  assets: {
    board: { high: 'assets/granite/board.high.webp', ultra: 'assets/granite/board.ultra.webp' },
    boardTile: 300,
    background: { high: 'assets/granite/background.high.webp', ultra: 'assets/granite/background.ultra.webp' },
    pieces: [
      { high: 'assets/granite/piece_p1.high.webp', ultra: 'assets/granite/piece_p1.ultra.webp' },
      { high: 'assets/granite/piece_p2.high.webp', ultra: 'assets/granite/piece_p2.ultra.webp' },
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
    <radialGradient id="gr-cowrie" cx="38%" cy="30%" r="85%">
      <stop offset="0%" stop-color="#fffaf0"/>
      <stop offset="60%" stop-color="#f0e2c6"/>
      <stop offset="100%" stop-color="#cdb88e"/>
    </radialGradient>
    <radialGradient id="gr-stone" cx="35%" cy="28%" r="85%">
      <stop offset="0%" stop-color="#6c7078"/>
      <stop offset="50%" stop-color="#2b2d32"/>
      <stop offset="100%" stop-color="#0c0d0f"/>
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
  highlight: { target: '#ffe07a', selected: '#ffffff', capture: '#ff5a3c', mill: '#ffe07a', millFilter: 'url(#gr-glow)' },
  piece(player, r) {
    const shadow = `<ellipse cx="2" cy="${r * 0.55}" rx="${r * 0.95}" ry="${r * 0.55}" fill="#000" opacity="0.5" filter="url(#gr-shadow)"/>`;
    if (player === 0) {
      // Cowrie shell: cream oval with a toothed dorsal slit.
      const teeth = [-0.62, -0.42, -0.22, -0.02, 0.18, 0.38, 0.58]
        .map((y) => `<path d="M ${-r * 0.2} ${r * y} h ${r * 0.4}" stroke="#7a6746" stroke-width="1.3" stroke-linecap="round"/>`)
        .join('');
      return `${shadow}
        <g transform="rotate(-18)">
          <ellipse rx="${r * 0.84}" ry="${r * 1.04}" fill="url(#gr-cowrie)" stroke="#5e4f36" stroke-width="1.8"/>
          <path d="M 0 ${-r * 0.74} Q ${r * 0.1} 0 0 ${r * 0.74}" fill="none" stroke="#6a5838" stroke-width="3.2" stroke-linecap="round"/>
          ${teeth}
          <ellipse cx="${-r * 0.42}" cy="${-r * 0.4}" rx="${r * 0.18}" ry="${r * 0.36}" fill="#fff" opacity="0.55"/>
        </g>`;
    }
    // River stone: dark pebble with a light rim and white flecks (readable on dark specks).
    return `${shadow}
      <path d="M ${-r} ${-r * 0.1} C ${-r * 0.95} ${-r * 0.85} ${r * 0.3} ${-r * 1.05} ${r * 0.92} ${-r * 0.45} C ${r * 1.1} ${r * 0.3} ${r * 0.5} ${r * 0.98} ${-r * 0.3} ${r * 0.92} C ${-r * 0.88} ${r * 0.8} ${-r * 1.05} ${r * 0.4} ${-r} ${-r * 0.1} Z"
        fill="url(#gr-stone)" stroke="#dcd7cb" stroke-width="2"/>
      <circle cx="${r * 0.35}" cy="${r * 0.28}" r="${r * 0.07}" fill="#eae6da" opacity="0.85"/>
      <circle cx="${-r * 0.1}" cy="${r * 0.5}" r="${r * 0.05}" fill="#eae6da" opacity="0.7"/>
      <circle cx="${r * 0.55}" cy="${-r * 0.1}" r="${r * 0.05}" fill="#eae6da" opacity="0.7"/>
      <ellipse cx="${-r * 0.3}" cy="${-r * 0.42}" rx="${r * 0.34}" ry="${r * 0.15}" fill="#fff" opacity="0.28" transform="rotate(-20 ${-r * 0.3} ${-r * 0.42})"/>`;
  },
};
