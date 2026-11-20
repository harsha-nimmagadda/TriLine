import { MILLS, MILLS_AT } from '../engine/board';
import {
  Action,
  Cell,
  GameState,
  Player,
  opponent,
} from '../engine/state';
import { applyUnchecked, legalActions, millsFormedAt } from '../engine/rules';
import { WIN_SCORE, evaluate } from './evaluate';

export interface SearchOptions {
  /** Maximum iterative-deepening depth, counted in turns (a dhadi + its removal is one). */
  maxDepth: number;
  /** Wall-clock budget in ms; the search stops and returns the last completed depth. */
  timeMs?: number;
  /** Uniform random noise (+/- noise) added to each root move score; 0 for best play. */
  noise?: number;
  rng?: () => number;
}

export interface SearchResult {
  action: Action;
  score: number;
  depth: number;
  nodes: number;
}

const enum Flag {
  Exact,
  Lower,
  Upper,
}
interface TTEntry {
  depth: number;
  value: number;
  flag: Flag;
  best: string | null;
}

class Timeout extends Error {}

const actionKey = (a: Action): string =>
  a.type === 'place' ? `p${a.to}` : a.type === 'move' ? `m${a.from}-${a.to}` : `r${a.at}`;

function stateKey(s: GameState): string {
  let k = '';
  for (let i = 0; i < 24; i++) k += s.board[i] + 1;
  return `${k}${s.turn}${s.hand[0]},${s.hand[1]}${s.phase[0]}`;
}

interface Child {
  action: Action;
  key: string;
  state: GameState;
  order: number;
}

class Searcher {
  nodes = 0;
  private tt = new Map<string, TTEntry>();
  private deadline = Infinity;
  private checkCounter = 0;

  constructor(
    private root: Player,
    timeMs: number | undefined,
    private rng: () => number,
  ) {
    if (timeMs !== undefined) this.deadline = Date.now() + timeMs;
  }

  private checkTime(): void {
    if (++this.checkCounter & 511) return;
    if (Date.now() > this.deadline) throw new Timeout();
  }

  /** Cheap move-ordering heuristic. Higher = search earlier. */
  private orderScore(state: GameState, a: Action, child: GameState): number {
    let s = 0;
    const me = state.turn;
    const opp = opponent(me);
    if (a.type === 'remove') {
      // Prefer removing pieces that are part of an opponent two-in-a-row, or that are well connected.
      for (const mi of MILLS_AT[a.at]) {
        let theirs = 0;
        let mine = 0;
        for (const pt of MILL_PTS[mi]) {
          if (state.board[pt] === opp) theirs++;
          else if (state.board[pt] === me) mine++;
        }
        if (theirs === 2 && mine === 0) s += 60;
        if (theirs === 1 && mine === 0) s += 10;
      }
      return s;
    }
    if (child.phase === 'removing') s += 1000;
    const to = a.to;
    // Blocking an opponent dhadi.
    const blocked = millsFormedAt(withCell(state.board, to, opp), to, opp).length;
    if (blocked > 0) s += 400;
    // Building toward a dhadi.
    for (const mi of MILLS_AT[to]) {
      let mine = 0;
      let theirs = 0;
      for (const pt of MILL_PTS[mi]) {
        if (state.board[pt] === me) mine++;
        else if (state.board[pt] === opp) theirs++;
      }
      if (theirs === 0) s += mine * 20;
    }
    return s;
  }

  private children(state: GameState, ttBest: string | null): Child[] {
    const acts = legalActions(state);
    const out: Child[] = [];
    for (const a of acts) {
      const child = applyUnchecked(state, a, false);
      const key = actionKey(a);
      let order = this.orderScore(state, a, child);
      if (key === ttBest) order += 100_000;
      out.push({ action: a, key, state: child, order });
    }
    out.sort((x, y) => y.order - x.order);
    return out;
  }

  private terminal(state: GameState, ply: number): number {
    const r = state.result;
    if (!r || r.winner === null) return 0;
    return r.winner === this.root ? WIN_SCORE - ply : -WIN_SCORE + ply;
  }

