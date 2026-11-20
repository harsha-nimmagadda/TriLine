import { granite } from './granite';
import { modern } from './modern';
import { night } from './night';
import { rangoli } from './rangoli';
import type { Theme } from './theme';
import { traditional } from './traditional';
import { wooden } from './wooden';

/** All themes, in picker order. Traditional is the default. */
export const THEMES: readonly Theme[] = [traditional, granite, wooden, modern, rangoli, night];
export const DEFAULT_THEME: Theme = traditional;

export function getTheme(id: string | null | undefined): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}

/** Valid theme id for a stored/received value; falls back to the default for anything unknown. */
export function resolveThemeId(value: unknown): string {
  return typeof value === 'string' && getTheme(value) ? value : DEFAULT_THEME.id;
}
