import type { Theme } from './theme';

/** Polished carved wooden board, brass versus ebony pieces. */
export const wooden: Theme = {
  id: 'wooden',
  name: 'Wooden',
  blurb: 'Polished carved wood, brass and ebony pieces',
  sideNames: ['Brass', 'Ebony'],
  scheme: 'dark',
  swatches: { side0: '#d9aa38', side1: '#1c1410', board: '#a06a30' },
  cssVars: {
    '--font': "Georgia, 'Palatino Linotype', 'Times New Roman', serif",
    '--bg': '#1d120a',
    '--bg-2': '#36210f',
    '--surface': '#3a2713',
    '--surface-2': '#4c3319',
    '--panel': 'rgba(255, 233, 196, 0.08)',
    '--panel-strong': 'rgba(255, 233, 196, 0.15)',
    '--text': '#f7ecd8',
    '--text-dim': '#dcc7a3',
    '--accent': '#eabd4c',
    '--accent-hover': '#ffd36b',
    '--accent-ink': '#2a1a05',
    '--accent-soft': 'rgba(234, 189, 76, 0.18)',
    '--accent-glow': 'rgba(234, 189, 76, 0.28)',
    '--danger': '#ff8d6b',
    '--danger-soft': 'rgba(255, 120, 90, 0.17)',
    '--danger-border': 'rgba(255, 120, 90, 0.6)',
    '--on-danger': '#2a1a05',
    '--good': '#a3e68f',
    '--info': '#a5d2ff',
    '--border': 'rgba(255, 233, 196, 0.26)',
    '--input-bg': 'rgba(0, 0, 0, 0.3)',
    '--backdrop': 'rgba(12, 6, 2, 0.7)',
    '--shadow': 'rgba(0, 0, 0, 0.55)',
    '--emblem-bg': 'linear-gradient(135deg, #c98d4a, #8a5424)',
    '--theme-color': '#36210f',
  },
  defs: `
    <linearGradient id="wd-base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#c58a46"/>
      <stop offset="45%" stop-color="#ad7336"/>
      <stop offset="100%" stop-color="#8d5826"/>
    </linearGradient>
    <filter id="wd-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.34" numOctaves="3" seed="5"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.22  0 0 0 0 0.11  0 0 0 0 0.04  -1.9 0 0 0 1.12"/>
    </filter>
    <filter id="wd-grain2" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.03 0.6" numOctaves="2" seed="12"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.98  0 0 0 0 0.8  0 0 0 0 0.5  1.8 0 0 0 -0.95"/>
    </filter>
    <linearGradient id="wd-gloss" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.34"/>
      <stop offset="35%" stop-color="#fff" stop-opacity="0.05"/>
      <stop offset="60%" stop-color="#fff" stop-opacity="0"/>
      <stop offset="85%" stop-color="#fff" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0.02"/>
    </linearGradient>
    <radialGradient id="wd-brass" cx="36%" cy="30%" r="85%">
      <stop offset="0%" stop-color="#fff3b0"/>
      <stop offset="45%" stop-color="#e3b53e"/>
      <stop offset="100%" stop-color="#94691a"/>
    </radialGradient>
    <radialGradient id="wd-ebony" cx="36%" cy="30%" r="85%">
      <stop offset="0%" stop-color="#6b5a4e"/>
      <stop offset="45%" stop-color="#241a14"/>
      <stop offset="100%" stop-color="#080504"/>
    </radialGradient>
    <filter id="wd-shadow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4"/></filter>
    <filter id="wd-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  `,
  floor: `
    <rect x="0" y="0" width="600" height="600" rx="22" fill="url(#wd-base)"/>
    <rect x="0" y="0" width="600" height="600" rx="22" filter="url(#wd-grain)" opacity="0.75"/>
    <rect x="0" y="0" width="600" height="600" rx="22" filter="url(#wd-grain2)" opacity="0.4"/>
    <rect x="0" y="0" width="600" height="600" rx="22" fill="url(#wd-gloss)"/>
    <rect x="5" y="5" width="590" height="590" rx="19" fill="none" stroke="#3a210e" stroke-width="10"/>
    <rect x="11" y="11" width="578" height="578" rx="15" fill="none" stroke="#e6bd7e" stroke-width="1.6" opacity="0.55"/>
  `,
  lines: {
    stroke: '#3a210e',
    width: 6,
    layers: [{ stroke: '#f0cf98', width: 3, dy: 2.2, opacity: 0.7 }],
    pointFill: '#2a1608',
    pointRadius: 9,
    pointStroke: '#f0cf98',
    pointStrokeWidth: 1.8,
  },
  highlight: { target: '#ffe27a', selected: '#fff6c8', capture: '#ff4d2e', mill: '#ffe27a', millFilter: 'url(#wd-glow)' },
  piece(player, r) {
    const shadow = `<ellipse cx="2" cy="${r * 0.6}" rx="${r}" ry="${r * 0.55}" fill="#000" opacity="0.5" filter="url(#wd-shadow)"/>`;
    if (player === 0) {
      // Brass disc with an engraved ring.
      return `${shadow}
        <circle r="${r}" fill="url(#wd-brass)" stroke="#5a3f08" stroke-width="2"/>
        <circle r="${r * 0.62}" fill="none" stroke="#7a5510" stroke-width="2" opacity="0.8"/>
        <ellipse cx="${-r * 0.32}" cy="${-r * 0.42}" rx="${r * 0.36}" ry="${r * 0.16}" fill="#fff" opacity="0.55" transform="rotate(-25 ${-r * 0.32} ${-r * 0.42})"/>`;
    }
    // Ebony disc with a brass rim and an inlaid brass dot.
    return `${shadow}
      <circle r="${r}" fill="url(#wd-ebony)" stroke="#d6a94e" stroke-width="2"/>
      <circle r="${r * 0.2}" fill="#e3b53e" stroke="#6f4f0c" stroke-width="1"/>
      <ellipse cx="${-r * 0.32}" cy="${-r * 0.44}" rx="${r * 0.32}" ry="${r * 0.13}" fill="#fff" opacity="0.28" transform="rotate(-25 ${-r * 0.32} ${-r * 0.44})"/>`;
  },
};
