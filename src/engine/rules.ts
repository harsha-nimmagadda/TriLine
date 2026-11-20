import { ADJACENT, MILLS, MILLS_AT } from './board';
import {
  Action,
  Cell,
  EMPTY,
  FIFTY_MOVE_LIMIT,
  GameResult,
  GameState,
  MIN_PIECES,
  Phase,
  Player,
  REPETITION_LIMIT,
  opponent,
  positionKey,
  totalPieces,
} from './state';

/** Indices of mills that contain `point` and are fully occupied by `player`. */
export function millsFormedAt(board: readonly Cell[], point: number, player: Player): number[] {
  const out: number[] = [];
  for (const mi of MILLS_AT[point]) {
    const m = MILLS[mi];
    if (board[m[0]] === player && board[m[1]] === player && board[m[2]] === player) out.push(mi);
  }
  return out;
}

/** Is the piece on `point` part of a complete dhadi of its own colour? */
export function isInMill(board: readonly Cell[], point: number): boolean {
  const c = board[point];
  if (c === EMPTY) return false;
  return millsFormedAt(board, point, c as Player).length > 0;
}

/** Opponent pieces `victim`'s attacker may remove: those not in a dhadi, unless all are in dhadis. */
export function capturablePoints(board: readonly Cell[], victim: Player): number[] {
  const all: number[] = [];
  const free: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== victim) continue;
    all.push(i);
    if (!isInMill(board, i)) free.push(i);
  }
  return free.length > 0 ? free : all;
}

/** Empty points adjacent to `from`. */
export function moveTargets(board: readonly Cell[], from: number): number[] {
  return ADJACENT[from].filter((n) => board[n] === EMPTY);
}

export function hasLegalMove(board: readonly Cell[], player: Player): boolean {
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== player) continue;
    for (const n of ADJACENT[i]) if (board[n] === EMPTY) return true;
  }
  return false;
}

/** True when the player to act (ignoring a pending removal) still has pieces to place. */
export function isPlacingTurn(state: GameState): boolean {
  return state.hand[state.turn] > 0;
}

export function legalActions(state: GameState): Action[] {
  const out: Action[] = [];
  const me = state.turn;
  const board = state.board;
  switch (state.phase) {
    case 'gameover':
      return out;
    case 'removing':
      for (const at of capturablePoints(board, opponent(me))) out.push({ type: 'remove', at });
      return out;
    case 'placing':
      for (let i = 0; i < board.length; i++) if (board[i] === EMPTY) out.push({ type: 'place', to: i });
      return out;
    case 'moving':
      for (let i = 0; i < board.length; i++) {
        if (board[i] !== me) continue;
        for (const to of ADJACENT[i]) if (board[to] === EMPTY) out.push({ type: 'move', from: i, to });
      }
      return out;
  }
}

export function sameAction(a: Action, b: Action): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'place':
      return a.to === (b as typeof a).to;
    case 'move':
      return a.from === (b as typeof a).from && a.to === (b as typeof a).to;
    case 'remove':
      return a.at === (b as typeof a).at;
  }
}

export function isLegalAction(state: GameState, action: Action): boolean {
  return legalActions(state).some((a) => sameAction(a, action));
}

function nextTurnPhase(hand: readonly [number, number], turn: Player): Phase {
  return hand[turn] > 0 ? 'placing' : 'moving';
}

/** Finish the current player's turn: hand over to the opponent and evaluate win/draw. */
function endTurn(
  prev: GameState,
  board: Cell[],
  hand: [number, number],
  lost: [number, number],
  movesSinceCapture: number,
  positions: Readonly<Record<string, number>>,
  formed: number[],
  trackPositions: boolean,
): GameState {
  const me = prev.turn;
  const next = opponent(me);
  const base = {
    piecesPerPlayer: prev.piecesPerPlayer,
    board,
    hand,
    lost,
    formed,
    movesSinceCapture,
  };
  const finish = (result: GameResult, pos = positions): GameState => ({
    ...base,
    turn: next,
    phase: 'gameover',
    positions: pos,
    result,
  });

  // Fewer than 3 pieces (board + hand) loses.
  let remaining = hand[next];
  for (const c of board) if (c === next) remaining++;
  if (remaining < MIN_PIECES) return finish({ winner: me, reason: 'pieces' });

  const phase = nextTurnPhase(hand, next);
  if (phase === 'moving' && !hasLegalMove(board, next)) {
    return finish({ winner: me, reason: 'blocked' });
  }

  let pos = positions;
  if (phase === 'moving') {
    if (movesSinceCapture >= FIFTY_MOVE_LIMIT) return finish({ winner: null, reason: 'fifty' });
    if (trackPositions) {
      const key = positionKey(board, next, 'moving');
      const count = (positions[key] ?? 0) + 1;
      pos = { ...positions, [key]: count };
      if (count >= REPETITION_LIMIT) return finish({ winner: null, reason: 'repetition' }, pos);
    }
  }
  return { ...base, turn: next, phase, positions: pos, result: null };
}

/**
 * Apply an action without validating it (used by the AI search, where actions come from
 * legalActions). `trackPositions=false` skips repetition bookkeeping for speed.
 */
export function applyUnchecked(state: GameState, action: Action, trackPositions = true): GameState {
  const me = state.turn;
  const opp = opponent(me);
  const board = state.board.slice() as Cell[];

  if (action.type === 'remove') {
    board[action.at] = EMPTY;
    const lost: [number, number] = [state.lost[0], state.lost[1]];
    lost[opp]++;
    // A capture is irreversible, so earlier positions can never recur.
    return endTurn(state, board, [state.hand[0], state.hand[1]], lost, 0, {}, [], trackPositions);
  }

  const hand: [number, number] = [state.hand[0], state.hand[1]];
  let moves = state.movesSinceCapture;
  let to: number;
  if (action.type === 'place') {
    to = action.to;
    board[to] = me;
    hand[me]--;
  } else {
    to = action.to;
    board[action.from] = EMPTY;
    board[to] = me;
    moves++;
  }

  const formed = millsFormedAt(board, to, me);
  const lost: [number, number] = [state.lost[0], state.lost[1]];
  if (formed.length > 0 && capturablePoints(board, opp).length > 0) {
    // Dhadi: same player must now remove a piece. (Two dhadis at once still remove only one.)
    return {
      piecesPerPlayer: state.piecesPerPlayer,
      board,
      hand,
      lost,
      turn: me,
      phase: 'removing',
      formed,
      movesSinceCapture: moves,
      positions: state.positions,
      result: null,
    };
  }
  return endTurn(state, board, hand, lost, moves, state.positions, formed, trackPositions);
}

/** Pure, immutable. Throws if the action is not legal in `state`. */
export function applyAction(state: GameState, action: Action): GameState {
  if (state.phase === 'gameover') throw new Error('Game is over');
  if (!isLegalAction(state, action)) {
    throw new Error(`Illegal action in phase ${state.phase}: ${JSON.stringify(action)}`);
  }
  return applyUnchecked(state, action, true);
}

export { totalPieces };
