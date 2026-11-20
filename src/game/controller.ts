import { AIClient } from '../ai/client';
import {
  Action,
  GameState,
  Player,
  applyAction,
  capturablePoints,
  createInitialState,
  legalActions,
  moveTargets,
  opponent,
} from '../engine';
import type { OnlineSession } from '../net/session';
import type { BoardView, Overlay } from '../ui/boardView';
import type { Hud, HudModel, PlayerLabel } from '../ui/hud';
import type { SoundManager } from '../ui/sound';
import type { GameConfig } from './config';

/** Minimum time the AI "thinks" so replies never feel instant. */
export const AI_MIN_DELAY_MS = 450;
/** Delay before the game-over overlay so the final capture animation can play. */
const GAME_OVER_DELAY_MS = 900;

export interface ControllerDeps {
  board: BoardView;
  hud: Hud;
  sound: SoundManager;
  /** vs-AI mode. */
  ai?: AIClient;
  /** Online mode. */
  session?: OnlineSession;
  /** Display names of the two sides: [player 1, player 2]. */
  sideNames: readonly [string, string];
  onGameOver(state: GameState, humanWon: boolean | null): void;
  /** Called when a previously shown game-over overlay should go away (undo / rematch). */
  onGameResumed(): void;
  /** Called whenever the online overlay should re-render (rematch flags changed). */
  onOnlineChange?(): void;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Ties the pure engine to the board view, HUD, sound and (optionally) the AI or an online session. */
export class GameController {
  state: GameState;
  private selected: number | null = null;
  private thinking = false;
  private epoch = 0;
  private disposed = false;
  /** vs-AI only: states at the start of each human turn (for undo). */
  private snapshots: GameState[] = [];
  private overTimer: number | null = null;
  private hint: string | null = null;
  private hintTimer: number | null = null;
  private unsubs: (() => void)[] = [];
  private tickTimer: number | null = null;

  constructor(
    private config: GameConfig,
    private deps: ControllerDeps,
  ) {
    this.state = deps.session ? deps.session.state : createInitialState(config.pieces);
  }

  private get isAI(): boolean {
    return this.config.mode === 'ai';
  }
  private get isOnline(): boolean {
    return this.config.mode === 'online' && !!this.deps.session;
  }
  /** The side controlled by the person at this screen (vs-AI and online). */
  private get human(): Player {
    if (this.isOnline) return this.deps.session!.myColor ?? 0;
    return this.config.human;
  }
  private get aiPlayer(): Player {
    return opponent(this.config.human);
  }
  private isAITurn(s: GameState = this.state): boolean {
    return this.isAI && s.phase !== 'gameover' && s.turn === this.aiPlayer;
  }
  /** May the local person tap the board right now? */
  private canAct(): boolean {
    if (this.disposed || this.state.phase === 'gameover') return false;
    if (this.isOnline) return this.deps.session!.isMyTurn;
    return !this.thinking && !this.isAITurn();
  }

  labels(): [PlayerLabel, PlayerLabel] {
    const sides = this.deps.sideNames;
    if (this.config.mode === 'local') {
      return [
        { name: 'Player 1', side: sides[0] },
        { name: 'Player 2', side: sides[1] },
      ];
    }
    const other = this.isAI ? 'Computer' : 'Opponent';
    const me = this.human;
    return [
      { name: me === 0 ? 'You' : other, side: sides[0] },
      { name: me === 1 ? 'You' : other, side: sides[1] },
    ];
  }

  start(): void {
    const session = this.deps.session;
    if (this.isOnline && session) {
      this.state = session.state;
      this.unsubs.push(
        session.on('action', (a, prev, next, byMe) => this.present(prev, a, next, byMe ? this.human : opponent(this.human))),
        session.on('state', (s) => this.onSessionState(s)),
        session.on('status', () => this.refresh()),
        session.on('flags', () => {
          this.deps.onOnlineChange?.();
          this.refresh();
        }),
      );
      // Re-render the countdown while waiting for a reconnect.
      this.tickTimer = window.setInterval(() => {
        if (session.status === 'disconnected') this.refresh();
        session.tick();
      }, 1000);
      if (this.state.phase === 'gameover') this.scheduleFinish(300);
    }
    this.deps.board.reset(this.state);
    this.recordSnapshot();
    this.refresh();
    this.maybeRunAI();
  }

  dispose(): void {
    this.disposed = true;
    this.epoch++;
    for (const u of this.unsubs) u();
    this.unsubs = [];
    if (this.tickTimer !== null) clearInterval(this.tickTimer);
    if (this.overTimer !== null) clearTimeout(this.overTimer);
    if (this.hintTimer !== null) clearTimeout(this.hintTimer);
    this.deps.ai?.cancel();
  }

  // ---- input -------------------------------------------------------------------------

