import { describe, expect, it } from 'vitest';
import { REQUIRED_CSS_VARS } from '../src/ui/themes/theme';
import { DEFAULT_THEME, THEMES, getTheme, resolveThemeId } from '../src/ui/themes/registry';
import { THEME_STORAGE_KEY, ThemeManager } from '../src/ui/themes/manager';

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('theme registry', () => {
  it('has the six themes with Traditional as default', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['traditional', 'granite', 'wooden', 'modern', 'rangoli', 'night']);
    expect(DEFAULT_THEME.id).toBe('traditional');
  });

  for (const t of THEMES) {
    describe(t.id, () => {
      it('defines every required CSS variable and no extras', () => {
        for (const v of REQUIRED_CSS_VARS) expect(t.cssVars[v], `${t.id} ${v}`).toBeTruthy();
        expect(Object.keys(t.cssVars).sort()).toEqual([...REQUIRED_CSS_VARS].sort());
      });

      it('has names, blurb, side names and board pieces for both sides', () => {
        expect(t.name && t.blurb).toBeTruthy();
        expect(t.sideNames[0]).not.toBe(t.sideNames[1]);
        expect(t.piece(0, 22)).not.toBe(t.piece(1, 22));
        expect(t.floor.length).toBeGreaterThan(20);
        for (const k of ['target', 'selected', 'capture', 'mill', 'millFilter'] as const) expect(t.highlight[k]).toBeTruthy();
      });

      it('only references gradients/filters that its own defs define', () => {
        const defined = new Set([...t.defs.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
        const markup = [t.floor, t.piece(0, 20), t.piece(1, 20), t.lines.filter ?? '', t.highlight.millFilter, ...(t.lines.layers ?? []).map((l) => l.filter ?? '')].join(' ');
        for (const m of markup.matchAll(/url\(#([^)]+)\)/g)) expect(defined.has(m[1]), `${t.id} missing #${m[1]}`).toBe(true);
      });

      it('uses a unique id prefix so all themes can share one defs block', () => {
        const prefix = t.defs.match(/id="([a-z]+)-/)![1];
        for (const m of t.defs.matchAll(/id="([^"]+)"/g)) expect(m[1].startsWith(prefix + '-')).toBe(true);
      });

      it('keeps the two sides clearly distinguishable and visible on the board', () => {
        const { side0, side1, board } = t.swatches;
        expect(ratio(side0, side1), 'side vs side').toBeGreaterThanOrEqual(4.5);
        expect(ratio(side0, board), 'side0 vs board').toBeGreaterThanOrEqual(1.4);
        expect(ratio(side1, board), 'side1 vs board').toBeGreaterThanOrEqual(1.4);
      });

      it('meets WCAG AA (4.5:1) for text on the page and on modal/chat surfaces', () => {
        const v = t.cssVars;
        for (const bg of [v['--bg'], v['--bg-2'], v['--surface'], v['--surface-2']]) {
          for (const fg of [v['--text'], v['--text-dim'], v['--accent'], v['--danger'], v['--good'], v['--info']]) {
            expect(ratio(fg, bg), `${t.id} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
          }
        }
        expect(ratio(v['--accent-ink'], v['--accent'])).toBeGreaterThanOrEqual(4.5);
        expect(ratio(v['--accent-ink'], v['--accent-hover'])).toBeGreaterThanOrEqual(4.5);
        expect(ratio(v['--on-danger'], v['--danger'])).toBeGreaterThanOrEqual(4.5);
      });
    });
  }

  it('lookup and fallback helpers', () => {
    expect(getTheme('night')?.name).toBe('Night');
    expect(getTheme('nope')).toBeUndefined();
    expect(resolveThemeId('wooden')).toBe('wooden');
    expect(resolveThemeId('nope')).toBe('traditional');
    expect(resolveThemeId(null)).toBe('traditional');
    expect(resolveThemeId(42)).toBe('traditional');
  });
});

describe('ThemeManager', () => {
  const mem = (init: Record<string, string> = {}) => {
    const data = { ...init };
    return { data, get: (k: string) => data[k] ?? null, set: (k: string, v: string) => void (data[k] = v) };
  };

  it('falls back to the default for missing or unknown stored values', () => {
    expect(new ThemeManager(mem()).current.id).toBe('traditional');
    expect(new ThemeManager(mem({ [THEME_STORAGE_KEY]: 'bogus' })).current.id).toBe('traditional');
  });

  it('survives storage that throws', () => {
    const bad = {
      get: () => {
        throw new Error('blocked');
      },
      set: () => {
        throw new Error('blocked');
      },
    };
    const m = new ThemeManager(bad);
    expect(m.current.id).toBe('traditional');
    expect(() => m.setPreference('night')).not.toThrow();
    expect(m.current.id).toBe('night');
  });

  it('persists the preference and restores it', () => {
    const s = mem();
    new ThemeManager(s).setPreference('rangoli');
    expect(s.data[THEME_STORAGE_KEY]).toBe('rangoli');
    expect(new ThemeManager(s).current.id).toBe('rangoli');
  });

  it('ignores unknown ids and notifies listeners only on real changes', () => {
    const m = new ThemeManager(mem());
    const seen: string[] = [];
    const off = m.onChange((t) => seen.push(t.id));
    m.setPreference('bogus');
    m.setPreference('traditional');
    m.setPreference('modern');
    off();
    m.setPreference('night');
    expect(seen).toEqual(['modern']);
  });

  it('an online override wins without touching the saved preference, and is undone afterwards', () => {
    const s = mem();
    const m = new ThemeManager(s);
    m.setPreference('granite');
    m.setOverride('wooden');
    expect(m.current.id).toBe('wooden');
    expect(m.overriddenBy?.id).toBe('wooden');
    m.setPreference('night'); // picked while overridden: saved, but not applied yet
    expect(m.current.id).toBe('wooden');
    m.setOverride('does-not-exist');
    expect(m.current.id).toBe('night');
    m.setOverride('wooden');
    m.setOverride(null);
    expect(m.current.id).toBe('night');
    expect(s.data[THEME_STORAGE_KEY]).toBe('night');
  });
});
