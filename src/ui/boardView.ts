import { MILLS, NUM_POINTS, pointGrid } from '../engine/board';
import type { Action, GameState, Player } from '../engine/state';
import { clear, svgEl, svgFragment } from './dom';
import type { Theme } from './themes/theme';
import { LoadedAssets, NO_ASSETS } from './assets';
import { stripFilters } from './fx';
import type { QualityLevel } from './quality';

const SIZE = 600;
const CELL = 80;
const PIECE_R = 22;
const HIT_R = 34;

export interface Overlay {
  selected: number | null;
  /** Empty points the current player may place on / slide to. */
  targets: readonly number[];
  /** Opponent pieces that may be removed. */
  capturable: readonly number[];
}

/** How to render: quality level plus any preloaded raster assets (empty = pure SVG). */
export interface RenderOptions {
  level: QualityLevel;
  assets: LoadedAssets;
}
export const DEFAULT_RENDER: RenderOptions = { level: 'medium', assets: NO_ASSETS };
let boardCounter = 0;

export const NO_OVERLAY: Overlay = { selected: null, targets: [], capturable: [] };

export function pointXY(p: number): { x: number; y: number } {
  const g = pointGrid(p);
  return { x: SIZE / 2 + g.x * CELL, y: SIZE / 2 + g.y * CELL };
}

/** SVG board: chalk lines, pieces, highlights and tap targets. */
export class BoardView {
  readonly el: SVGSVGElement;
  private pieceLayer: SVGGElement;
  private hlLayer: SVGGElement;
  private glowLayer: SVGGElement;
  private pieces = new Map<number, SVGGElement>();
  private timers = new Set<number>();
  private interactive = true;

  private lastState: GameState | null = null;
  private lastOverlay: Overlay = NO_OVERLAY;
  private lastMovable: readonly number[] = [];

  private uid = `bv${++boardCounter}`;

  constructor(
    private theme: Theme,
    private onTap: (point: number) => void,
    private render: RenderOptions = DEFAULT_RENDER,
  ) {
    this.el = svgEl('svg', {
      viewBox: `0 0 ${SIZE} ${SIZE}`,
      class: 'board-svg',
      role: 'img',
      'aria-label': 'Pedda Dhadi board',
    });
    this.pieceLayer = svgEl('g', { class: 'piece-layer' });
    this.hlLayer = svgEl('g', { class: 'hl-layer' });
    this.glowLayer = svgEl('g', { class: 'glow-layer' });
    this.build();
  }

  /** (Re)draw the themed board furniture: floor, lines, layers and tap targets. */
  private build(): void {
    clear(this.el);
    const floor = this.render.assets.board ? this.rasterFloor(this.render.assets.board) : svgFragment(this.theme.floor);
    const nodes = this.render.level === 'low' && !this.render.assets.board ? stripFilters(floor) : floor;
    for (const n of nodes) this.el.append(n);
    if (!this.render.assets.boardIncludesLines || !this.render.assets.board) this.el.append(this.buildLines());
    this.el.append(this.glowLayer, this.hlLayer, this.pieceLayer, this.buildHits());
  }

  /** Board floor from a photographic texture: one image, or a tiled pattern, with rounded corners. */
  private rasterFloor(url: string): Node[] {
    const id = this.uid;
    const tile = this.render.assets.boardTile ?? SIZE;
    const baked = !!this.render.assets.boardIncludesLines;
    const ultra = this.render.level === 'ultra' && !baked;
    const fill = tile >= SIZE ? `<image href="${url}" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice"/>` : `<rect width="${SIZE}" height="${SIZE}" fill="url(#${id}-pat)"/>`;
    return svgFragment(`
      <defs>
        <clipPath id="${id}-clip"><rect width="${SIZE}" height="${SIZE}" rx="${baked ? 8 : 22}"/></clipPath>
        <pattern id="${id}-pat" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse"><image href="${url}" width="${tile}" height="${tile}" preserveAspectRatio="none"/></pattern>
        <radialGradient id="${id}-light" cx="30%" cy="22%" r="85%"><stop offset="0%" stop-color="#fff" stop-opacity="0.16"/><stop offset="60%" stop-color="#fff" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.22"/></radialGradient>
      </defs>
      <g clip-path="url(#${id}-clip)">${fill}${ultra ? `<rect width="${SIZE}" height="${SIZE}" fill="url(#${id}-light)"/>` : ''}</g>
      ${baked ? '' : `<rect x="3" y="3" width="${SIZE - 6}" height="${SIZE - 6}" rx="20" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="6"/>`}`);
  }