  handleTap(point: number): void {
    const s = this.state;
    if (!this.canAct()) return;
    this.clearHint();
    const me = s.turn;

    if (s.phase === 'removing') {
      if (capturablePoints(s.board, opponent(me)).includes(point)) this.apply({ type: 'remove', at: point });
      return;
    }
    if (s.phase === 'placing') {
      if (s.board[point] === -1) this.apply({ type: 'place', to: point });
      return;
    }
    // moving
    if (s.board[point] === me) {
      if (this.selected === point) this.selected = null;
      else if (moveTargets(s.board, point).length > 0) this.selected = point;
      else {
        this.selected = null;
        this.setHint('That piece is blocked. Pick another.');
        return;
      }
      this.refresh();
      return;
    }
    if (this.selected !== null && moveTargets(s.board, this.selected).includes(point)) {
      this.apply({ type: 'move', from: this.selected, to: point });
      return;
    }
    if (this.selected !== null) {
      this.selected = null;
      this.refresh();
    }
  }

  // ---- undo --------------------------------------------------------------------------

  canUndo(): boolean {
    if (!this.isAI || this.thinking || this.disposed) return false;
    const top = this.snapshots[this.snapshots.length - 1];
    if (!top) return false;
    return this.state !== top || this.snapshots.length > 1;
  }

  undo(): void {
    if (!this.canUndo()) return;
    const wasOver = this.state.phase === 'gameover';
    const top = this.snapshots[this.snapshots.length - 1];
    if (this.state !== top) {
      this.state = top; // abandon the partial current turn (or a finished game)
    } else {
      this.snapshots.pop();
      this.state = this.snapshots[this.snapshots.length - 1];
    }
    this.epoch++;
    this.selected = null;
    if (this.overTimer !== null) {
      clearTimeout(this.overTimer);
      this.overTimer = null;
    }
    this.deps.board.reset(this.state);
    if (wasOver) this.deps.onGameResumed();
    this.refresh();
  }

  // ---- internals ---------------------------------------------------------------------

  private recordSnapshot(): void {
    if (!this.isAI) return;
    const s = this.state;
    if (s.phase !== 'gameover' && s.phase !== 'removing' && s.turn === this.config.human) {
      this.snapshots.push(s);
    }
  }

  /** Perform an action chosen by the local person or the AI. */
  private apply(action: Action): void {
    if (this.isOnline) {
      // The session applies it and reports back through its 'action' event.
      this.deps.session!.playLocal(action);
      return;
    }
    const prev = this.state;
    const next = applyAction(prev, action);
    this.present(prev, action, next, prev.turn);
  }

  /** Show the result of an action that has already been applied to the game state. */
  private present(_prev: GameState, action: Action, next: GameState, mover: Player): void {
    this.state = next;
    this.selected = null;
    this.deps.board.animate(action, next, mover);

    const sound = this.deps.sound;
    if (action.type === 'place') sound.play('place');
    else if (action.type === 'move') sound.play('slide');
    else sound.play('capture');
    if (next.formed.length > 0 && action.type !== 'remove') window.setTimeout(() => sound.play('dhadi'), 120);

    this.recordSnapshot();
    this.refresh();

    if (next.phase === 'gameover') {
      this.scheduleFinish(GAME_OVER_DELAY_MS);
    } else {
      this.maybeRunAI();
    }
  }

  /** The online session replaced the state wholesale (sync, rematch, resign, draw, abandonment). */
  private onSessionState(s: GameState): void {
    this.state = s;
    this.selected = null;
    this.deps.board.reset(s);
    if (s.phase === 'gameover') {
      this.scheduleFinish(400);
    } else {
      if (this.overTimer !== null) {
        clearTimeout(this.overTimer);
        this.overTimer = null;
      }
      this.deps.onGameResumed();
    }
    this.refresh();
  }

  private scheduleFinish(ms: number): void {
    if (this.overTimer !== null) clearTimeout(this.overTimer);
    this.overTimer = window.setTimeout(() => this.finish(), ms);
  }

  private finish(): void {
    this.overTimer = null;
    if (this.disposed) return;
    const r = this.state.result;
    let humanWon: boolean | null = null;
    if (r && r.winner !== null) humanWon = this.config.mode === 'local' ? true : r.winner === this.human;
    const sound = this.deps.sound;
    if (!r || r.winner === null) sound.play('draw');
    else if (humanWon === false) sound.play('lose');
    else sound.play('win');
    this.deps.onGameOver(this.state, humanWon);
  }

  private maybeRunAI(): void {
    if (this.disposed || !this.isAITurn()) return;
    void this.runAI();
  }

  private async runAI(): Promise<void> {
    const ai = this.deps.ai;
    if (!ai) return;
    const my = ++this.epoch;
    const stateAtStart = this.state;
    this.thinking = true;
    this.refresh();
    let action: Action;
    try {
      [action] = await Promise.all([ai.think(stateAtStart, this.config.difficulty), sleep(AI_MIN_DELAY_MS)]);
    } catch {
      await sleep(AI_MIN_DELAY_MS);
      const acts = legalActions(stateAtStart);
      action = acts[Math.floor(Math.random() * acts.length)];
    }
    if (my !== this.epoch || this.disposed) return;
    this.thinking = false;
    this.apply(action);
  }

  private setHint(text: string): void {
    this.hint = text;
    if (this.hintTimer !== null) clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => {
      this.hint = null;
      this.hintTimer = null;
      this.refresh();
    }, 2200);
    this.refresh();
  }
  private clearHint(): void {
    this.hint = null;
  }

