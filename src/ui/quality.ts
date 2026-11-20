/** Display quality: user setting, device heuristic for Auto, and persistence. */

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';
export type QualitySetting = 'auto' | QualityLevel;

export const QUALITY_LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high', 'ultra'];
export const QUALITY_SETTINGS: readonly QualitySetting[] = ['auto', ...QUALITY_LEVELS];
export const QUALITY_STORAGE_KEY = 'peddadhadi.quality';

export const QUALITY_LABEL: Record<QualitySetting, string> = {
  auto: 'Auto',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  ultra: 'Ultra',
};

export const QUALITY_BLURB: Record<QualityLevel, string> = {
  low: 'Plain vector look, no filters or extra animation. Best for older phones.',
  medium: 'The standard look with vector textures.',
  high: 'Photo-quality board, background and pieces where the theme has them.',
  ultra: 'Highest-resolution images plus soft shadows and gentle ambient effects.',
};

export function parseQuality(value: unknown): QualitySetting | null {
  return typeof value === 'string' && (QUALITY_SETTINGS as readonly string[]).includes(value.toLowerCase())
    ? (value.toLowerCase() as QualitySetting)
    : null;
}

export interface DeviceInfo {
  /** navigator.deviceMemory in GB (Chromium only, capped at 8). */
  deviceMemory?: number;
  hardwareConcurrency?: number;
  /** Viewport / screen width in CSS pixels. */
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  prefersReducedMotion: boolean;
  saveData: boolean;
}

const rank = (l: QualityLevel) => QUALITY_LEVELS.indexOf(l);
const cap = (l: QualityLevel, max: QualityLevel): QualityLevel => (rank(l) > rank(max) ? max : l);

/**
 * Pick a level for this device. Unknown values (Safari has no deviceMemory) are assumed to be a typical
 * mid-range device (4 GB, 4 cores).
 */
export function resolveAuto(d: DeviceInfo): QualityLevel {
  if (d.saveData) return 'low';
  const mem = d.deviceMemory ?? 4;
  const cores = d.hardwareConcurrency ?? 4;
  const cssWidth = Math.min(d.screenWidth, d.screenHeight) <= 600 ? Math.min(d.screenWidth, d.screenHeight) : d.screenWidth;
  const phone = cssWidth < 700;
  if (mem <= 1 || cores <= 2) return 'low';

  let level: QualityLevel;
  if (mem >= 8 && cores >= 8 && !phone && d.screenWidth >= 1100) level = 'ultra';
  else if (mem >= 4 && cores >= 4) level = 'high';
  else if (mem >= 2) level = 'medium';
  else level = 'low';

  // Phones: only well-equipped ones get High; never Ultra (battery, thermals, bandwidth).
  if (phone) level = mem >= 4 && cores >= 6 ? cap(level, 'high') : cap(level, 'medium');
  // Very high pixel counts make big images expensive on weak GPUs.
  if (d.screenWidth * d.screenHeight * d.devicePixelRatio ** 2 > 14_000_000 && mem < 8) level = cap(level, 'high');
  // Ultra adds ambient animation: respect the reduced-motion preference.
  if (d.prefersReducedMotion) level = cap(level, 'high');
  return level;
}

export function readDevice(): DeviceInfo {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    screenWidth: window.innerWidth || screen.width,
    screenHeight: window.innerHeight || screen.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    prefersReducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    saveData: nav.connection?.saveData === true,
  };
}

export interface QualityStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** User's quality setting (persisted), with an optional URL override (`?quality=ultra`) for testing. */
export class QualityManager {
  private _setting: QualitySetting;
  private listeners = new Set<(level: QualityLevel) => void>();
  readonly urlOverride: QualitySetting | null;

  constructor(
    private storage: QualityStorage,
    private device: () => DeviceInfo,
    search = '',
  ) {
    let stored: string | null = null;
    try {
      stored = storage.get(QUALITY_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    this._setting = parseQuality(stored) ?? 'auto';
    const q = new URLSearchParams(search).get('quality');
    this.urlOverride = parseQuality(q);
  }

  /** What the user chose (may be 'auto'). */
  get setting(): QualitySetting {
    return this._setting;
  }

  /** What is actually in effect. */
  get level(): QualityLevel {
    const s = this.urlOverride ?? this._setting;
    return s === 'auto' ? resolveAuto(this.device()) : s;
  }

  /** What Auto resolves to on this device. */
  get autoLevel(): QualityLevel {
    return resolveAuto(this.device());
  }

  setSetting(s: QualitySetting): void {
    if (!parseQuality(s)) return;
    const before = this.level;
    this._setting = s;
    try {
      this.storage.set(QUALITY_STORAGE_KEY, s);
    } catch {
      /* ignore */
    }
    if (this.level !== before) this.emit();
  }

  /** Re-evaluate Auto (e.g. after a window resize). */
  refresh(): void {
    this.emit();
  }

  onChange(fn: (level: QualityLevel) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of [...this.listeners]) fn(this.level);
  }
}
