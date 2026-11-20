import { Action, GameState } from '../engine/state';
import { HeuristicPolicy, heuristicAction } from './heuristic';
import { SearchOptions, searchBestAction } from './search';

export type Difficulty = 'kids' | 'easy' | 'medium' | 'hard' | 'expert';

export const DIFFICULTIES: readonly Difficulty[] = ['kids', 'easy', 'medium', 'hard', 'expert'];

/** Maps a persisted value (including the old 3-level names) to a valid level, or null if unknown. */
export function migrateDifficulty(value: unknown): Difficulty | null {
  if (typeof value !== 'string') return null;
  if ((DIFFICULTIES as readonly string[]).includes(value)) return value as Difficulty;
  return null;
}

/** Old 3-level names (easy/medium/hard) -> new levels, for values saved by older versions. */
export const LEGACY_DIFFICULTY: Record<string, Difficulty> = { easy: 'kids', medium: 'easy', hard: 'expert' };

interface LevelConfig {
  /** Chance of ignoring search entirely and playing the casual `slipPolicy` instead. */
  slip: number;
  slipPolicy: HeuristicPolicy;
  /** Search settings; omitted for the pure heuristic player. */
  search?: SearchOptions;
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  // For kids: no search. Completes an open dhadi about half the time, rarely blocks, otherwise random.
  kids: { slip: 1, slipPolicy: { complete: 0.5, block: 0.15, avoidSetups: 0.7 } },
  // New to the game: 2-ply search with some noise, but about 3 turns in 10 it plays casually and
  // misses blocks (it still usually completes a dhadi).
  easy: { slip: 0.3, slipPolicy: { complete: 0.9, block: 0 }, search: { maxDepth: 2, noise: 22 } },
  // Casual player: 2-ply search, a little noise, and about 1 turn in 8 it plays casually (weak blocks).
  medium: { slip: 0.1, slipPolicy: { complete: 1, block: 0.4 }, search: { maxDepth: 2, noise: 8 } },
  // Experienced: iterative deepening capped at depth 4 / ~450 ms, tiny noise, rare slips.
  hard: { slip: 0.04, slipPolicy: { complete: 1, block: 0.5 }, search: { maxDepth: 4, timeMs: 450, noise: 8 } },
  // Veteran: iterative deepening within ~1.5 s, never slips.
  expert: { slip: 0, slipPolicy: { complete: 1, block: 1 }, search: { maxDepth: 14, timeMs: 1500 } },
};

/** Pick the next action (place / move / remove) for the player to act in `state`. */
export function chooseAction(
  state: GameState,
  difficulty: Difficulty,
  overrides: Partial<SearchOptions> = {},
): Action {
  const level = LEVELS[difficulty];
  const rng = overrides.rng ?? Math.random;
  if (!level.search || (level.slip > 0 && rng() < level.slip)) {
    return heuristicAction(state, level.slipPolicy, rng);
  }
  return searchBestAction(state, { ...level.search, ...overrides, rng }).action;
}

export { searchBestAction } from './search';
export { evaluate } from './evaluate';
export { heuristicAction } from './heuristic';