  private overlay(): Overlay {
    const s = this.state;
    if (!this.canAct()) return { selected: null, targets: [], capturable: [] };
    if (s.phase === 'removing') {
      return { selected: null, targets: [], capturable: capturablePoints(s.board, opponent(s.turn)) };
    }
    if (s.phase === 'placing') {
      const targets = legalActions(s).map((a) => (a.type === 'place' ? a.to : -1)).filter((x) => x >= 0);
      return { selected: null, targets, capturable: [] };
    }
    const targets = this.selected !== null ? moveTargets(s.board, this.selected) : [];
    return { selected: this.selected, targets, capturable: [] };
  }

  private movablePieces(): number[] {
    const s = this.state;
    if (s.phase !== 'moving' || !this.canAct()) return [];
    const out: number[] = [];
    for (let i = 0; i < s.board.length; i++) {
      if (s.board[i] === s.turn && moveTargets(s.board, i).length > 0) out.push(i);
    }
    return out;
  }

  statusText(): { text: string; kind: HudModel['statusKind'] } {
    const s = this.state;
    const l = this.labels();
    if (s.phase === 'gameover') return { text: this.resultText(), kind: 'over' };

    if (this.isOnline) {
      const sess = this.deps.session!;
      if (sess.status === 'disconnected' || sess.status === 'closed') {
        const left = sess.disconnectDeadline === null ? null : Math.max(0, Math.ceil((sess.disconnectDeadline - Date.now()) / 1000));
        const base = sess.role === 'host' ? 'Opponent disconnected. Waiting for them to reconnect…' : 'Connection lost. Trying to reconnect…';
        return { text: left === null ? base : `${base} ${left}s`, kind: 'wait' };
      }
      if (sess.status === 'waiting') return { text: 'Waiting for opponent…', kind: 'wait' };
      if (s.turn !== this.human) {
        return { text: s.phase === 'removing' ? 'Opponent is removing a piece…' : "Opponent's turn…", kind: 'wait' };
      }
    } else if (this.isAI && s.turn === this.aiPlayer) {
      return { text: s.phase === 'removing' ? 'Computer takes a piece…' : 'Computer is thinking…', kind: 'wait' };
    }

    if (this.hint) return { text: this.hint, kind: 'normal' };
    const vsOne = this.config.mode !== 'local';
    const who = vsOne ? 'Your turn' : l[s.turn].side;
    switch (s.phase) {
      case 'placing':
        return { text: `${who}: place a piece`, kind: 'normal' };
      case 'removing':
        return { text: vsOne ? 'Dhadi! Remove an opponent piece' : `Dhadi! ${who}: remove an opponent piece`, kind: 'capture' };
      default:
        return {
          text: this.selected === null ? `${who}: pick a piece to move` : `${who}: tap a highlighted point`,
          kind: 'normal',
        };
    }
  }

  resultText(): string {
    const r = this.state.result;
    if (!r) return '';
    if (r.winner === null) {
      return r.reason === 'fifty'
        ? 'Draw: 50 moves without a capture'
        : r.reason === 'agreed'
          ? 'Draw agreed'
          : 'Draw: same position three times';
    }
    if (this.config.mode === 'local') return `${this.deps.sideNames[r.winner]} win!`;
    if (r.winner === this.human) return 'You win!';
    return this.isAI ? 'Computer wins' : 'Opponent wins';
  }

  resultDetail(): string {
    const r = this.state.result;
    if (!r) return '';
    if (r.winner === null) {
      if (r.reason === 'agreed') return 'Both players agreed to a draw.';
      return r.reason === 'fifty'
        ? 'Fifty moves passed in the moving phase with no capture.'
        : 'The same position (with the same side to move) occurred three times.';
    }
    const loser = opponent(r.winner);
    const local = this.config.mode === 'local';
    const youLost = !local && loser === this.human;
    const other = this.isAI ? 'The computer' : 'Your opponent';
    const name = local ? `${this.deps.sideNames[loser]} have` : youLost ? 'You have' : `${other} has`;
    switch (r.reason) {
      case 'pieces':
        return `${name} fewer than 3 pieces left.`;
      case 'blocked':
        return `${name} no legal move.`;
      case 'resign':
        return youLost ? 'You resigned.' : `${other} resigned.`;
      case 'abandoned':
        return 'Your opponent left and did not return within 60 seconds.';
    }
  }

  refresh(): void {
    if (this.disposed) return;
    const { text, kind } = this.statusText();
    this.deps.board.setOverlay(this.overlay());
    this.deps.board.setMovable(this.movablePieces());
    const sess = this.deps.session;
    this.deps.hud.update({
      state: this.state,
      labels: this.labels(),
      status: text,
      statusKind: kind,
      showUndo: this.isAI,
      undoEnabled: this.canUndo(),
      online: this.isOnline && sess
        ? { active: this.state.phase !== 'gameover', connected: sess.status === 'connected', drawPending: sess.drawOfferedByMe }
        : undefined,
    });
  }
}
