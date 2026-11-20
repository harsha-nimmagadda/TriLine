import { clear, svgEl, svgFragment } from '../dom';
import { THEMES } from './registry';
import type { Theme } from './theme';

export type { Theme };
export { REQUIRED_CSS_VARS } from './theme';
export { DEFAULT_THEME, THEMES, getTheme, resolveThemeId } from './registry';
export { THEME_STORAGE_KEY, ThemeManager } from './manager';

/** Install every theme's SVG defs once (previews of other themes need them too). */
export function installThemeDefs(): void {
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
  for (const t of THEMES) for (const n of svgFragment(t.defs)) defs.append(n);
  // Shared by raster pieces at Ultra quality.
  for (const n of svgFragment('<filter id="q-shadow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4"/></filter>')) defs.append(n);
  holder.append(defs);
}

/** Apply the theme's CSS variables to the page. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.cssVars)) root.style.setProperty(k, v);
  root.dataset.theme = theme.id;
  root.style.colorScheme = theme.scheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.cssVars['--theme-color']);
}
