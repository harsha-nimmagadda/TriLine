import type { Action, GameState } from '../engine/state';
import { Difficulty, chooseAction } from './index';
import type { AIRequest, AIResponse } from './worker';

/** Main-thread handle on the AI worker. Falls back to inline search if workers are unavailable. */
export class AIClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (a: Action) => void; reject: (e: Error) => void }>();
  private workerFailed = false;

  private ensureWorker(): Worker | null {
    if (this.workerFailed) return null;
    if (this.worker) return this.worker;
    try {
      const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<AIResponse>) => {
        const p = this.pending.get(e.data.id);
        if (!p) return;
        this.pending.delete(e.data.id);
        if (e.data.action) p.resolve(e.data.action);
        else p.reject(new Error(e.data.error ?? 'AI failed'));
      };
      w.onerror = () => {
        this.workerFailed = true;
        this.worker = null;
        for (const [, p] of this.pending) p.reject(new Error('AI worker crashed'));
        this.pending.clear();
      };
      this.worker = w;
      return w;
    } catch {
      this.workerFailed = true;
      return null;
    }
  }

  think(state: GameState, difficulty: Difficulty): Promise<Action> {
    const w = this.ensureWorker();
    if (!w) {
      return new Promise((resolve, reject) =>
        setTimeout(() => {
          try {
            resolve(chooseAction(state, difficulty));
          } catch (e) {
            reject(e as Error);
          }
        }, 0),
      );
    }
    const id = this.nextId++;
    return new Promise<Action>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const req: AIRequest = { id, state, difficulty };
      w.postMessage(req);
    });
  }

  /** Abort any running search (the worker is restarted on next use). */
  cancel(): void {
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }

  dispose(): void {
    this.cancel();
  }
}
