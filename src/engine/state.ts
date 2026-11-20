import { NUM_POINTS } from './board';

/** 0 = Player 1 (light, moves first), 1 = Player 2 (dark). */
export type Player = 0 | 1;
export const EMPTY = -1;
export type Cell = typeof EMPTY | Player;

/**
 * placing  - current player places a piece from hand
 * moving   - current player slides a piece
 * removing - current player just formed a dhadi and must remove an opponent piece
 * gameover - see `result`
 */
export type Phase = 'placing' | 'moving' | 'removing' | 'gameover';

/** 'resign' and 'abandoned' (opponent left) only occur in online games. */
export type WinReason = 'pieces' | 'blocked' | 'resign' | 'abandoned';
export type DrawReason = 'fifty' | 'repetition' | 'agreed';
export type GameResult =
  | { winner: Player; reason: WinReason }
  | { winner: null; reason: DrawReason };

export interface PlaceAction {
  type: 'place';
  to: number;
}
export interface MoveAction {
  type: 'move';
  from: number;
  to: number;
}
export interface RemoveAction {
  type: 'remove';
  at: number;
}
/** Plain JSON objects, safe to send over the wire. */
export type Action = PlaceAction | MoveAction | RemoveAction;

/** The whole game state is plain JSON (no classes, Maps or Sets). */
export interface GameState {
  readonly piecesPerPlayer: number;
  readonly board: readonly Cell[];
  /** Pieces still to be placed, per player. */
  readonly hand: readonly [number, number];
  /** Pieces each player has lost to captures. */
  readonly lost: readonly [number, number];
  /** Player to act. Stays the same during the `removing` phase. */
  readonly turn: Player;
  readonly phase: Phase;
  /** Indices into MILLS of dhadis formed by the most recent place/move (empty otherwise). */
  readonly formed: readonly number[];
  /** Move actions since the last capture (moving phase draw counter). */
  readonly movesSinceCapture: number;
  /** Occurrence count of positions seen in the moving phase (since the last capture). */
  readonly positions: Readonly<Record<string, number>>;
  readonly result: GameResult | null;
}

export const FIFTY_MOVE_LIMIT = 50;
export const REPETITION_LIMIT = 3;
export const MIN_PIECES = 3;

export const opponent = (p: Player): Player => (p === 0 ? 1 : 0);

export function createInitialState(piecesPerPlayer = 9): GameState {
  return {
    piecesPerPlayer,
    board: new Array<Cell>(NUM_POINTS).fill(EMPTY),
    hand: [piecesPerPlayer, piecesPerPlayer],
    lost: [0, 0],
    turn: 0,
    phase: 'placing',
    formed: [],
    movesSinceCapture: 0,
    positions: {},
    result: null,
  };
}

/** Key identifying a position for repetition purposes: board + side to move + phase. */
export function positionKey(board: readonly Cell[], turn: Player, phase: 'placing' | 'moving'): string {
  let s = '';
  for (let i = 0; i < board.length; i++) s += board[i] + 1;
  return `${s}|${turn}|${phase === 'placing' ? 'p' : 'm'}`;
}

/** Pieces a player still has in the game (board + hand). */
export function totalPieces(state: GameState, p: Player): number {
  let n = state.hand[p];
  for (const c of state.board) if (c === p) n++;
  return n;
}

/** End the game immediately with `result` (resignation, agreed draw, abandonment). */
export function endGame(state: GameState, result: GameResult): GameState {
  return { ...state, phase: 'gameover', formed: [], result };
}
