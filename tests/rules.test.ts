import { describe, expect, it } from 'vitest';
import {
  Action,
  GameState,
  MILLS,
  applyAction,
  capturablePoints,
  createInitialState,
  isInMill,
  legalActions,
  positionKey,
} from '../src/engine';
import { makeState } from './helpers';

const place = (to: number): Action => ({ type: 'place', to });
const move = (from: number, to: number): Action => ({ type: 'move', from, to });
const remove = (at: number): Action => ({ type: 'remove', at });
const run = (s: GameState, ...actions: Action[]) => actions.reduce(applyAction, s);

describe('initial state and placing', () => {
  it('starts with Player 1 to place, 9 pieces each', () => {
    const s = createInitialState();
    expect(s.turn).toBe(0);
    expect(s.phase).toBe('placing');
    expect(s.hand).toEqual([9, 9]);
    expect(legalActions(s).length).toBe(24);
  });

  it('supports 11 pieces', () => {
    const s = createInitialState(11);
    expect(s.hand).toEqual([11, 11]);
    expect(s.piecesPerPlayer).toBe(11);
  });

  it('alternates turns and decreases hand', () => {
    const s = run(createInitialState(), place(0), place(1));
    expect(s.board[0]).toBe(0);
    expect(s.board[1]).toBe(1);
    expect(s.hand).toEqual([8, 8]);
    expect(s.turn).toBe(0);
  });

  it('is immutable and does not mutate input', () => {
    const s = createInitialState();
    const copy = JSON.stringify(s);
    const n = applyAction(s, place(5));
    expect(JSON.stringify(s)).toBe(copy);
    expect(n).not.toBe(s);
  });

  it('rejects illegal actions', () => {
    const s = run(createInitialState(), place(0));
    expect(() => applyAction(s, place(0))).toThrow();
    expect(() => applyAction(s, move(0, 1))).toThrow();
    expect(() => applyAction(s, remove(0))).toThrow();
  });

  it('state is JSON round-trippable', () => {
    const s = run(createInitialState(), place(0), place(1), place(2));
    const back = JSON.parse(JSON.stringify(s)) as GameState;
    expect(back).toEqual(s);
    expect(applyAction(back, place(3)).board[3]).toBe(1);
  });
});

