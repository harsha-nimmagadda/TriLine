import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assetUrl, loadAssets, pickAssetPath, wantedPaths } from '../src/ui/assets';
import { DisplayManager } from '../src/ui/display';
import { DeviceInfo, QUALITY_STORAGE_KEY, QualityManager, parseQuality, resolveAuto } from '../src/ui/quality';
import { THEMES, getTheme } from '../src/ui/themes/registry';
import { ThemeManager } from '../src/ui/themes/manager';

const dev = (o: Partial<DeviceInfo> = {}): DeviceInfo => ({
  deviceMemory: 8,
  hardwareConcurrency: 8,
  screenWidth: 1440,
  screenHeight: 900,
  devicePixelRatio: 1,
  prefersReducedMotion: false,
  saveData: false,
  ...o,
});
const mem = (init: Record<string, string> = {}) => {
  const data = { ...init };
  return { data, get: (k: string) => data[k] ?? null, set: (k: string, v: string) => void (data[k] = v) };
};

describe('Auto quality heuristic', () => {
  it('strong desktop gets Ultra', () => expect(resolveAuto(dev())).toBe('ultra'));
  it('save-data forces Low', () => expect(resolveAuto(dev({ saveData: true }))).toBe('low'));
  it('weak devices get Low', () => {
    expect(resolveAuto(dev({ deviceMemory: 1 }))).toBe('low');
    expect(resolveAuto(dev({ hardwareConcurrency: 2 }))).toBe('low');
  });
  it('typical laptop gets High, not Ultra', () => {
    expect(resolveAuto(dev({ deviceMemory: 4, hardwareConcurrency: 4 }))).toBe('high');
    expect(resolveAuto(dev({ screenWidth: 1000 }))).toBe('high');
  });
  it('phones: good ones High, ordinary ones Medium, never Ultra', () => {
    const phone = { screenWidth: 390, screenHeight: 844, devicePixelRatio: 3 };
    expect(resolveAuto(dev({ ...phone, deviceMemory: 8, hardwareConcurrency: 8 }))).toBe('high');
    expect(resolveAuto(dev({ ...phone, deviceMemory: 4, hardwareConcurrency: 4 }))).toBe('medium');
    expect(resolveAuto(dev({ ...phone, deviceMemory: 2, hardwareConcurrency: 4 }))).toBe('medium');
  });
  it('unknown memory (Safari) is treated as a mid-range device', () => {
    expect(resolveAuto(dev({ deviceMemory: undefined, hardwareConcurrency: undefined }))).toBe('high');
  });
  it('reduced motion caps at High', () => expect(resolveAuto(dev({ prefersReducedMotion: true }))).toBe('high'));
  it('huge pixel counts on non-8GB machines cap at High', () => {
    expect(resolveAuto(dev({ deviceMemory: 4, screenWidth: 3840, screenHeight: 2160, devicePixelRatio: 2 }))).toBe('high');
  });
});

describe('QualityManager', () => {
  it('defaults to auto and resolves via the device', () => {
    const q = new QualityManager(mem(), () => dev({ deviceMemory: 4, hardwareConcurrency: 4 }));
    expect(q.setting).toBe('auto');
    expect(q.level).toBe('high');
    expect(q.autoLevel).toBe('high');
  });
  it('persists the setting and restores it', () => {
    const s = mem();
    new QualityManager(s, () => dev()).setSetting('low');
    expect(s.data[QUALITY_STORAGE_KEY]).toBe('low');
    expect(new QualityManager(s, () => dev()).level).toBe('low');
  });
  it('falls back to auto for junk or unreadable storage', () => {
    expect(new QualityManager(mem({ [QUALITY_STORAGE_KEY]: 'banana' }), () => dev()).setting).toBe('auto');
    const bad = { get: () => { throw new Error('x'); }, set: () => { throw new Error('x'); } };
    const q = new QualityManager(bad, () => dev());
    expect(q.setting).toBe('auto');
    expect(() => q.setSetting('medium')).not.toThrow();
    expect(q.level).toBe('medium');
  });
  it('URL override wins without being persisted', () => {
    const s = mem();
    const q = new QualityManager(s, () => dev(), '?quality=LOW');
    expect(q.urlOverride).toBe('low');
    expect(q.level).toBe('low');
    q.setSetting('ultra');
    expect(q.level).toBe('low');
    expect(new QualityManager(s, () => dev()).level).toBe('ultra');
    expect(new QualityManager(s, () => dev(), '?quality=nonsense').urlOverride).toBeNull();
  });
  it('notifies only when the effective level changes', () => {
    const q = new QualityManager(mem(), () => dev());
    const seen: string[] = [];
    q.onChange((l) => seen.push(l));
    q.setSetting('ultra'); // auto already resolves to ultra
    q.setSetting('high');
    q.setSetting('bogus' as never);
    expect(seen).toEqual(['high']);
    expect(parseQuality('Medium')).toBe('medium');
  });
});

