import { Action, GameState } from '../engine/state';
import { SearchOptions, searchBestAction } from './search';

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const DIFFICULTY_OPTIONS: Record<Difficulty, SearchOptions> = {
  // Shallow search plus noisy root choice: takes obvious captures, misses traps.
  easy: { maxDepth: 2, noise: 45 },
  // Fixed depth ~4 (time cap only as a safety net).
  medium: { maxDepth: 4, timeMs: 4000 },
  // Iterative deepening within a ~1.5 s budget.
  hard: { maxDepth: 14, timeMs: 1500 },
};

/** Pick the next action (place / move / remove) for the player to act in `state`. */
export function chooseAction(
  state: GameState,
  difficulty: Difficulty,
  overrides: Partial<SearchOptions> = {},
): Action {
  return searchBestAction(state, { ...DIFFICULTY_OPTIONS[difficulty], ...overrides }).action;
}

export { searchBestAction } from './search';
export { evaluate } from './evaluate';
