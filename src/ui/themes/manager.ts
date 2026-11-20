import { DEFAULT_THEME, getTheme, resolveThemeId } from './registry';
import type { Theme } from './theme';

export const THEME_STORAGE_KEY = 'peddadhadi.theme';

export interface ThemeStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/**
 * Holds the user's saved theme preference plus an optional temporary override (the host's theme
 * while in an online game). Observers are told whenever the effective theme changes.
 */
export class ThemeManager {
  private pref: Theme;
  private override: Theme | null = null;
  private listeners = new Set<(t: Theme) => void>();

  constructor(private storage: ThemeStorage) {
    let stored: string | null = null;
    try {
      stored = storage.get(THEME_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    this.pref = getTheme(resolveThemeId(stored)) ?? DEFAULT_THEME;
  }

  /** The theme currently in effect. */
  get current(): Theme {
    return this.override ?? this.pref;
  }
  /** The user's own saved choice (ignores any override). */
  get preference(): Theme {
    return this.pref;
  }
  /** Non-null while an online host's theme is forced on us. */
  get overriddenBy(): Theme | null {
    return this.override;
  }

  /** Save and (unless overridden) apply a theme. Unknown ids are ignored. */
  setPreference(id: string): void {
    const t = getTheme(id);
    if (!t) return;
    const before = this.current;
    this.pref = t;
    try {
      this.storage.set(THEME_STORAGE_KEY, t.id);
    } catch {
      /* ignore */
    }
    if (this.current !== before) this.emit();
  }

  /** Force a theme without touching the saved preference; null restores the preference. */
  setOverride(id: string | null): void {
    const before = this.current;
    this.override = id === null ? null : (getTheme(id) ?? null);
    if (this.current !== before) this.emit();
  }

  onChange(fn: (t: Theme) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of [...this.listeners]) fn(this.current);
  }
}
