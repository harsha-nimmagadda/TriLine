import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, chooseAction, evaluate, searchBestAction } from '../src/ai';
import {
  Action,
  GameState,
  applyAction,
  createInitialState,
  isLegalAction,
  legalActions,
} from '../src/engine';
import { makeState } from './helpers';

// Deterministic RNG
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('AI search', () => {
  it('completes a dhadi when it can (placing)', () => {
    const s = makeState({ p1: [0, 1], p2: [8, 12], hand: [5, 5], turn: 0 });
    for (const d of DIFFICULTIES) {
      // At depth 1 (and noise-free) the immediate dhadi is clearly best; deeper searches may
      // legitimately prefer a double threat.
      const a = chooseAction(s, d, { rng: mulberry(1), timeMs: 300, maxDepth: 1, noise: 0 });
      expect(a).toEqual({ type: 'place', to: 2 });
    }
  });

  it('easy usually takes an obvious capture even with noise', () => {
    const s = makeState({ p1: [0, 1], p2: [8, 12], hand: [5, 5], turn: 0 });
    let hits = 0;
    for (let i = 0; i < 20; i++) {
      const a = chooseAction(s, 'easy', { rng: mulberry(100 + i) });
      if (s && a.type === 'place' && (a.to === 2 || a.to === 9 || a.to === 6 || a.to === 7)) hits++;
    }
    expect(hits).toBeGreaterThanOrEqual(15);
  });

  it('blocks an opponent dhadi when it cannot win material itself (placing)', () => {
    const s = makeState({ p1: [16, 20], p2: [8, 9], hand: [5, 5], turn: 0 });
    const a = chooseAction(s, 'medium', { rng: mulberry(2) });
    expect(a).toEqual({ type: 'place', to: 10 });
  });

  it('completes a dhadi by sliding (moving phase)', () => {
    const s = makeState({ p1: [0, 1, 3, 20], p2: [10, 12, 14, 22], hand: [0, 0], turn: 0 });
    const a = chooseAction(s, 'hard', { timeMs: 300, rng: mulberry(3) });
    expect(a).toEqual({ type: 'move', from: 3, to: 2 });
  });

  it('chooses a sensible removal: breaks the opponent two-in-a-row threat', () => {
    // P1 just formed 0,1,2 and must remove. P2 has 8,9 (threat on 10) plus loose 20.
    let s = makeState({ p1: [0, 1], p2: [8, 9, 20], hand: [5, 4], turn: 0 });
    s = applyAction(s, { type: 'place', to: 2 });
    expect(s.phase).toBe('removing');
    const a = chooseAction(s, 'medium', { rng: mulberry(4) });
    expect(a.type).toBe('remove');
    expect([8, 9]).toContain((a as { at: number }).at);
  });

  it('always returns a legal action for each phase and difficulty', () => {
    const states: GameState[] = [
      createInitialState(),
      makeState({ p1: [0, 1, 3], p2: [10, 12, 14, 20], hand: [0, 0], turn: 1 }),
    ];
    for (const s of states) {
      for (const d of DIFFICULTIES) {
        const a = chooseAction(s, d, { rng: mulberry(5), timeMs: 200, maxDepth: 3 });
        expect(isLegalAction(s, a)).toBe(true);
      }
    }
  });

  it('prefers a forced win by blockade/capture over nothing (win score)', () => {
    // P1 to move; capturing the 3rd-from-last piece wins immediately.
    const s = makeState({ p1: [0, 1, 3], p2: [10, 12, 14], hand: [0, 0], turn: 0 });
    const r = searchBestAction(s, { maxDepth: 3, rng: mulberry(6) });
    expect(r.action).toEqual({ type: 'move', from: 3, to: 2 });
    expect(r.score).toBeGreaterThan(50_000);
  });

  it('evaluation is antisymmetric in material', () => {
    const s = makeState({ p1: [0, 1, 2, 3], p2: [10, 12, 14], hand: [0, 0], turn: 0 });
    expect(evaluate(s, 0)).toBeGreaterThan(0);
    expect(evaluate(s, 1)).toBeLessThan(0);
  });

  it('respects the time budget on a full opening search', () => {
    const t = Date.now();
    const r = searchBestAction(createInitialState(), { maxDepth: 14, timeMs: 400, rng: mulberry(7) });
    expect(Date.now() - t).toBeLessThan(1500);
    expect(r.depth).toBeGreaterThanOrEqual(1);
  });

  it('plays full games between AIs to a legal finish', () => {
    const rng = mulberry(42);
    let s = createInitialState(9);
    let plies = 0;
    while (s.phase !== 'gameover' && plies < 400) {
      const a: Action = chooseAction(s, plies % 2 ? 'easy' : 'medium', { rng, maxDepth: 2, timeMs: 200 });
      expect(isLegalAction(s, a)).toBe(true);
      s = applyAction(s, a);
      plies++;
    }
    expect(s.phase).toBe('gameover');
    expect(s.result).not.toBeNull();
    void legalActions;
  }, 60_000);
});
