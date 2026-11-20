import { clear, svgEl, svgFragment } from '../dom';
import { traditional } from './traditional';
import type { Theme } from './theme';

export type { Theme };

export const THEMES: Record<string, Theme> = { [traditional.id]: traditional };
export const DEFAULT_THEME = traditional;

/** Apply CSS variables and install shared SVG <defs> (gradients/filters) for the theme. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.cssVars)) root.style.setProperty(k, v);
  root.dataset.theme = theme.id;

  let holder = document.getElementById('theme-defs') as SVGSVGElement | null;
  if (!holder) {
    holder = svgEl('svg', {
      id: 'theme-defs',
      width: 0,
      height: 0,
      'aria-hidden': 'true',
      style: 'position:absolute;width:0;height:0;overflow:hidden',
    });
    document.body.prepend(holder);
  }
  clear(holder);
  const defs = svgEl('defs');
  for (const n of svgFragment(theme.defs)) defs.append(n);
  holder.append(defs);
}
