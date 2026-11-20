import type { Player } from '../../engine/state';

/** CSS custom properties every theme must define (the whole app chrome is driven by these). */
export const REQUIRED_CSS_VARS = [
  '--font',
  '--bg', // page background (gradient end)
  '--bg-2', // page background (gradient centre)
  '--surface', // modals, chat panel (solid)
  '--surface-2',
  '--panel', // translucent card/button fill
  '--panel-strong',
  '--text',
  '--text-dim',
  '--accent',
  '--accent-hover',
  '--accent-ink', // text on --accent
  '--accent-soft', // translucent accent fill (active card, selected option)
  '--accent-glow', // glow around the active player card
  '--danger',
  '--danger-soft',
  '--danger-border',
  '--on-danger', // text on --danger
  '--good',
  '--info',
  '--border',
  '--input-bg',
  '--backdrop', // modal backdrop
  '--shadow', // generic drop shadow colour
  '--emblem-bg', // home-screen emblem tile
  '--theme-color', // <meta name="theme-color">
] as const;

export type CssVar = (typeof REQUIRED_CSS_VARS)[number];

/** Image paths (relative to the app base URL) per quality level. Ultra falls back to High if absent. */
export interface ImageSet {
  high?: string;
  ultra?: string;
  /** Pieces only: several Ultra images for the same side; each placed piece gets a stable pseudo-random one. */
  ultraVariants?: string[];
}

/** Optional raster assets for High / Ultra quality. Anything missing falls back to the SVG rendering. */
export interface ThemeAssets {
  /** Board floor texture (square). */
  board?: ImageSet;
  /** Size of one texture tile in board units (600 = one image across the whole board; smaller tiles it). */
  boardTile?: number;
  /** True if the board image already contains the lines and point holes (so the SVG lines are not drawn). */
  boardIncludesLines?: boolean;
  /** Page background (any aspect ratio, drawn with cover). */
  background?: ImageSet;
  /** Piece images with transparency, [player 1, player 2]. */
  pieces?: [ImageSet | undefined, ImageSet | undefined];
}

export interface StrokeLayer {
  stroke: string;
  width: number;
  dx?: number;
  dy?: number;
  opacity?: number;
  filter?: string;
}

/**
 * A visual theme for the whole app: board, pieces, highlights and the page chrome.
 * Everything is SVG markup / CSS values so a theme needs no external assets.
 * Board coordinates are a 600x600 viewBox; point spacing is 80 units.
 */
export interface Theme {
  id: string;
  name: string;
  /** Short description shown in the theme picker. */
  blurb: string;
  /** Display names of the two sides, [player 1 (first), player 2]. */
  sideNames: readonly [string, string];
  /** Light or dark chrome (sets color-scheme). */
  scheme: 'light' | 'dark';
  /** CSS custom properties applied to :root; must contain every REQUIRED_CSS_VARS entry. */
  cssVars: Record<CssVar, string>;
  /** Contents of an SVG <defs> block (gradients, filters). Ids must be globally unique (prefix per theme). */
  defs: string;
  /** Board backdrop markup drawn first, inside the 0 0 600 600 viewBox. */
  floor: string;
  /** Appearance of the board lines and points. */
  lines: {
    stroke: string;
    width: number;
    filter?: string;
    /** Extra strokes drawn beneath the main lines (grooves, glow, halos). */
    layers?: StrokeLayer[];
    pointFill: string;
    pointRadius: number;
    pointStroke?: string;
    pointStrokeWidth?: number;
    /** Filter applied once to the whole group of point dots (e.g. powder grain). */
    pointFilter?: string;
  };
  /** Colours used for interactive highlights. */
  highlight: {
    target: string;
    selected: string;
    capture: string;
    mill: string;
    /** CSS filter (e.g. url(#id)) used for the dhadi glow. */
    millFilter: string;
  };
  /**
   * Representative flat colours, used by tests to guarantee the two sides are clearly distinct
   * (luminance contrast) and visible against the board.
   */
  swatches: { side0: string; side1: string; board: string };
  /** Raster assets used at High / Ultra quality. */
  assets?: ThemeAssets;
  /** Piece artwork centred on (0,0) with nominal radius `r`. Sides must also differ in shape/marking. */
  piece(player: Player, r: number): string;
}
