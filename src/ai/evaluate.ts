import { ADJACENT, MILLS, NUM_POINTS } from '../engine/board';
import { EMPTY, GameState, Player, opponent, totalPieces } from '../engine/state';

export const WIN_SCORE = 100_000;

/**
 * Static evaluation from `p`'s point of view (positive = good for p).
 * Material, closed dhadis, "two in a row with an empty third" (including whether it can be
 * completed by a placement or a slide), mobility and blocked pieces. Weights depend on phase.
 */
export function evaluate(state: GameState, p: Player): number {
  const o = opponent(p);
  const board = state.board;
  const placing = state.hand[0] + state.hand[1] > 0;

  let score = (totalPieces(state, p) - totalPieces(state, o)) * 100;

  const wClosed = placing ? 14 : 18;
  const wTwo = placing ? 9 : 6;
  const wThreat = 22;
  const wMobility = placing ? 1 : 4;
  const wBlocked = placing ? 3 : 7;

  const threat = (mill: readonly number[], empty: number, who: Player): boolean => {
    if (state.hand[who] > 0) return true; // can place straight into it
    for (const n of ADJACENT[empty]) {
      if (board[n] === who && !mill.includes(n)) return true;
    }
    return false;
  };

  for (const m of MILLS) {
    let mine = 0;
    let theirs = 0;
    let empty = -1;
    for (const pt of m) {
      const c = board[pt];
      if (c === p) mine++;
      else if (c === o) theirs++;
      else empty = pt;
    }
    if (mine === 3) score += wClosed;
    else if (theirs === 3) score -= wClosed;
    else if (mine === 2 && empty >= 0) {
      score += wTwo;
      if (threat(m, empty, p)) score += state.turn === p ? wThreat * 1.5 : wThreat;
    } else if (theirs === 2 && empty >= 0) {
      score -= wTwo;
      if (threat(m, empty, o)) score -= state.turn === o ? wThreat * 1.5 : wThreat;
    }
  }

  let mobMine = 0;
  let mobTheirs = 0;
  let blockedMine = 0;
  let blockedTheirs = 0;
  for (let i = 0; i < NUM_POINTS; i++) {
    const c = board[i];
    if (c === EMPTY) continue;
    let free = 0;
    for (const n of ADJACENT[i]) if (board[n] === EMPTY) free++;
    if (c === p) {
      mobMine += free;
      if (free === 0) blockedMine++;
    } else {
      mobTheirs += free;
      if (free === 0) blockedTheirs++;
    }
  }
  score += (mobMine - mobTheirs) * wMobility;
  score -= (blockedMine - blockedTheirs) * wBlocked;

  // A pending capture is worth roughly a piece to the player who is about to take it.
  if (state.phase === 'removing') score += (state.turn === p ? 1 : -1) * 90;

  return score;
}
