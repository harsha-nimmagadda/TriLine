import type { Difficulty } from '../ai';
import type { Player } from '../engine/state';

export interface GameConfig {
  mode: 'ai' | 'local' | 'online';
  pieces: 9 | 11;
  /** AI mode only. */
  difficulty: Difficulty;
  /** AI mode only: the side the human plays (0 = light, moves first). */
  human: Player;
}

export const DEFAULT_CONFIG: GameConfig = { mode: 'local', pieces: 9, difficulty: 'easy', human: 0 };
