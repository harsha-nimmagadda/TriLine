import type { QualityLevel } from './quality';
import type { Theme, ThemeAssets, ImageSet } from './themes/theme';

/** Resolved, preloaded asset URLs for the active theme and quality level (all optional). */
export interface LoadedAssets {
  board?: string;
  /** Size of one board texture tile in board units (600 = a single image). */
  boardTile?: number;
  background?: string;
  /** The board image already has the lines and point holes carved in. */
  boardIncludesLines?: boolean;
  pieces: [string | undefined, string | undefined];
  /** Ultra: several images per side; pieces choose one deterministically. */
  pieceVariants: [string[], string[]];
  pieceShadow?: string;
}

export const NO_ASSETS: LoadedAssets = { pieces: [undefined, undefined], pieceVariants: [[], []] };

/** Path for a quality level from a per-level set. Ultra falls back to High; Low/Medium use none. */
export function pickAssetPath(set: ImageSet | undefined, level: QualityLevel): string | undefined {
  if (!set) return undefined;
  if (level === 'ultra') return set.ultra ?? set.high;
  if (level === 'high') return set.high;
  return undefined;
}

/** Turn a manifest-relative path into a URL that works under any base path (e.g. /TriLine/). */
export function assetUrl(path: string, base: string = import.meta.env.BASE_URL): string {
  return base.replace(/\/?$/, '/') + path.replace(/^\/+/, '');
}

/** The paths this theme wants at this level (before checking they exist). */
export function wantedPaths(assets: ThemeAssets | undefined, level: QualityLevel) {
  return {
    board: pickAssetPath(assets?.board, level),
    background: pickAssetPath(assets?.background, level),
    pieces: [pickAssetPath(assets?.pieces?.[0], level), pickAssetPath(assets?.pieces?.[1], level)] as [string | undefined, string | undefined],
    boardTile: assets?.boardTile,
    boardIncludesLines: assets?.boardIncludesLines,
    pieceShadow: level === 'high' || level === 'ultra' ? assets?.pieceShadow : undefined,
    pieceVariants: [
      level === 'ultra' ? (assets?.pieces?.[0]?.ultraVariants ?? []) : [],
      level === 'ultra' ? (assets?.pieces?.[1]?.ultraVariants ?? []) : [],
    ] as [string[], string[]],
  };
}

const cache = new Map<string, Promise<boolean>>();

/** Resolves true if the image loads and decodes; false (never rejects) on any failure. */
export function probeImage(url: string, timeoutMs = 15000): Promise<boolean> {
  let p = cache.get(url);
  if (!p) {
    p = new Promise<boolean>((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => resolve(false), timeoutMs);
      img.onload = () => {
        clearTimeout(timer);
        resolve(true);
        // Warm the decoder in the background; never wait on it (it can stall in hidden tabs).
        if (typeof img.decode === 'function') img.decode().catch(() => undefined);
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
      img.src = url;
    });
    cache.set(url, p);
  }
  return p;
}

export type Prober = (url: string) => Promise<boolean>;

/**
 * Load the theme's raster assets for `level`. Anything missing or failing to load is dropped
 * (the board then falls back to the SVG rendering for that part), silently.
 */
export async function loadAssets(theme: Theme, level: QualityLevel, probe: Prober = probeImage, base?: string): Promise<LoadedAssets> {
  const want = wantedPaths(theme.assets, level);
  const check = async (path: string | undefined): Promise<string | undefined> => {
    if (!path) return undefined;
    const url = assetUrl(path, base);
    try {
      return (await probe(url)) ? url : undefined;
    } catch {
      return undefined;
    }
  };
  const [board, background, p0, p1] = await Promise.all([check(want.board), check(want.background), check(want.pieces[0]), check(want.pieces[1])]);
  const pieceShadow = await check(want.pieceShadow);
  const variants = await Promise.all(
    want.pieceVariants.map(async (list) => (await Promise.all(list.map((x) => check(x)))).filter((u): u is string => !!u)),
  );
  const pieceVariants = [variants[0] ?? [], variants[1] ?? []] as [string[], string[]];
  return {
    board,
    boardTile: board ? want.boardTile : undefined,
    boardIncludesLines: board ? want.boardIncludesLines : undefined,
    background,
    // With variants available, the single-image slot (HUD icons, fallbacks) uses the first variant.
    pieces: [p0 ?? pieceVariants[0][0], p1 ?? pieceVariants[1][0]],
    pieceVariants,
    pieceShadow: pieceShadow && (p0 || p1 || pieceVariants[0].length || pieceVariants[1].length) ? pieceShadow : undefined,
  };
}
