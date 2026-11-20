import { Action, Cell, GameState, Phase } from '../engine/state';

export const PROTOCOL_VERSION = 1;
export const MAX_CHAT_LENGTH = 300;

export type Message =
  | { t: 'hello'; v: number; name?: string }
  /** Host -> guest: pieces, colours and the full state (initial, rematch, or on reconnect). */
  | { t: 'config'; pieces: 9 | 11; hostColor: 0 | 1; state: GameState; n: number }
  | { t: 'action'; action: Action; n: number }
  | { t: 'sync-request' }
  | { t: 'state-sync'; state: GameState; n: number }
  | { t: 'chat'; text: string }
  | { t: 'draw-offer' }
  | { t: 'draw-accept' }
  | { t: 'draw-decline' }
  | { t: 'resign' }
  | { t: 'rematch-request' }
  | { t: 'rematch-accept' }
  | { t: 'ping'; ts: number }
  | { t: 'pong'; ts: number };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isPoint = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) < 24;
const isCount = (x: unknown, max: number): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= max;

export function parseAction(x: unknown): Action | null {
  if (!isObj(x)) return null;
  if (x.type === 'place' && isPoint(x.to)) return { type: 'place', to: x.to };
  if (x.type === 'move' && isPoint(x.from) && isPoint(x.to)) return { type: 'move', from: x.from, to: x.to };
  if (x.type === 'remove' && isPoint(x.at)) return { type: 'remove', at: x.at };
  return null;
}

const PHASES: Phase[] = ['placing', 'moving', 'removing', 'gameover'];

/** Structural validation of a received GameState (never trust the wire). */
export function parseState(x: unknown): GameState | null {
  if (!isObj(x)) return null;
  const { piecesPerPlayer, board, hand, lost, turn, phase, formed, movesSinceCapture, positions, result } = x;
  if (piecesPerPlayer !== 9 && piecesPerPlayer !== 11) return null;
  if (!Array.isArray(board) || board.length !== 24) return null;
  let count = [0, 0];
  for (const c of board) {
    if (c !== -1 && c !== 0 && c !== 1) return null;
    if (c !== -1) count[c as number]++;
  }
  if (!Array.isArray(hand) || hand.length !== 2 || !isCount(hand[0], 11) || !isCount(hand[1], 11)) return null;
  if (!Array.isArray(lost) || lost.length !== 2 || !isCount(lost[0], 11) || !isCount(lost[1], 11)) return null;
  if (count[0] > 11 || count[1] > 11) return null;
  if (turn !== 0 && turn !== 1) return null;
  if (typeof phase !== 'string' || !PHASES.includes(phase as Phase)) return null;
  if (!Array.isArray(formed) || formed.length > 4 || !formed.every((f) => Number.isInteger(f) && f >= 0 && f < 16)) return null;
  if (!isCount(movesSinceCapture, 10_000)) return null;
  if (!isObj(positions)) return null;
  for (const v of Object.values(positions)) if (!isCount(v, 10)) return null;
  if (Object.keys(positions).length > 500) return null;
  let res: GameState['result'] = null;
  if (result !== null) {
    if (!isObj(result)) return null;
    const w = result.winner;
    const reason = result.reason;
    if (w === null && (reason === 'fifty' || reason === 'repetition' || reason === 'agreed')) {
      res = { winner: null, reason };
    } else if ((w === 0 || w === 1) && (reason === 'pieces' || reason === 'blocked' || reason === 'resign' || reason === 'abandoned')) {
      res = { winner: w, reason };
    } else return null;
  }
  if ((phase === 'gameover') !== (res !== null)) return null;
  return {
    piecesPerPlayer,
    board: board as Cell[],
    hand: [hand[0], hand[1]] as [number, number],
    lost: [lost[0], lost[1]] as [number, number],
    turn,
    phase: phase as Phase,
    formed: formed as number[],
    movesSinceCapture,
    positions: { ...(positions as Record<string, number>) },
    result: res,
  };
}

/** Validate and normalise an incoming wire message. Returns null for anything malformed. */
export function parseMessage(raw: unknown): Message | null {
  if (!isObj(raw) || typeof raw.t !== 'string') return null;
  switch (raw.t) {
    case 'hello':
      if (!Number.isInteger(raw.v)) return null;
      return { t: 'hello', v: raw.v as number, name: typeof raw.name === 'string' ? raw.name.slice(0, 30) : undefined };
    case 'config':
    case 'state-sync': {
      const state = parseState(raw.state);
      if (!state || !isCount(raw.n, 100_000)) return null;
      if (raw.t === 'state-sync') return { t: 'state-sync', state, n: raw.n };
      if ((raw.pieces !== 9 && raw.pieces !== 11) || (raw.hostColor !== 0 && raw.hostColor !== 1)) return null;
      if (state.piecesPerPlayer !== raw.pieces) return null;
      return { t: 'config', pieces: raw.pieces, hostColor: raw.hostColor, state, n: raw.n };
    }
    case 'action': {
      const action = parseAction(raw.action);
      if (!action || !isCount(raw.n, 100_000)) return null;
      return { t: 'action', action, n: raw.n };
    }
    case 'chat':
      if (typeof raw.text !== 'string') return null;
      return { t: 'chat', text: raw.text.slice(0, MAX_CHAT_LENGTH) };
    case 'ping':
    case 'pong':
      if (typeof raw.ts !== 'number') return null;
      return { t: raw.t, ts: raw.ts };
    case 'sync-request':
    case 'draw-offer':
    case 'draw-accept':
    case 'draw-decline':
    case 'resign':
    case 'rematch-request':
    case 'rematch-accept':
      return { t: raw.t };
    default:
      return null;
  }
}
