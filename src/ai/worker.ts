import { Difficulty, chooseAction } from './index';
import type { Action, GameState } from '../engine/state';

export interface AIRequest {
  id: number;
  state: GameState;
  difficulty: Difficulty;
}
export interface AIResponse {
  id: number;
  action?: Action;
  error?: string;
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<AIRequest>) => void) | null;
  postMessage(msg: AIResponse): void;
};

ctx.onmessage = (e) => {
  const { id, state, difficulty } = e.data;
  try {
    ctx.postMessage({ id, action: chooseAction(state, difficulty) });
  } catch (err) {
    ctx.postMessage({ id, error: String(err) });
  }
};
