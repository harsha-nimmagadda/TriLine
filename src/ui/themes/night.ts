import type { Theme } from './theme';

/** Dark navy board with softly glowing lines and orbs; easy on the eyes. */
export const night: Theme = {
  id: 'night',
  name: 'Night',
  blurb: 'Dark and calm, with softly glowing lines and orbs',
  sideNames: ['Gold orbs', 'Violet orbs'],
  scheme: 'dark',
  swatches: { side0: '#ffd166', side1: '#5a2ed8', board: '#0d1424' },
  cssVars: {
    '--font': "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
    '--bg': '#060a13',
    '--bg-2': '#111c33',
    '--surface': '#111a2e',
    '--surface-2': '#18243e',
    '--panel': 'rgba(150, 180, 255, 0.07)',
    '--panel-strong': 'rgba(150, 180, 255, 0.13)',
    '--text': '#e8f0ff',
    '--text-dim': '#a3b5d6',
    '--accent': '#62e6f5',
    '--accent-hover': '#9af2fb',
    '--accent-ink': '#04161a',
    '--accent-soft': 'rgba(98, 230, 245, 0.14)',
    '--accent-glow': 'rgba(98, 230, 245, 0.3)',
    '--danger': '#ff7f98',
    '--danger-soft': 'rgba(255, 110, 140, 0.15)',
    '--danger-border': 'rgba(255, 110, 140, 0.6)',
    '--on-danger': '#1a0509',
    '--good': '#7dffb3',
    '--info': '#8ab4ff',
    '--border': 'rgba(150, 180, 255, 0.26)',
    '--input-bg': 'rgba(0, 0, 0, 0.35)',
    '--backdrop': 'rgba(2, 4, 10, 0.75)',
    '--shadow': 'rgba(0, 0, 0, 0.6)',
    '--emblem-bg': 'linear-gradient(135deg, #16223e, #0a1020)',
    '--theme-color': '#111c33',
  },
  defs: `
    <radialGradient id="nt-floor" cx="50%" cy="45%" r="75%">
      <stop offset="0%" stop-color="#17233f"/>
      <stop offset="100%" stop-color="#0a101e"/>
    </radialGradient>
    <filter id="nt-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="nt-soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="nt-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="nt-gold" cx="38%" cy="32%" r="80%">
      <stop offset="0%" stop-color="#fffbe6"/>
      <stop offset="55%" stop-color="#ffd166"/>
      <stop offset="100%" stop-color="#e09a12"/>
    </radialGradient>
    <radialGradient id="nt-violet" cx="38%" cy="32%" r="80%">
      <stop offset="0%" stop-color="#a98bff"/>
      <stop offset="50%" stop-color="#5a2ed8"/>
      <stop offset="100%" stop-color="#2f1590"/>
    </radialGradient>
  `,
  floor: `
    <rect x="0" y="0" width="600" height="600" rx="26" fill="url(#nt-floor)"/>
    <rect x="1.5" y="1.5" width="597" height="597" rx="25" fill="none" stroke="#2a3a62" stroke-width="3"/>
  `,
  lines: {
    stroke: '#6fd8ff',
    width: 3.5,
    layers: [{ stroke: '#3ab8ff', width: 11, opacity: 0.35, filter: 'url(#nt-blur)' }],
    pointFill: '#d6f6ff',
    pointRadius: 6,
    pointStroke: '#3ab8ff',
    pointStrokeWidth: 2,
  },
  highlight: { target: '#7dffb3', selected: '#ffffff', capture: '#ff5c7a', mill: '#fff3a0', millFilter: 'url(#nt-glow)' },
  piece(player, r) {
    if (player === 0) {
      // Solid gold orb with a soft halo.
      return `<circle r="${r * 1.12}" fill="#ffc933" opacity="0.5" filter="url(#nt-soft)"/>
        <circle r="${r}" fill="url(#nt-gold)" stroke="#fff6c8" stroke-width="1.6"/>
        <ellipse cx="${-r * 0.3}" cy="${-r * 0.4}" rx="${r * 0.3}" ry="${r * 0.15}" fill="#fff" opacity="0.7" transform="rotate(-25 ${-r * 0.3} ${-r * 0.4})"/>`;
    }
    // Violet orb with a dark core (hole), halo in violet.
    return `<circle r="${r * 1.12}" fill="#8a5cff" opacity="0.55" filter="url(#nt-soft)"/>
      <circle r="${r}" fill="url(#nt-violet)" stroke="#d9ccff" stroke-width="1.6"/>
      <circle r="${r * 0.3}" fill="#0f0630" stroke="#d9ccff" stroke-width="1.2"/>`;
  },
};
