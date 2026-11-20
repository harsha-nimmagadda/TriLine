import { Cell, EMPTY, GameState, Phase, Player, createInitialState } from '../src/engine';

export interface Setup {
  /** Points occupied by Player 1 (light). */
  p1?: number[];
  /** Points occupied by Player 2 (dark). */
  p2?: number[];
  hand?: [number, number];
  turn?: Player;
  phase?: Phase;
  pieces?: number;
  movesSinceCapture?: number;
  lost?: [number, number];
}

/** Build an arbitrary position for tests. Phase defaults to placing/moving based on hand. */
export function makeState(s: Setup): GameState {
  const base = createInitialState(s.pieces ?? 9);
  const board: Cell[] = new Array<Cell>(24).fill(EMPTY);
  for (const i of s.p1 ?? []) board[i] = 0;
  for (const i of s.p2 ?? []) board[i] = 1;
  const hand = s.hand ?? [0, 0];
  const turn = s.turn ?? 0;
  const phase = s.phase ?? (hand[turn] > 0 ? 'placing' : 'moving');
  return {
    ...base,
    board,
    hand,
    lost: s.lost ?? [0, 0],
    turn,
    phase,
    movesSinceCapture: s.movesSinceCapture ?? 0,
  };
}
