import type { Theme } from './theme';

/** Chalk lines on a clay/stone floor; light tamarind-style seeds versus dark river pebbles. */
export const traditional: Theme = {
  id: 'traditional',
  name: 'Traditional',
  sideNames: ['Light seeds', 'Dark pebbles'],
  blurb: 'Chalk on a clay floor, seeds and pebbles',
  scheme: 'dark',
  swatches: { side0: '#e6c88a', side1: '#26292e', board: '#b3855a' },
  cssVars: {
    '--font': "'Trebuchet MS', 'Segoe UI', system-ui, -apple-system, sans-serif",
    '--bg': '#2b1f16',
    '--bg-2': '#3a2a1d',
    '--surface': '#3a281b',
    '--surface-2': '#4a3523',
    '--panel': 'rgba(255, 244, 220, 0.08)',
    '--panel-strong': 'rgba(255, 244, 220, 0.14)',
    '--text': '#f4ead5',
    '--text-dim': '#d4c3a0',
    '--accent': '#f2c14e',
    '--accent-hover': '#ffd566',
    '--accent-ink': '#2b1f16',
    '--accent-soft': 'rgba(242, 193, 78, 0.16)',
    '--accent-glow': 'rgba(242, 193, 78, 0.28)',
    '--danger': '#ff8a68',
    '--danger-soft': 'rgba(255, 122, 89, 0.16)',
    '--danger-border': 'rgba(255, 122, 89, 0.6)',
    '--on-danger': '#2b1f16',
    '--good': '#8fe388',
    '--info': '#9ad0ff',
    '--border': 'rgba(255, 244, 220, 0.24)',
    '--input-bg': 'rgba(0, 0, 0, 0.25)',
    '--backdrop': 'rgba(10, 6, 3, 0.66)',
    '--shadow': 'rgba(0, 0, 0, 0.5)',
    '--emblem-bg': 'linear-gradient(135deg, #c79a68, #94673f)',
    '--theme-color': '#3a2a1d',
  },
  defs: `
    <radialGradient id="tr-seed" cx="35%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#fff6d8"/>
      <stop offset="55%" stop-color="#e6c88a"/>
      <stop offset="100%" stop-color="#b58d4a"/>
    </radialGradient>
    <radialGradient id="tr-pebble" cx="35%" cy="30%" r="85%">
      <stop offset="0%" stop-color="#7a7f88"/>
      <stop offset="45%" stop-color="#34373d"/>
      <stop offset="100%" stop-color="#101114"/>
    </radialGradient>
    <linearGradient id="tr-floor" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#c79a68"/>
      <stop offset="50%" stop-color="#b3855a"/>
      <stop offset="100%" stop-color="#94673f"/>
    </linearGradient>
    <radialGradient id="tr-vignette" cx="50%" cy="50%" r="75%">
      <stop offset="60%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.38"/>
    </radialGradient>
    <filter id="tr-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0 0.08  0 0 0 0.55 -0.12"/>
    </filter>
    <filter id="tr-mottle" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="3" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.2  0 0 0 0 0.1  0 0 0 0.9 -0.35"/>
    </filter>
    <filter id="tr-chalk" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="11" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="3.2"/>
    </filter>
    <filter id="tr-shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.2"/>
    </filter>
    <filter id="tr-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  `,
  floor: `
    <rect x="0" y="0" width="600" height="600" rx="26" fill="url(#tr-floor)"/>
    <rect x="0" y="0" width="600" height="600" rx="26" filter="url(#tr-mottle)" opacity="0.55"/>
    <rect x="0" y="0" width="600" height="600" rx="26" filter="url(#tr-grain)" opacity="0.7"/>
    <g fill="#5c3b21" opacity="0.28">
      <ellipse cx="58" cy="540" rx="9" ry="6"/><ellipse cx="540" cy="70" rx="8" ry="5"/>
      <ellipse cx="92" cy="30" rx="6" ry="4"/><ellipse cx="575" cy="420" rx="7" ry="5"/>
      <ellipse cx="25" cy="300" rx="6" ry="4"/><ellipse cx="400" cy="578" rx="8" ry="5"/>
    </g>
    <rect x="0" y="0" width="600" height="600" rx="26" fill="url(#tr-vignette)"/>
    <rect x="3" y="3" width="594" height="594" rx="24" fill="none" stroke="#5a3a20" stroke-width="6" opacity="0.8"/>
  `,
  lines: {
    stroke: '#f6f0e0',
    width: 5,
    filter: 'url(#tr-chalk)',
    pointFill: '#f6f0e0',
    pointRadius: 7.5,
  },
  highlight: {
    target: '#ffd45e',
    selected: '#fff3b0',
    capture: '#ff5a3c',
    mill: '#ffd45e',
    millFilter: 'url(#tr-glow)',
  },
  piece(player, r) {
    const shadow = `<ellipse cx="2" cy="${r * 0.55}" rx="${r * 0.95}" ry="${r * 0.55}" fill="#000" opacity="0.45" filter="url(#tr-shadow)"/>`;
    if (player === 0) {
      // Tamarind-seed-like: a slightly flattened, tilted oval with a groove.
      return `${shadow}
        <g transform="rotate(-24)">
          <ellipse rx="${r * 1.02}" ry="${r * 0.82}" fill="url(#tr-seed)" stroke="#8a6a30" stroke-width="1.6"/>
          <path d="M ${-r * 0.55} ${-r * 0.1} Q 0 ${-r * 0.5} ${r * 0.6} ${-r * 0.05}" fill="none" stroke="#9c7a3c" stroke-width="1.5" opacity="0.7" stroke-linecap="round"/>
          <ellipse cx="${-r * 0.3}" cy="${-r * 0.35}" rx="${r * 0.38}" ry="${r * 0.16}" fill="#fff" opacity="0.5"/>
        </g>`;
    }
    return `${shadow}
      <path d="M ${-r} ${-r * 0.1} C ${-r * 0.95} ${-r * 0.85} ${r * 0.3} ${-r * 1.05} ${r * 0.9} ${-r * 0.5} C ${r * 1.1} ${r * 0.3} ${r * 0.5} ${r * 0.95} ${-r * 0.3} ${r * 0.9} C ${-r * 0.85} ${r * 0.8} ${-r * 1.05} ${r * 0.4} ${-r} ${-r * 0.1} Z"
        fill="url(#tr-pebble)" stroke="#050506" stroke-width="1.5"/>
      <ellipse cx="${-r * 0.3}" cy="${-r * 0.42}" rx="${r * 0.36}" ry="${r * 0.17}" fill="#fff" opacity="0.32" transform="rotate(-20 ${-r * 0.3} ${-r * 0.42})"/>`;
  },
};
