import type { Player } from '../../engine/state';

/**
 * A visual theme for the board and pieces. Everything is SVG markup / CSS values so a theme
 * needs no external assets. Board coordinates are a 600x600 viewBox; point spacing is 80 units.
 */
export interface Theme {
  id: string;
  name: string;
  /** Display names of the two sides, [player 1 (first), player 2]. */
  sideNames: readonly [string, string];
  /** CSS custom properties applied to :root. */
  cssVars: Record<string, string>;
  /** Contents of an SVG <defs> block (gradients, filters). Ids must be globally unique. */
  defs: string;
  /** Board backdrop markup drawn first, inside the 0 0 600 600 viewBox. */
  floor: string;
  /** Appearance of the board lines and points. */
  lines: {
    stroke: string;
    width: number;
    filter?: string;
    pointFill: string;
    pointRadius: number;
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
  /** Piece artwork centred on (0,0) with nominal radius `r`. */
  piece(player: Player, r: number): string;
}