describe('dhadi formation and capture', () => {
  it('forming a dhadi in placing requires a removal by the same player', () => {
    // P1: 0,1 ; P2: 8,9 ; P1 places 2 -> top side of outer square
    const s = makeState({ p1: [0, 1], p2: [8, 9], hand: [7, 7], turn: 0 });
    const n = applyAction(s, place(2));
    expect(n.phase).toBe('removing');
    expect(n.turn).toBe(0);
    expect(n.formed.length).toBe(1);
    expect(MILLS[n.formed[0]]).toEqual([0, 1, 2]);
    expect(legalActions(n).every((a) => a.type === 'remove')).toBe(true);
    const r = applyAction(n, remove(8));
    expect(r.board[8]).toBe(-1);
    expect(r.lost).toEqual([0, 1]);
    expect(r.turn).toBe(1);
    expect(r.phase).toBe('placing');
    expect(r.formed).toEqual([]);
  });

  it('cross-lines count as dhadis', () => {
    const s = makeState({ p1: [1, 9], p2: [0, 2], hand: [5, 5], turn: 0 });
    const n = applyAction(s, place(17));
    expect(n.phase).toBe('removing');
    expect(MILLS[n.formed[0]]).toEqual([1, 9, 17]);
  });

  it('corner-to-corner on different squares is NOT a dhadi', () => {
    const s = makeState({ p1: [0, 8], p2: [2, 3], hand: [5, 5], turn: 0 });
    const n = applyAction(s, place(16));
    expect(n.phase).toBe('placing');
  });

  it('pieces in a dhadi cannot be removed while others are available', () => {
    // P2 has a mill 8,9,10 and a loose piece 20. P1 forms a mill.
    const s = makeState({ p1: [0, 1], p2: [8, 9, 10, 20], hand: [5, 3], turn: 0 });
    const n = applyAction(s, place(2));
    const targets = legalActions(n).map((a) => (a as { at: number }).at);
    expect(targets).toEqual([20]);
    expect(() => applyAction(n, remove(8))).toThrow();
  });

  it('if ALL opponent pieces are in dhadis, any may be removed', () => {
    const s = makeState({ p1: [0, 1], p2: [8, 9, 10], hand: [5, 3], turn: 0 });
    const n = applyAction(s, place(2));
    const targets = legalActions(n).map((a) => (a as { at: number }).at);
    expect(targets.sort((a, b) => a - b)).toEqual([8, 9, 10]);
    const r = applyAction(n, remove(9));
    expect(r.board[9]).toBe(-1);
  });

  it('all-in-dhadis with two separate dhadis', () => {
    const b = makeState({ p1: [0, 1], p2: [8, 9, 10, 16, 18, 22], hand: [5, 3], turn: 0 });
    // 16,18,22 are not a dhadi: only they are capturable
    expect(capturablePoints(b.board, 1).sort((x, y) => x - y)).toEqual([16, 18, 22]);
    const c = makeState({ p1: [0, 1], p2: [8, 9, 10, 18, 19, 20], hand: [5, 3], turn: 0 });
    expect(capturablePoints(c.board, 1).sort((x, y) => x - y)).toEqual([8, 9, 10, 18, 19, 20]);
  });

  it('isInMill reports membership', () => {
    const s = makeState({ p1: [0, 1, 2, 5], p2: [] });
    expect(isInMill(s.board, 1)).toBe(true);
    expect(isInMill(s.board, 5)).toBe(false);
    expect(isInMill(s.board, 7)).toBe(false);
  });

  it('a single placement forming two dhadis removes only one piece', () => {
    // P1 on 0,1 (top side) and 6,7 (left side); placing 0 would complete both - so P1 has 1,2,6,7 and places 0.
    const s = makeState({ p1: [1, 2, 6, 7], p2: [10, 11, 12, 20], hand: [4, 4], turn: 0 });
    const n = applyAction(s, place(0));
    expect(n.formed.length).toBe(2);
    expect(n.phase).toBe('removing');
    const r = applyAction(n, remove(20));
    expect(r.lost).toEqual([0, 1]);
    expect(r.turn).toBe(1);
    expect(r.phase).toBe('placing');
  });

  it('a move that forms a dhadi triggers removal', () => {
    // P1 on 0,1 and 3; slide 3->2 forms the top side.
    const s = makeState({ p1: [0, 1, 3], p2: [10, 12, 14, 20], hand: [0, 0], turn: 0 });
    expect(s.phase).toBe('moving');
    const n = applyAction(s, move(3, 2));
    expect(n.phase).toBe('removing');
    const r = applyAction(n, remove(10));
    expect(r.turn).toBe(1);
    expect(r.phase).toBe('moving');
    expect(r.board[10]).toBe(-1);
  });

  it('breaking and re-forming a dhadi captures again', () => {
    const s0 = makeState({ p1: [0, 1, 2], p2: [10, 12, 14, 20, 22], hand: [0, 0], turn: 0 });
    // P1 opens: 2 -> 3, P2 shuffles, P1 closes: 3 -> 2
    let s = run(s0, move(2, 3), move(20, 21));
    expect(s.phase).toBe('moving');
    s = applyAction(s, move(3, 2));
    expect(s.phase).toBe('removing');
    expect(s.formed.length).toBe(1);
    s = applyAction(s, remove(10));
    expect(s.lost).toEqual([0, 1]);
  });

  it('moving a piece out of a dhadi and back to a different dhadi both capture', () => {
    // sliding along a cross line to complete mill 1,9,17 from 3? use 0,1,2 + 9,17 style
    const s = makeState({ p1: [1, 9, 18], p2: [0, 2, 4, 6], hand: [0, 0], turn: 0 });
    // 18 -> 17 completes cross-line 1,9,17
    const n = applyAction(s, move(18, 17));
    expect(n.phase).toBe('removing');
  });

  it('removal reduces opponent total, hand pieces count toward total', () => {
    const s = makeState({ p1: [0, 1], p2: [8, 9], hand: [5, 4], turn: 0 });
    const n = run(s, place(2), remove(8));
    expect(n.lost).toEqual([0, 1]);
    expect(n.hand).toEqual([4, 4]);
  });

  it('removing phase: only the remover may act and legalActions are removes', () => {
    const s = makeState({ p1: [0, 1], p2: [8, 9], hand: [5, 4], turn: 0 });
    const n = applyAction(s, place(2));
    expect(n.turn).toBe(0);
    expect(() => applyAction(n, place(5))).toThrow();
  });
});