  /** Switch theme (and/or quality) in place, keeping pieces and highlights. */
  setTheme(theme: Theme, render: RenderOptions = this.render, animate = true): void {
    if (theme === this.theme && render === this.render) return;
    this.theme = theme;
    this.render = render;
    if (this.render.level === 'low') animate = false;
    clear(this.pieceLayer);
    clear(this.glowLayer);
    this.pieces.clear();
    this.build();
    if (this.lastState) this.sync(this.lastState);
    this.setOverlay(this.lastOverlay);
    this.setMovable(this.lastMovable);
    if (animate && typeof this.el.animate === 'function') this.el.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
  }

  private buildLines(): SVGGElement {
    const t = this.theme.lines;
    const g = svgEl('g', { class: 'lines' });
    const geometry = (attrs: Record<string, string | number>): SVGGElement => {
      const strokes = svgEl('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...attrs });
      for (let ring = 0; ring < 3; ring++) {
        const a = pointXY(ring * 8);
        const c = pointXY(ring * 8 + 4);
        strokes.append(svgEl('rect', { x: a.x, y: a.y, width: c.x - a.x, height: c.y - a.y }));
      }
      for (const pos of [1, 3, 5, 7]) {
        const a = pointXY(pos);
        const b = pointXY(16 + pos);
        strokes.append(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
      }
      return strokes;
    };
    const low = this.render.level === 'low';
    for (const layer of t.layers ?? []) {
      if (low && layer.filter) continue; // blur/glow layers need filters
      const lg = geometry({
        stroke: layer.stroke,
        'stroke-width': layer.width,
        ...(layer.opacity !== undefined ? { opacity: layer.opacity } : {}),
        ...(layer.filter && !low ? { filter: layer.filter } : {}),
      });
      if (layer.dx || layer.dy) lg.setAttribute('transform', `translate(${layer.dx ?? 0} ${layer.dy ?? 0})`);
      g.append(lg);
    }
    g.append(geometry({ stroke: t.stroke, 'stroke-width': t.width, ...(t.filter && !low ? { filter: t.filter } : {}) }));
    const dots = svgEl('g', t.pointFilter && !low ? { filter: t.pointFilter } : {});
    g.append(dots);
    for (let i = 0; i < NUM_POINTS; i++) {
      const { x, y } = pointXY(i);
      dots.append(
        svgEl('circle', {
          cx: x,
          cy: y,
          r: t.pointRadius,
          fill: t.pointFill,
          ...(t.pointStroke ? { stroke: t.pointStroke, 'stroke-width': t.pointStrokeWidth ?? 1 } : {}),
        }),
      );
    }
    return g;
  }

  private buildHits(): SVGGElement {
    const g = svgEl('g', { class: 'hits' });
    for (let i = 0; i < NUM_POINTS; i++) {
      const { x, y } = pointXY(i);
      const c = svgEl('circle', { cx: x, cy: y, r: HIT_R, class: 'hit', 'data-point': i });
      g.append(c);
    }
    g.addEventListener('click', (e) => {
      if (!this.interactive) return;
      const t = (e.target as Element).closest('[data-point]');
      if (t) this.onTap(Number(t.getAttribute('data-point')));
    });
    return g;
  }

  setInteractive(on: boolean): void {
    this.interactive = on;
    this.el.classList.toggle('locked', !on);
  }

  private schedule(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  private placeSeq = 0;

  /** Stable pseudo-random variant: placements use a per-board counter, redraws use the point, so a piece never flickers. */
  private variantIndex(player: Player, point: number, fresh: boolean, n: number): number {
    const key = (player + 1) * 7919 + (fresh ? ++this.placeSeq * 104729 : (point + 13) * 15485863);
    let h = Math.imul(key ^ (key >>> 13), 0x5bd1e995);
    h ^= h >>> 15;
    return (h >>> 0) % n;
  }

  private createPiece(point: number, player: Player, animateIn: boolean): SVGGElement {
    const { x, y } = pointXY(point);
    const outer = svgEl('g', { class: 'piece', 'data-player': player, 'data-point': point });
    outer.style.transform = `translate(${x}px, ${y}px)`;
    const body = svgEl('g', { class: animateIn ? 'piece-body pop' : 'piece-body' });
    const variants = this.render.assets.pieceVariants?.[player] ?? [];
    const raster = variants.length > 0 ? variants[this.variantIndex(player, point, animateIn, variants.length)] : this.render.assets.pieces[player];
    if (raster) {
      // Carved boards: the stone sits a little inside its cup so the carved rim shows around it.
      const half = PIECE_R * (this.render.assets.boardIncludesLines ? 0.97 : 1.22);
      if (this.render.assets.pieceShadow) {
        body.append(svgEl('image', { href: this.render.assets.pieceShadow, x: -half, y: -half, width: half * 2, height: half * 2 }));
      } else if (this.render.level === 'ultra') {
        body.append(svgEl('ellipse', { cx: 1.5, cy: PIECE_R * 0.45, rx: PIECE_R * 0.95, ry: PIECE_R * 0.5, fill: '#000', opacity: 0.4, filter: 'url(#q-shadow)' }));
      }
      body.append(svgEl('image', { href: raster, x: -half, y: -half, width: half * 2, height: half * 2 }));
    } else {
      const markup = svgFragment(this.theme.piece(player, PIECE_R));
      for (const n of this.render.level === 'low' ? stripFilters(markup) : markup) body.append(n);
    }
    outer.append(body);
    this.pieceLayer.append(outer);
    this.pieces.set(point, outer);
    return outer;
  }

  /** Make the DOM match `state` exactly, without animation. */
  sync(state: GameState): void {
    this.lastState = state;
    for (let i = 0; i < NUM_POINTS; i++) {
      const want = state.board[i];
      const el = this.pieces.get(i);
      if (el && String(want) !== el.getAttribute('data-player')) {
        el.remove();
        this.pieces.delete(i);
      }
      if (want !== -1 && !this.pieces.has(i)) this.createPiece(i, want as Player, false);
    }
  }

  /** Reset everything (new game / undo). */
  reset(state: GameState): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    clear(this.pieceLayer);
    clear(this.glowLayer);
    this.pieces.clear();
    this.sync(state);
  }

  /** Animate the visual effect of `action`, then make the DOM match `next`. */
  animate(action: Action, next: GameState, mover: Player): void {
    switch (action.type) {
      case 'place':
        this.pieces.get(action.to)?.remove();
        this.createPiece(action.to, mover, true);
        break;
      case 'move': {
        const el = this.pieces.get(action.from);
        if (el) {
          this.pieces.delete(action.from);
          this.pieces.set(action.to, el);
          el.setAttribute('data-point', String(action.to));
          const { x, y } = pointXY(action.to);
          el.style.transform = `translate(${x}px, ${y}px)`;
          el.classList.add('sliding');
          this.schedule(() => el.classList.remove('sliding'), 320);
        }
        break;
      }
      case 'remove': {
        const el = this.pieces.get(action.at);
        if (el) {
          this.pieces.delete(action.at);
          el.classList.add('captured');
          this.schedule(() => el.remove(), 480);
        }
        break;
      }
    }
    this.sync(next);
    if (next.formed.length > 0 && action.type !== 'remove') this.flashMills(next.formed);
  }

  /** Briefly glow the lines of newly formed dhadis. */
  flashMills(millIndices: readonly number[]): void {
    for (const mi of millIndices) {
      const m = MILLS[mi];
      const a = pointXY(m[0]);
      const b = pointXY(m[2]);
      const line = svgEl('line', {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        class: 'mill-glow',
        stroke: this.theme.highlight.mill,
        'stroke-width': 14,
        'stroke-linecap': 'round',
        ...(this.render.level === 'low' ? {} : { filter: this.theme.highlight.millFilter }),
      });
      this.glowLayer.append(line);
      this.schedule(() => line.remove(), 1500);
    }
  }

  setOverlay(o: Overlay): void {
    this.lastOverlay = o;
    clear(this.hlLayer);
    const hl = this.theme.highlight;
    if (o.selected !== null) {
      const { x, y } = pointXY(o.selected);
      this.hlLayer.append(
        svgEl('circle', { cx: x, cy: y, r: PIECE_R + 9, fill: 'none', stroke: hl.selected, 'stroke-width': 4, class: 'hl-selected' }),
      );
    }
    for (const t of o.targets) {
      const { x, y } = pointXY(t);
      this.hlLayer.append(
        svgEl('circle', { cx: x, cy: y, r: 13, fill: hl.target, class: 'hl-target' }),
        svgEl('circle', { cx: x, cy: y, r: 21, fill: 'none', stroke: hl.target, 'stroke-width': 2.5, class: 'hl-target-ring' }),
      );
    }
    for (const c of o.capturable) {
      const { x, y } = pointXY(c);
      this.hlLayer.append(
        svgEl('circle', {
          cx: x,
          cy: y,
          r: PIECE_R + 8,
          fill: 'none',
          stroke: hl.capture,
          'stroke-width': 4,
          'stroke-dasharray': '7 5',
          class: 'hl-capture',
        }),
      );
    }
    // Point cursor feedback on tap targets.
    const clickable = new Set<number>([...o.targets, ...o.capturable]);
    for (const el of this.el.querySelectorAll<SVGElement>('.hit')) {
      el.classList.toggle('active', clickable.has(Number(el.getAttribute('data-point'))));
    }
  }

  /** Mark the pieces that can currently be picked up (own pieces with a free neighbour). */
  setMovable(points: readonly number[]): void {
    this.lastMovable = points;
    const set = new Set(points);
    for (const [p, el] of this.pieces) el.classList.toggle('movable', set.has(p));
  }

  destroy(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.el.remove();
  }
}
