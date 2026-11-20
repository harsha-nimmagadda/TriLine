import type { Theme } from './theme';

/** Clean, flat and minimal: light chrome, simple discs, maximum readability. */
export const modern: Theme = {
  id: 'modern',
  name: 'Modern',
  blurb: 'Flat, clean and high contrast',
  sideNames: ['Amber', 'Navy'],
  scheme: 'light',
  swatches: { side0: '#f5a623', side1: '#1d2b53', board: '#ffffff' },
  cssVars: {
    '--font': "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
    '--bg': '#eef0f4',
    '--bg-2': '#ffffff',
    '--surface': '#ffffff',
    '--surface-2': '#f3f4f8',
    '--panel': 'rgba(20, 24, 31, 0.05)',
    '--panel-strong': 'rgba(20, 24, 31, 0.1)',
    '--text': '#14181f',
    '--text-dim': '#4b5563',
    '--accent': '#1d4ed8',
    '--accent-hover': '#1e40af',
    '--accent-ink': '#ffffff',
    '--accent-soft': 'rgba(29, 78, 216, 0.1)',
    '--accent-glow': 'rgba(29, 78, 216, 0.22)',
    '--danger': '#b42318',
    '--danger-soft': 'rgba(180, 35, 24, 0.09)',
    '--danger-border': 'rgba(180, 35, 24, 0.5)',
    '--on-danger': '#ffffff',
    '--good': '#067647',
    '--info': '#1d4ed8',
    '--border': 'rgba(20, 24, 31, 0.28)',
    '--input-bg': '#ffffff',
    '--backdrop': 'rgba(15, 20, 30, 0.5)',
    '--shadow': 'rgba(15, 23, 42, 0.2)',
    '--emblem-bg': '#ffffff',
    '--theme-color': '#eef0f4',
  },
  defs: `
    <filter id="md-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  `,
  floor: `
    <rect x="0" y="0" width="600" height="600" rx="24" fill="#ffffff"/>
    <rect x="1.5" y="1.5" width="597" height="597" rx="23" fill="none" stroke="#cdd3dd" stroke-width="3"/>
  `,
  lines: {
    stroke: '#7d8798',
    width: 4,
    pointFill: '#7d8798',
    pointRadius: 6.5,
  },
  highlight: { target: '#2563eb', selected: '#14181f', capture: '#d92d20', mill: '#f59e0b', millFilter: 'url(#md-glow)' },
  piece(player, r) {
    if (player === 0) {
      // Amber disc with an inner ring.
      return `<circle r="${r}" fill="#f5a623" stroke="#14181f" stroke-width="2.4"/>
        <circle r="${r * 0.52}" fill="none" stroke="#14181f" stroke-width="2.4"/>`;
    }
    // Navy disc with a solid white centre dot.
    return `<circle r="${r}" fill="#1d2b53" stroke="#0b1226" stroke-width="2.4"/>
      <circle r="${r * 0.2}" fill="#ffffff"/>`;
  },
};
