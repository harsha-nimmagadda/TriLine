import { ADJACENT, MILLS } from '../engine/board';
import { applyUnchecked, legalActions, millsFormedAt } from '../engine/rules';
import { Action, Cell, EMPTY, GameState, opponent } from '../engine/state';

export interface HeuristicPolicy {
  /** Probability of taking an available dhadi-completing action. */
  complete: number;
  /** Probability of taking an available action that blocks an opponent dhadi. */
  block: number;
  /**
   * Casual play steers away from lines that would leave two of its own pieces with an empty
   * third point (so it does not build up dhadis on purpose). Probability per turn (default 0).
   */
  avoidSetups?: number;
}

/** Number of dhadi lines with two of `who`'s pieces and an empty third point. */
function openTwos(board: readonly Cell[], who: 0 | 1): number {
  let n = 0;
  for (const m of MILLS) {
    let mine = 0;
    let empty = 0;
    for (const p of m) {
      if (board[p] === who) mine++;
      else if (board[p] === EMPTY) empty++;
    }
    if (mine === 2 && empty === 1) n++;
  }
  return n;
}

/** Actions (place/move) that form a dhadi for the player to act. */
export function completingActions(state: GameState, actions: readonly Action[] = legalActions(state)): Action[] {
  return actions.filter((a) => a.type !== 'remove' && applyUnchecked(state, a, false).phase === 'removing');
}

/** Empty points where the opponent could complete a dhadi on their next turn. */
export function threatenedPoints(state: GameState): number[] {
  const me = state.turn;
  const opp = opponent(me);
  const out: number[] = [];
  for (let p = 0; p < state.board.length; p++) {
    if (state.board[p] !== EMPTY) continue;
    const withOpp = state.board.slice() as Cell[];
    withOpp[p] = opp;
    if (state.hand[opp] > 0) {
      if (millsFormedAt(withOpp, p, opp).length > 0) out.push(p);
      continue;
    }
    for (const n of ADJACENT[p]) {
      if (state.board[n] !== opp) continue;
      const slid = withOpp.slice() as Cell[];
      slid[n] = EMPTY;
      if (millsFormedAt(slid, p, opp).length > 0) {
        out.push(p);
        break;
      }
    }
  }
  return out;
}

/** Actions that occupy a point the opponent is threatening to complete a dhadi on. */
export function blockingActions(state: GameState, actions: readonly Action[] = legalActions(state)): Action[] {
  const threats = threatenedPoints(state);
  if (threats.length === 0) return [];
  return actions.filter((a) => a.type !== 'remove' && threats.includes(a.to));
}

const pick = <T>(arr: readonly T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

/**
 * A casual player: completes a dhadi with probability `complete`, blocks with probability `block`,
 * otherwise plays a random legal action. Removals are random among the allowed pieces.
 */
export function heuristicAction(state: GameState, policy: HeuristicPolicy, rng: () => number = Math.random): Action {
  const actions = legalActions(state);
  if (actions.length === 0) throw new Error('No legal actions');
  if (state.phase === 'removing') return pick(actions, rng);
  const completing = completingActions(state, actions);
  if (completing.length > 0 && rng() < policy.complete) return pick(completing, rng);
  const blocking = blockingActions(state, actions);
  if (blocking.length > 0 && rng() < policy.block) return pick(blocking, rng);
  if (policy.avoidSetups && rng() < policy.avoidSetups) {
    const before = openTwos(state.board, state.turn);
    const calm = actions.filter((a) => openTwos(applyUnchecked(state, a, false).board, state.turn) <= before);
    if (calm.length > 0) return pick(calm, rng);
  }
  return pick(actions, rng);
}