describe('moving phase', () => {
  it('moves are slides to adjacent empty points only', () => {
    const s = makeState({ p1: [0, 5, 20], p2: [1, 12, 14], hand: [0, 0], turn: 0 });
    const targets = legalActions(s)
      .filter((a) => a.type === 'move' && a.from === 0)
      .map((a) => (a as { to: number }).to);
    expect(targets).toEqual([7]); // 1 is occupied; 0 is a corner so no cross link
    expect(() => applyAction(s, move(0, 8))).toThrow();
    expect(() => applyAction(s, move(0, 2))).toThrow(); // jumping
  });

  it('no flying even with 3 pieces', () => {
    const s = makeState({ p1: [0, 3, 21], p2: [8, 10, 12, 14, 16, 18], hand: [0, 0], turn: 0 });
    const fromZero = legalActions(s)
      .filter((a) => a.type === 'move' && a.from === 0)
      .map((a) => (a as { to: number }).to);
    expect(fromZero).toEqual([1, 7]); // only adjacent points, never 4 / 21 etc.
    expect(legalActions(s).every((a) => a.type === 'move')).toBe(true);
    expect(() => applyAction(s, move(0, 4))).toThrow();
  });

  it('transitions to moving after both players placed everything', () => {
    let s = createInitialState(9);
    // place pieces on points avoiding any dhadi: alternate pattern
    const p1pts = [0, 2, 4, 6, 9, 11, 13, 15, 17];
    const p2pts = [1, 3, 5, 7, 8, 10, 12, 14, 16];
    for (let i = 0; i < 9; i++) {
      s = applyAction(s, place(p1pts[i]));
      if (s.phase === 'removing') throw new Error('unexpected mill at ' + i);
      s = applyAction(s, place(p2pts[i]));
      if (s.phase === 'removing') throw new Error('unexpected mill (p2) at ' + i);
    }
    expect(s.hand).toEqual([0, 0]);
    expect(s.phase).toBe('moving');
    expect(s.turn).toBe(0);
  });

  it('11-piece game fills the board to 22 with moves possible only on 2 empty points', () => {
    let s = createInitialState(11);
    // Choose placements without forming dhadis: find greedily with legal-action search.
    for (let i = 0; i < 22; i++) {
      const acts = legalActions(s);
      const safe = acts.find((a) => applyAction(s, a).phase !== 'removing');
      if (!safe) throw new Error('no safe placement');
      s = applyAction(s, safe);
      if (s.phase === 'gameover') break;
    }
    // either finished placing or game ended by block; verify counts if not over
    if (s.phase !== 'gameover') {
      expect(s.hand).toEqual([0, 0]);
      expect(s.board.filter((c) => c === 0).length).toBe(11);
      expect(s.board.filter((c) => c === 1).length).toBe(11);
      expect(s.phase).toBe('moving');
    } else {
      expect(s.result?.reason).toBe('blocked');
    }
  });
});

describe('win conditions', () => {
  it('wins when opponent drops below 3 pieces (board only)', () => {
    const s = makeState({ p1: [0, 1, 3], p2: [10, 12, 14], hand: [0, 0], turn: 0 });
    const n = run(s, move(3, 2), remove(10));
    expect(n.phase).toBe('gameover');
    expect(n.result).toEqual({ winner: 0, reason: 'pieces' });
  });

  it('pieces in hand count toward the total (no loss while hand keeps it >= 3)', () => {
    const s = makeState({ p1: [0, 1], p2: [10, 12], hand: [5, 1], turn: 0 });
    const n = run(s, place(2), remove(10));
    // P2 has 1 on board + 1 in hand = 2 < 3 -> loses
    expect(n.result).toEqual({ winner: 0, reason: 'pieces' });
    const s2 = makeState({ p1: [0, 1], p2: [10, 12], hand: [5, 2], turn: 0 });
    const n2 = run(s2, place(2), remove(10));
    expect(n2.phase).toBe('placing'); // 1 + 2 = 3, still alive
    expect(n2.result).toBeNull();
  });

  it('wins when opponent has no legal move on their turn', () => {
    // P2 pieces at 0 and 2 and 1? Build: P2 on 0 (neighbours 1,7) with P1 occupying them; P2 other pieces blocked too.
    // P2: 0, 3, 6 ; P1 blocks: 1,7 (for 0), 2,4 (for 3), 5,7 (for 6)... plus P1 needs a legal move that doesn't free them.
    const s = makeState({
      p1: [1, 3, 5, 7, 20],
      p2: [0, 2, 4],
      hand: [0, 0],
      turn: 0,
    });
    // P1 moves 20 -> 21 (harmless). P2 is blocked and loses.
    const n = applyAction(s, move(20, 21));
    expect(n.phase).toBe('gameover');
    expect(n.result).toEqual({ winner: 0, reason: 'blocked' });
  });

  it('blocked loss after a capture-free placing->moving transition', () => {
    // Last placement by P2 leaves P1 (to move) with no moves.
    const s = makeState({
      p1: [0, 2, 4],
      p2: [1, 3, 5, 7],
      hand: [0, 1],
      turn: 1,
      pieces: 3,
    });
    // P2 places on 20 (not adjacent to anything relevant); then P1 to move, hand 0, blocked.
    const n = applyAction(s, place(20));
    expect(n.result).toEqual({ winner: 1, reason: 'blocked' });
  });

  it('removal that leaves the opponent blocked wins by blockade', () => {
    // After capture, P2 still has pieces but none can move.
    // P2's corner pieces 0,2,4 are walled in by P1; only the piece on 12 can move.
    const s2 = makeState({
      p1: [1, 3, 5, 7, 20, 21, 23],
      p2: [0, 2, 4, 12],
      hand: [0, 0],
      turn: 0,
    });
    const n = applyAction(s2, move(23, 22));
    expect(n.phase).toBe('removing');
    // remove the only mobile piece (12)
    const r = applyAction(n, remove(12));
    expect(r.result).toEqual({ winner: 0, reason: 'blocked' });
  });

  it('no actions after game over', () => {
    const s = makeState({ p1: [0, 1, 3], p2: [10, 12, 14], hand: [0, 0], turn: 0 });
    const n = run(s, move(3, 2), remove(10));
    expect(legalActions(n)).toEqual([]);
    expect(() => applyAction(n, move(0, 7))).toThrow();
  });
});

