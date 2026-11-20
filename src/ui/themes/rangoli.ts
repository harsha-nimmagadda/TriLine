import type { Theme } from './theme';

/** Festive rangoli: a cream floor with kolam dots, flower motifs and bright marigold / violet pieces. */
export const rangoli: Theme = {
  id: 'rangoli',
  name: 'Rangoli',
  blurb: 'Festive colours, flower motifs and kolam dots',
  sideNames: ['Marigolds', 'Violet gems'],
  scheme: 'dark',
  swatches: { side0: '#ffb629', side1: '#4a1070', board: '#fff2d9' },
  cssVars: {
    '--font': "'Trebuchet MS', 'Segoe UI', system-ui, -apple-system, sans-serif",
    '--bg': '#2a0d3a',
    '--bg-2': '#4d1763',
    '--surface': '#3b1052',
    '--surface-2': '#52196f',
    '--panel': 'rgba(255, 224, 246, 0.1)',
    '--panel-strong': 'rgba(255, 224, 246, 0.18)',
    '--text': '#fff4e6',
    '--text-dim': '#e9cdf2',
    '--accent': '#ffb629',
    '--accent-hover': '#ffcc5c',
    '--accent-ink': '#2a0d3a',
    '--accent-soft': 'rgba(255, 182, 41, 0.2)',
    '--accent-glow': 'rgba(255, 182, 41, 0.34)',
    '--danger': '#ff8fa3',
    '--danger-soft': 'rgba(255, 110, 140, 0.18)',
    '--danger-border': 'rgba(255, 110, 140, 0.65)',
    '--on-danger': '#2a0d3a',
    '--good': '#8cf0b0',
    '--info': '#93d5ff',
    '--border': 'rgba(255, 224, 246, 0.3)',
    '--input-bg': 'rgba(20, 0, 30, 0.35)',
    '--backdrop': 'rgba(18, 4, 28, 0.72)',
    '--shadow': 'rgba(10, 0, 20, 0.55)',
    '--emblem-bg': 'linear-gradient(135deg, #ffd8a8, #f783ac)',
    '--theme-color': '#4d1763',
  },
  defs: `
    <linearGradient id="rg-base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff6e0"/>
      <stop offset="100%" stop-color="#ffe6bd"/>
    </linearGradient>
    <radialGradient id="rg-marigold" cx="50%" cy="80%" r="90%">
      <stop offset="0%" stop-color="#ff9d00"/>
      <stop offset="100%" stop-color="#ffd23f"/>
    </radialGradient>
    <radialGradient id="rg-gem" cx="36%" cy="30%" r="85%">
      <stop offset="0%" stop-color="#b650e8"/>
      <stop offset="50%" stop-color="#6a1b9a"/>
      <stop offset="100%" stop-color="#2d0a4d"/>
    </radialGradient>
    <filter id="rg-shadow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="rg-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  `,
  floor: `
    <rect x="0" y="0" width="600" height="600" rx="26" fill="url(#rg-base)"/>
    <rect x="15" y="15" width="570" height="570" rx="18" fill="none" stroke="#d6336c" stroke-width="7" stroke-linecap="round" stroke-dasharray="0 17"/>
    <rect x="15" y="15" width="570" height="570" rx="18" fill="none" stroke="#f08c00" stroke-width="5" stroke-linecap="round" stroke-dasharray="0 17" stroke-dashoffset="8.5"/>
    <circle cx="300" cy="300" r="62" fill="#ffe0f0" opacity="0.8"/>
    <ellipse cx="0" cy="-40" rx="9" ry="22" fill="#f783ac" stroke="#c2255c" stroke-width="1.2" opacity="0.9" transform="translate(300 300) rotate(0.0)"/><ellipse cx="0" cy="-40" rx="9" ry="22" fill="#f783ac" stroke="#c2255c" stroke-width="1.2" opacity="0.9" transform="translate(300 300) rotate(30.0)"/><ellipse cx="0" cy="-40" rx="9" ry="22" fill="#f783ac" stroke="#c2255c" stroke-width="1.2" opacity="0.9" transform="translate(300 300) rotate(60.0)"/><ellipse cx="0" cy="-40" rx="9" ry="22" fill="#f783ac" stroke="#c2255c" stroke-width="1.2" opacity="0.9" transform="translate(300 300) rotate(90.0)"/><ellipse cx="0" cy="-40" rx="9" ry="22" fill="#f783ac" stroke="#c2255c" stroke-width="1.2" opacity="0.9" transform="translate(300 300) rotate(120.0)"/><ellipse cx="0" cy="-40" rx="9" ry="22" fill="#f783ac" stroke="#c2255c" stroke-width="1.2" opacity="0.9" transform="translate(300 300) rotate(150.0)"/><ellipse cx="0" cy="-40" rx="9" ry="22" fill="#f783ac" stroke="#c2255c" stroke-width="1.2" opacity="0.9" transform="translate(300 300) rotate(180.0)"/><ellipse cx="0" cy="-40" rx="9" ry="22" fill="#f783ac" stroke="#c2255c" stroke-width="1.2" opacity="0.9" transform="translate(300 300) rotate(210.0)"/><ellipse cx="0" cy="-40" rx="9" ry="22" fill="#f783ac" stroke="#c2255c" stroke-width="1.2" opacity="0.9" transform="translate(300 300) rotate(240.0)"/><ellipse cx="0" cy="-40" rx="9" ry="22" fill="#f783ac" stroke="#c2255c" stroke-width="1.2" opacity="0.9" transform="translate(300 300) rotate(270.0)"/><ellipse cx="0" cy="-40" rx="9" ry="22" fill="#f783ac" stroke="#c2255c" stroke-width="1.2" opacity="0.9" transform="translate(300 300) rotate(300.0)"/><ellipse cx="0" cy="-40" rx="9" ry="22" fill="#f783ac" stroke="#c2255c" stroke-width="1.2" opacity="0.9" transform="translate(300 300) rotate(330.0)"/>
    <ellipse cx="0" cy="-22" rx="7" ry="16" fill="#ffd43b" stroke="#e67700" stroke-width="1.2" opacity="0.95" transform="translate(300 300) rotate(0.0)"/><ellipse cx="0" cy="-22" rx="7" ry="16" fill="#ffd43b" stroke="#e67700" stroke-width="1.2" opacity="0.95" transform="translate(300 300) rotate(45.0)"/><ellipse cx="0" cy="-22" rx="7" ry="16" fill="#ffd43b" stroke="#e67700" stroke-width="1.2" opacity="0.95" transform="translate(300 300) rotate(90.0)"/><ellipse cx="0" cy="-22" rx="7" ry="16" fill="#ffd43b" stroke="#e67700" stroke-width="1.2" opacity="0.95" transform="translate(300 300) rotate(135.0)"/><ellipse cx="0" cy="-22" rx="7" ry="16" fill="#ffd43b" stroke="#e67700" stroke-width="1.2" opacity="0.95" transform="translate(300 300) rotate(180.0)"/><ellipse cx="0" cy="-22" rx="7" ry="16" fill="#ffd43b" stroke="#e67700" stroke-width="1.2" opacity="0.95" transform="translate(300 300) rotate(225.0)"/><ellipse cx="0" cy="-22" rx="7" ry="16" fill="#ffd43b" stroke="#e67700" stroke-width="1.2" opacity="0.95" transform="translate(300 300) rotate(270.0)"/><ellipse cx="0" cy="-22" rx="7" ry="16" fill="#ffd43b" stroke="#e67700" stroke-width="1.2" opacity="0.95" transform="translate(300 300) rotate(315.0)"/>
    <circle cx="300" cy="300" r="9" fill="#e8590c" stroke="#9c2f00" stroke-width="1.5"/>
    <circle cx="300" cy="300" r="56" fill="none" stroke="#12b886" stroke-width="3" stroke-dasharray="0 9" stroke-linecap="round"/>
    <ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(27 27) rotate(0.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(27 27) rotate(45.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(27 27) rotate(90.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(27 27) rotate(135.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(27 27) rotate(180.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(27 27) rotate(225.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(27 27) rotate(270.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(27 27) rotate(315.0)"/>
    <circle cx="27" cy="27" r="5" fill="#fff3bf" stroke="#c2410c" stroke-width="1"/>
    <ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(573 27) rotate(0.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(573 27) rotate(45.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(573 27) rotate(90.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(573 27) rotate(135.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(573 27) rotate(180.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(573 27) rotate(225.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(573 27) rotate(270.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(573 27) rotate(315.0)"/>
    <circle cx="573" cy="27" r="5" fill="#fff3bf" stroke="#c2410c" stroke-width="1"/>
    <ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(27 573) rotate(0.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(27 573) rotate(45.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(27 573) rotate(90.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(27 573) rotate(135.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(27 573) rotate(180.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(27 573) rotate(225.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(27 573) rotate(270.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(27 573) rotate(315.0)"/>
    <circle cx="27" cy="573" r="5" fill="#fff3bf" stroke="#c2410c" stroke-width="1"/>
    <ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(573 573) rotate(0.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(573 573) rotate(45.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(573 573) rotate(90.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(573 573) rotate(135.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(573 573) rotate(180.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(573 573) rotate(225.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(573 573) rotate(270.0)"/><ellipse cx="0" cy="-11" rx="4.5" ry="8" fill="#ff922b" stroke="#c2410c" stroke-width="1" opacity="1" transform="translate(573 573) rotate(315.0)"/>
    <circle cx="573" cy="573" r="5" fill="#fff3bf" stroke="#c2410c" stroke-width="1"/>
    <g transform="translate(100 100) rotate(45)"><rect x="-8" y="-8" width="16" height="16" fill="#12b886" stroke="#087f5b" stroke-width="1.5" opacity="0.85"/><rect x="-3.5" y="-3.5" width="7" height="7" fill="#fff3bf"/></g>
    <g transform="translate(500 100) rotate(45)"><rect x="-8" y="-8" width="16" height="16" fill="#12b886" stroke="#087f5b" stroke-width="1.5" opacity="0.85"/><rect x="-3.5" y="-3.5" width="7" height="7" fill="#fff3bf"/></g>
    <g transform="translate(100 500) rotate(45)"><rect x="-8" y="-8" width="16" height="16" fill="#12b886" stroke="#087f5b" stroke-width="1.5" opacity="0.85"/><rect x="-3.5" y="-3.5" width="7" height="7" fill="#fff3bf"/></g>
    <g transform="translate(500 500) rotate(45)"><rect x="-8" y="-8" width="16" height="16" fill="#12b886" stroke="#087f5b" stroke-width="1.5" opacity="0.85"/><rect x="-3.5" y="-3.5" width="7" height="7" fill="#fff3bf"/></g>
    <g transform="translate(180 180) rotate(45)"><rect x="-8" y="-8" width="16" height="16" fill="#12b886" stroke="#087f5b" stroke-width="1.5" opacity="0.85"/><rect x="-3.5" y="-3.5" width="7" height="7" fill="#fff3bf"/></g>
    <g transform="translate(420 180) rotate(45)"><rect x="-8" y="-8" width="16" height="16" fill="#12b886" stroke="#087f5b" stroke-width="1.5" opacity="0.85"/><rect x="-3.5" y="-3.5" width="7" height="7" fill="#fff3bf"/></g>
    <g transform="translate(180 420) rotate(45)"><rect x="-8" y="-8" width="16" height="16" fill="#12b886" stroke="#087f5b" stroke-width="1.5" opacity="0.85"/><rect x="-3.5" y="-3.5" width="7" height="7" fill="#fff3bf"/></g>
    <g transform="translate(420 420) rotate(45)"><rect x="-8" y="-8" width="16" height="16" fill="#12b886" stroke="#087f5b" stroke-width="1.5" opacity="0.85"/><rect x="-3.5" y="-3.5" width="7" height="7" fill="#fff3bf"/></g>
    <circle cx="180" cy="100" r="4.5" fill="#d6336c" opacity="0.8"/>
    <circle cx="420" cy="100" r="4.5" fill="#d6336c" opacity="0.8"/>
    <circle cx="180" cy="500" r="4.5" fill="#d6336c" opacity="0.8"/>
    <circle cx="420" cy="500" r="4.5" fill="#d6336c" opacity="0.8"/>
    <circle cx="100" cy="180" r="4.5" fill="#d6336c" opacity="0.8"/>
    <circle cx="100" cy="420" r="4.5" fill="#d6336c" opacity="0.8"/>
    <circle cx="500" cy="180" r="4.5" fill="#d6336c" opacity="0.8"/>
    <circle cx="500" cy="420" r="4.5" fill="#d6336c" opacity="0.8"/>
    <circle cx="260" cy="180" r="4.5" fill="#d6336c" opacity="0.8"/>
    <circle cx="340" cy="180" r="4.5" fill="#d6336c" opacity="0.8"/>
    <circle cx="260" cy="420" r="4.5" fill="#d6336c" opacity="0.8"/>
    <circle cx="340" cy="420" r="4.5" fill="#d6336c" opacity="0.8"/>
  `,
  lines: {
    stroke: '#7a1260',
    width: 6,
    layers: [{ stroke: '#ffb629', width: 13, opacity: 0.55 }],
    pointFill: '#e8590c',
    pointRadius: 9,
    pointStroke: '#7a1260',
    pointStrokeWidth: 2.5,
  },
  highlight: { target: '#0b7285', selected: '#2a0d3a', capture: '#e03131', mill: '#e8590c', millFilter: 'url(#rg-glow)' },
  piece(player, r) {
    const shadow = `<ellipse cx="2" cy="${r * 0.6}" rx="${r}" ry="${r * 0.55}" fill="#000" opacity="0.4" filter="url(#rg-shadow)"/>`;
    if (player === 0) {
      // Marigold flower: eight petals around a deep-orange centre.
      let petals = '';
      for (let i = 0; i < 8; i++) {
        petals += `<ellipse cx="0" cy="${-r * 0.62}" rx="${r * 0.36}" ry="${r * 0.5}" fill="url(#rg-marigold)" stroke="#8a3a00" stroke-width="1.4" transform="rotate(${45 * i})"/>`;
      }
      return `${shadow}${petals}<circle r="${r * 0.36}" fill="#e8590c" stroke="#8a3a00" stroke-width="1.4"/><circle r="${r * 0.12}" fill="#fff3bf"/>`;
    }
    // Violet gem: round, with a ring of white dots.
    return `${shadow}
      <circle r="${r}" fill="url(#rg-gem)" stroke="#fff4e6" stroke-width="2"/>
      <circle r="${r * 0.62}" fill="none" stroke="#fff4e6" stroke-width="2.6" stroke-dasharray="0.1 5.4" stroke-linecap="round"/>
      <ellipse cx="${-r * 0.32}" cy="${-r * 0.42}" rx="${r * 0.3}" ry="${r * 0.14}" fill="#fff" opacity="0.4" transform="rotate(-25 ${-r * 0.32} ${-r * 0.42})"/>`;
  },
};
