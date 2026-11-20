import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, Difficulty, LEGACY_DIFFICULTY, chooseAction, evaluate, migrateDifficulty, searchBestAction } from '../src/ai';
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
  const openMill = () => makeState({ p1: [0, 1], p2: [8, 12], hand: [5, 5], turn: 0 });
  const rate = (s: GameState, d: Difficulty, pred: (a: Action) => boolean, n = 200) => {
    let hits = 0;
    for (let i = 0; i < n; i++) if (pred(chooseAction(s, d, { rng: mulberry(1000 + i), timeMs: 100, maxDepth: 2 }))) hits++;
    return hits / n;
  };

  it('hard always completes an open dhadi (shallow search)', () => {
    const a = chooseAction(openMill(), 'expert', { rng: mulberry(1), timeMs: 300, maxDepth: 1, noise: 0 });
    expect(a).toEqual({ type: 'place', to: 2 });
  });

  it('completes an open dhadi at the intended rate per level (easy ~50%, medium usually, hard always)', () => {
    const completes = (a: Action) => a.type === 'place' && a.to === 2;
    const easy = rate(openMill(), 'kids', completes);
    const medium = rate(openMill(), 'easy', completes);
    const hard = rate(openMill(), 'expert', (a) => a.type === 'place' && a.to !== 99, 20);
    expect(easy).toBeGreaterThan(0.4);
    expect(easy).toBeLessThan(0.65);
    expect(medium).toBeGreaterThan(0.75);
    expect(hard).toBe(1);
  });

  it('hard blocks an opponent dhadi when it cannot win material itself (placing)', () => {
    const s = makeState({ p1: [16, 20], p2: [8, 9], hand: [5, 5], turn: 0 });
    const a = chooseAction(s, 'expert', { rng: mulberry(2), maxDepth: 4, timeMs: undefined });
    expect(a).toEqual({ type: 'place', to: 10 });
  });

  it('blocking rate: easy rarely, medium usually but not always', () => {
    const s = makeState({ p1: [16, 20], p2: [8, 9], hand: [5, 5], turn: 0 });
    const blocks = (a: Action) => a.type === 'place' && a.to === 10;
    const easy = rate(s, 'kids', blocks);
    const medium = rate(s, 'easy', blocks);
    expect(easy).toBeLessThan(0.35);
    expect(medium).toBeGreaterThan(0.55);
    expect(medium).toBeLessThan(0.9);
    expect(medium).toBeGreaterThan(easy + 0.3);
  });

  it('easy removes a random allowed piece only (never a protected one)', () => {
    // P2 has a dhadi 8,9,10 and loose pieces 20, 22; P1 just formed a dhadi.
    let s = makeState({ p1: [0, 1], p2: [8, 9, 10, 20, 22], hand: [5, 3], turn: 0 });
    s = applyAction(s, { type: 'place', to: 2 });
    const picks = new Set<number>();
    for (let i = 0; i < 60; i++) {
      const a = chooseAction(s, 'kids', { rng: mulberry(i) });
      expect(isLegalAction(s, a)).toBe(true);
      picks.add((a as { at: number }).at);
    }
    expect([...picks].sort()).toEqual([20, 22]);
  });

  it('hard and expert always take an immediate dhadi and block; medium usually does', () => {
    const completes = (a: Action) => a.type === 'place' && a.to === 2;
    const block = makeState({ p1: [16, 20], p2: [8, 9], hand: [5, 5], turn: 0 });
    const blocks = (a: Action) => a.type === 'place' && a.to === 10;
    for (const d of ['hard', 'expert'] as const) {
      const opts = { maxDepth: 1, timeMs: undefined, noise: 0 } as const;
      expect(chooseAction(openMill(), d, { rng: mulberry(7), ...opts })).toEqual({ type: 'place', to: 2 });
      // Slide completion in the moving phase.
      const slide = makeState({ p1: [0, 1, 3, 20], p2: [10, 12, 14, 22], hand: [0, 0], turn: 0 });
      expect(chooseAction(slide, d, { rng: mulberry(8), maxDepth: 2, timeMs: undefined })).toEqual({ type: 'move', from: 3, to: 2 });
    }
    expect(chooseAction(block, 'hard', { rng: mulberry(9), maxDepth: 4, timeMs: undefined })).toEqual({ type: 'place', to: 10 });
    expect(chooseAction(block, 'expert', { rng: mulberry(9), maxDepth: 4, timeMs: undefined })).toEqual({ type: 'place', to: 10 });
    expect(rate(openMill(), 'medium', completes)).toBeGreaterThan(0.8);
    expect(rate(block, 'medium', blocks)).toBeGreaterThan(0.8);
  });

  it('levels order: kids block least, then easy, then medium', () => {
    const s = makeState({ p1: [16, 20], p2: [8, 9], hand: [5, 5], turn: 0 });
    const blocks = (a: Action) => a.type === 'place' && a.to === 10;
    expect(rate(s, 'kids', blocks)).toBeLessThan(rate(s, 'easy', blocks));
    expect(rate(s, 'easy', blocks)).toBeLessThan(rate(s, 'medium', blocks));
  });

  it('knows five levels and migrates legacy names safely', () => {
    expect(DIFFICULTIES).toEqual(['kids', 'easy', 'medium', 'hard', 'expert']);
    expect(migrateDifficulty('expert')).toBe('expert');
    expect(migrateDifficulty('banana')).toBeNull();
    expect(migrateDifficulty(null)).toBeNull();
    expect(LEGACY_DIFFICULTY).toEqual({ easy: 'kids', medium: 'easy', hard: 'expert' });
  });

  it('completes a dhadi by sliding (moving phase)', () => {
    const s = makeState({ p1: [0, 1, 3, 20], p2: [10, 12, 14, 22], hand: [0, 0], turn: 0 });
    const a = chooseAction(s, 'expert', { timeMs: 300, rng: mulberry(3) });
    expect(a).toEqual({ type: 'move', from: 3, to: 2 });
  });

  it('chooses a sensible removal: breaks the opponent two-in-a-row threat', () => {
    // P1 just formed 0,1,2 and must remove. P2 has 8,9 (threat on 10) plus loose 20.
    let s = makeState({ p1: [0, 1], p2: [8, 9, 20], hand: [5, 4], turn: 0 });
    s = applyAction(s, { type: 'place', to: 2 });
    expect(s.phase).toBe('removing');
    const a = chooseAction(s, 'expert', { rng: mulberry(4), timeMs: 200 });
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
      const a: Action = chooseAction(s, plies % 2 ? 'kids' : 'easy', { rng, maxDepth: 2, timeMs: 200 });
      expect(isLegalAction(s, a)).toBe(true);
      s = applyAction(s, a);
      plies++;
    }
    expect(s.phase).toBe('gameover');
    expect(s.result).not.toBeNull();
    void legalActions;
  }, 60_000);
});
