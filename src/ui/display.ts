import { LoadedAssets, NO_ASSETS, loadAssets } from './assets';
import type { QualityLevel, QualityManager } from './quality';
import type { ThemeManager } from './themes/manager';
import type { Theme } from './themes/theme';

/** Everything the renderers need: theme + quality level + the preloaded raster assets for them. */
export interface Display {
  theme: Theme;
  level: QualityLevel;
  assets: LoadedAssets;
}

export type AssetLoader = (theme: Theme, level: QualityLevel) => Promise<LoadedAssets>;

/**
 * Combines the theme and quality choices. When either changes it preloads the needed images first and
 * only then publishes the new Display, so the UI never flashes between looks. Load failures silently
 * produce an empty asset set (SVG fallback).
 */
export class DisplayManager {
  current: Display;
  private listeners = new Set<(d: Display) => void>();
  private ticket = 0;

  constructor(
    private themes: ThemeManager,
    private quality: QualityManager,
    private loader: AssetLoader = (t, l) => loadAssets(t, l),
  ) {
    this.current = { theme: themes.current, level: quality.level, assets: NO_ASSETS };
    themes.onChange(() => void this.refresh());
    quality.onChange(() => void this.refresh());
  }

  /** Load assets for the currently chosen theme + level and publish them. */
  async refresh(): Promise<Display> {
    const ticket = ++this.ticket;
    const theme = this.themes.current;
    const level = this.quality.level;
    let assets: LoadedAssets;
    try {
      assets = await this.loader(theme, level);
    } catch {
      assets = NO_ASSETS;
    }
    if (ticket !== this.ticket) return this.current; // superseded by a newer change
    const same = this.current.theme === theme && this.current.level === level && JSON.stringify(this.current.assets) === JSON.stringify(assets);
    this.current = { theme, level, assets };
    if (!same) for (const fn of [...this.listeners]) fn(this.current);
    return this.current;
  }

  onChange(fn: (d: Display) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

/** Page-level application of a Display: quality attribute and raster page background. */
export function applyDisplayToPage(d: Display): void {
  const root = document.documentElement;
  root.dataset.quality = d.level;
  if (d.assets.background) {
    // A theme-coloured veil keeps UI text readable over the photo.
    root.style.setProperty(
      '--page-bg',
      `linear-gradient(color-mix(in srgb, var(--bg) 58%, transparent), color-mix(in srgb, var(--bg) 72%, transparent)), url("${d.assets.background}") center / cover fixed`,
    );
  } else {
    root.style.removeProperty('--page-bg');
  }
}