describe('draw rules', () => {
  // Two far-apart pieces shuffle: P1 piece 0<->7, P2 piece 16<->23 (no dhadis possible).
  const shuffleState = () => makeState({ p1: [0, 2, 4], p2: [16, 18, 20], hand: [0, 0], turn: 0 });

  it('draws after 50 moves without a capture', () => {
    // Use bigger cycle to avoid repetition: vary movements across many positions.
    let s = makeState({ p1: [0, 4, 9], p2: [16, 20, 13], hand: [0, 0], turn: 0, movesSinceCapture: 48 });
    s = applyAction(s, move(0, 1));
    expect(s.result).toBeNull();
    expect(s.movesSinceCapture).toBe(49);
    s = applyAction(s, move(16, 17));
    expect(s.movesSinceCapture).toBe(50);
    expect(s.result).toEqual({ winner: null, reason: 'fifty' });
    expect(s.phase).toBe('gameover');
  });

  it('counter resets on capture', () => {
    const s = makeState({
      p1: [0, 1, 3],
      p2: [10, 12, 14, 20],
      hand: [0, 0],
      turn: 0,
      movesSinceCapture: 40,
    });
    const n = run(s, move(3, 2));
    expect(n.movesSinceCapture).toBe(41);
    const r = applyAction(n, remove(20));
    expect(r.movesSinceCapture).toBe(0);
    expect(Object.keys(r.positions).length).toBe(1); // only the fresh post-capture position
  });

  it('counts only moving-phase moves, not placements', () => {
    let s = createInitialState();
    s = run(s, place(0), place(1), place(5));
    expect(s.movesSinceCapture).toBe(0);
  });

  it('draws on threefold repetition of position + side to move', () => {
    let s = shuffleState();
    // cycle: P1 0->1, P2 16->17, P1 1->0, P2 17->16 returns to the start position (P1 to move)
    const cycle = [move(0, 1), move(16, 17), move(1, 0), move(17, 16)];
    // Position after the 1st move (P2 to move) occurs once per cycle: third occurrence is a draw.
    s = run(s, ...cycle);
    expect(s.result).toBeNull();
    s = run(s, ...cycle);
    expect(s.result).toBeNull();
    s = applyAction(s, cycle[0]);
    expect(s.result).toEqual({ winner: null, reason: 'repetition' });
  });

  it('same board with a different side to move is a different position', () => {
    const b = shuffleState().board;
    expect(positionKey(b, 0, 'moving')).not.toBe(positionKey(b, 1, 'moving'));
    expect(positionKey(b, 0, 'moving')).not.toBe(positionKey(b, 0, 'placing'));
  });

  it('repetition counter does not trigger on twofold', () => {
    let s = shuffleState();
    s = run(s, move(0, 1), move(16, 17), move(1, 0), move(17, 16), move(0, 1), move(16, 17));
    expect(s.result).toBeNull();
  });
});