  search(state: GameState, depth: number, alpha: number, beta: number, ply: number): number {
    this.nodes++;
    this.checkTime();
    if (state.phase === 'gameover') return this.terminal(state, ply);
    if (depth <= 0 && state.phase !== 'removing') return evaluate(state, this.root);

    const key = stateKey(state);
    const entry = this.tt.get(key);
    let ttBest: string | null = null;
    if (entry) {
      ttBest = entry.best;
      if (entry.depth >= depth) {
        if (entry.flag === Flag.Exact) return entry.value;
        if (entry.flag === Flag.Lower && entry.value >= beta) return entry.value;
        if (entry.flag === Flag.Upper && entry.value <= alpha) return entry.value;
      }
    }

    const maximizing = state.turn === this.root;
    const kids = this.children(state, ttBest);
    const origAlpha = alpha;
    const origBeta = beta;
    let best = maximizing ? -Infinity : Infinity;
    let bestKey: string | null = null;

    for (const c of kids) {
      // A removal belongs to the same turn as the dhadi that caused it, so it costs no depth.
      const nd = state.phase === 'removing' ? depth : depth - 1;
      const v = this.search(c.state, nd, alpha, beta, ply + 1);
      if (maximizing) {
        if (v > best) {
          best = v;
          bestKey = c.key;
        }
        if (v > alpha) alpha = v;
      } else {
        if (v < best) {
          best = v;
          bestKey = c.key;
        }
        if (v < beta) beta = v;
      }
      if (alpha >= beta) break;
    }

    const flag = best <= origAlpha ? Flag.Upper : best >= origBeta ? Flag.Lower : Flag.Exact;
    this.tt.set(key, { depth, value: best, flag, best: bestKey });
    return best;
  }

  /** Iterative deepening over root moves. */
  run(state: GameState, opts: SearchOptions): SearchResult {
    const noise = opts.noise ?? 0;
    let rootKids = this.children(state, null);
    // Shuffle first so ties are broken randomly, then stable-sort by heuristic.
    shuffle(rootKids, this.rng);
    rootKids.sort((a, b) => b.order - a.order);
    if (rootKids.length === 0) throw new Error('No legal actions');

    let best: SearchResult = { action: rootKids[0].action, score: 0, depth: 0, nodes: 0 };
    const maximizing = state.turn === this.root;

    for (let depth = 1; depth <= opts.maxDepth; depth++) {
      try {
        const scored: { c: Child; v: number }[] = [];
        let alpha = -Infinity;
        let beta = Infinity;
        for (const c of rootKids) {
          const nd = state.phase === 'removing' ? depth : depth - 1;
          // With noise we need exact scores for every root move, so use the full window.
          const v =
            noise > 0
              ? this.search(c.state, nd, -Infinity, Infinity, 1)
              : this.search(c.state, nd, alpha, beta, 1);
          scored.push({ c, v });
          if (noise === 0) {
            if (maximizing) alpha = Math.max(alpha, v);
            else beta = Math.min(beta, v);
          }
        }
        // Pick the winner for this depth (noise applies only to the final choice).
        let pick = scored[0];
        let pickScore = -Infinity;
        for (const s of scored) {
          const adj = (maximizing ? s.v : -s.v) + (noise > 0 ? (this.rng() * 2 - 1) * noise : 0);
          if (adj > pickScore) {
            pickScore = adj;
            pick = s;
          }
        }
        best = { action: pick.c.action, score: pick.v, depth, nodes: this.nodes };
        // Search the best move first at the next iteration.
        scored.sort((a, b) => (maximizing ? b.v - a.v : a.v - b.v));
        rootKids = scored.map((s) => s.c);
        if (Math.abs(pick.v) >= WIN_SCORE - 100) break; // forced result found
      } catch (e) {
        if (e instanceof Timeout) break;
        throw e;
      }
    }
    best.nodes = this.nodes;
    return best;
  }
}

const MILL_PTS = MILLS;

function withCell(board: readonly Cell[], i: number, who: Player): Cell[] {
  const b = board.slice() as Cell[];
  b[i] = who;
  return b;
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function searchBestAction(
  state: GameState,
  opts: SearchOptions,
): SearchResult {
  const rng = opts.rng ?? Math.random;
  if (state.phase === 'gameover') throw new Error('Game is over');
  return new Searcher(state.turn, opts.timeMs, rng).run(state, opts);
}