describe('asset manifest', () => {
  const granite = getTheme('granite')!;
  it('Ultra falls back to High; Low and Medium use none', () => {
    expect(pickAssetPath({ high: 'h', ultra: 'u' }, 'ultra')).toBe('u');
    expect(pickAssetPath({ high: 'h' }, 'ultra')).toBe('h');
    expect(pickAssetPath({ high: 'h', ultra: 'u' }, 'high')).toBe('h');
    expect(pickAssetPath({ high: 'h', ultra: 'u' }, 'medium')).toBeUndefined();
    expect(pickAssetPath({ high: 'h', ultra: 'u' }, 'low')).toBeUndefined();
    expect(pickAssetPath(undefined, 'ultra')).toBeUndefined();
  });
  it('resolves URLs under any base path', () => {
    expect(assetUrl('assets/x.webp', '/')).toBe('/assets/x.webp');
    expect(assetUrl('assets/x.webp', '/TriLine/')).toBe('/TriLine/assets/x.webp');
    expect(assetUrl('assets/x.webp', './')).toBe('./assets/x.webp');
  });
  it('every manifest path in every theme exists in public/', () => {
    for (const t of THEMES) {
      for (const lvl of ['high', 'ultra'] as const) {
        const w = wantedPaths(t.assets, lvl);
        for (const p of [w.board, w.background, w.pieceShadow, ...w.pieces, ...w.pieceVariants[0], ...w.pieceVariants[1]]) if (p) expect(existsSync(join('public', p)), `${t.id} ${p}`).toBe(true);
      }
    }
  });
  it('loads everything when probes succeed, and only the pieces that fail are dropped', async () => {
    const ok = await loadAssets(granite, 'high', async () => true, '/');
    expect(ok.board).toBe('/assets/granite/board.high.webp');
    expect(ok.boardIncludesLines).toBe(true);
    expect(ok.pieces[0]).toContain('piece_p1_0.high');
    expect(ok.pieceVariants[0]).toEqual([]); // variants are Ultra-only
    const partial = await loadAssets(granite, 'ultra', async (u) => !u.includes('piece_p2'), '/');
    expect(partial.board).toContain('board.ultra');
    expect(partial.pieces[1]).toBeUndefined();
    expect(partial.pieceVariants[1]).toEqual([]);
    expect(partial.pieces[0]).toBeDefined();
    expect(partial.pieceVariants[0].length).toBe(6);
    // a broken variant is dropped, the rest survive
    const some = await loadAssets(granite, 'ultra', async (u) => !u.includes('piece_p1_3'), '/');
    expect(some.pieceVariants[0].length).toBe(5);
  });
  it('falls back to SVG (no assets) on Medium/Low, on theme without assets, and on load errors', async () => {
    expect((await loadAssets(granite, 'medium', async () => true)).board).toBeUndefined();
    expect((await loadAssets(getTheme('night')!, 'ultra', async () => true)).board).toBeUndefined();
    const failing = await loadAssets(granite, 'ultra', async () => { throw new Error('net'); });
    expect(failing.board).toBeUndefined();
    expect(failing.pieces).toEqual([undefined, undefined]);
  });
});

describe('DisplayManager', () => {
  const setup = (loader: (t: unknown, l: string) => Promise<never>) => {
    const themes = new ThemeManager(mem());
    const quality = new QualityManager(mem(), () => dev(), '');
    return { themes, quality, display: new DisplayManager(themes, quality, loader as never) };
  };
  it('publishes only after the assets have loaded, and survives loader failure', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { themes, display } = setup(async () => {
      await gate;
      return { board: 'b', pieces: [undefined, undefined] } as never;
    });
    const seen: string[] = [];
    display.onChange((d) => seen.push(d.theme.id));
    themes.setPreference('granite');
    expect(display.current.theme.id).toBe('traditional'); // not swapped yet
    release();
    await display.refresh();
    expect(display.current.theme.id).toBe('granite');
    expect(display.current.assets.board).toBe('b');
    expect(seen.length).toBeGreaterThan(0);

    const broken = setup(async () => { throw new Error('boom'); });
    const d = await broken.display.refresh();
    expect(d.assets.board).toBeUndefined();
  });
  it('ignores a superseded load', async () => {
    const calls: string[] = [];
    const { themes, display } = setup(async (t) => {
      const id = (t as { id: string }).id;
      calls.push(id);
      if (id === 'granite') await new Promise((r) => setTimeout(r, 30));
      return { pieces: [undefined, undefined] } as never;
    });
    themes.setPreference('granite');
    themes.setPreference('night');
    await new Promise((r) => setTimeout(r, 80));
    expect(display.current.theme.id).toBe('night');
  });
});
