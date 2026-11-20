import { Action, GameState, Player, applyAction, createInitialState, endGame, isLegalAction, opponent } from '../engine';
import { MAX_CHAT_LENGTH, Message, PROTOCOL_VERSION, parseMessage } from './protocol';
import type { Transport } from './transport';

export type SessionStatus = 'waiting' | 'connected' | 'disconnected' | 'closed';
export type Role = 'host' | 'guest';

/** How long to wait for the opponent to come back before the game is awarded. */
export const RECONNECT_WINDOW_MS = 60_000;
/**
 * No message at all for this long means the link is dead. Pings go out about once a second, and the
 * peer answers from its message handler even when its timers are throttled. (If *our* timers were
 * suspended, `tick` gives the benefit of the doubt.) Normal disconnects are caught by the close event.
 */
export const DEAD_LINK_MS = 25_000;

export interface SessionEvents {
  /** A move/place/remove was applied (by me or by the opponent). */
  action: (action: Action, prev: GameState, next: GameState, byMe: boolean) => void;
  /** The whole state was replaced (config, sync, rematch, resignation, draw, abandonment). */
  state: (state: GameState) => void;
  status: (status: SessionStatus) => void;
  chat: (text: string) => void;
  system: (text: string) => void;
  drawOffer: () => void;
  /** Rematch / draw-offer flags changed. */
  flags: () => void;
  error: (text: string) => void;
  /** The host's theme id changed (guest side) - apply it. */
  theme: (id: string) => void;
}

export interface SessionOptions {
  role: Role;
  /** Host only. */
  pieces?: 9 | 11;
  /** Host only: the host's colour (0 = light, moves first). */
  hostColor?: Player;
  name?: string;
  /** Host only: id of the host's theme, shared with the guest. */
  themeId?: string;
  reconnectMs?: number;
  now?: () => number;
}

type Listeners = { [K in keyof SessionEvents]?: SessionEvents[K][] };

/**
 * Transport-agnostic online game logic. Both sides keep their own GameState and validate every
 * incoming action with the engine; the host is the authority when states drift.
 */
export class OnlineSession {
  readonly role: Role;
  pieces: 9 | 11;
  hostColor: Player | null;
  state: GameState;
  /** Number of actions applied in the current game (used to detect desync). */
  moveCount = 0;
  status: SessionStatus = 'waiting';
  /** Timestamp at which a disconnected game is awarded; null when not counting down. */
  disconnectDeadline: number | null = null;
  drawOfferedByMe = false;
  drawOfferedByThem = false;
  rematchMine = false;
  rematchTheirs = false;
  /** The host's theme id (host: own choice; guest: as announced by the host). */
  themeId: string | null;
  /** Guest: has received the host's config at least once. */
  configured: boolean;

  private transport: Transport | null = null;
  private listeners: Listeners = {};
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastRx = 0;
  private lastTick = 0;
  private everConnected = false;
  private readonly now: () => number;
  private readonly reconnectMs: number;
  private readonly name?: string;

  constructor(opts: SessionOptions) {
    this.role = opts.role;
    this.pieces = opts.pieces ?? 9;
    this.hostColor = opts.role === 'host' ? (opts.hostColor ?? 0) : null;
    this.state = createInitialState(this.pieces);
    this.configured = opts.role === 'host';
    this.themeId = opts.role === 'host' ? (opts.themeId ?? null) : null;
    this.now = opts.now ?? Date.now;
    this.reconnectMs = opts.reconnectMs ?? RECONNECT_WINDOW_MS;
    this.name = opts.name;
  }

  // ---- events ----------------------------------------------------------------------------

  on<K extends keyof SessionEvents>(type: K, fn: SessionEvents[K]): () => void {
    const list = (this.listeners[type] ??= []) as SessionEvents[K][];
    list.push(fn);
    return () => {
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    };
  }

  private emit<K extends keyof SessionEvents>(type: K, ...args: Parameters<SessionEvents[K]>): void {
    const list = this.listeners[type] as ((...a: Parameters<SessionEvents[K]>) => void)[] | undefined;
    if (list) for (const fn of [...list]) fn(...args);
  }

  // ---- derived -----------------------------------------------------------------------------

  /** My colour, or null while a guest is still waiting for the host's config. */
  get myColor(): Player | null {
    if (this.hostColor === null) return null;
    return this.role === 'host' ? this.hostColor : opponent(this.hostColor);
  }

  get active(): boolean {
    return this.state.phase !== 'gameover';
  }

  get isMyTurn(): boolean {
    return this.status === 'connected' && this.active && this.myColor === this.state.turn;
  }

  // ---- transport --------------------------------------------------------------------------

  /** Attach a (new) connection. Replaces any previous one, e.g. on reconnect. */
  attachTransport(t: Transport): void {
    if (this.status === 'closed') {
      t.close();
      return;
    }
    if (this.transport && this.transport !== t) {
      const old = this.transport;
      old.onMessage = null;
      old.onClose = null;
      old.close();
    }
    this.transport = t;
    this.lastRx = this.now();
    t.onMessage = (data) => {
      if (this.transport === t) this.receive(data);
    };
    t.onClose = () => {
      if (this.transport === t) this.handleClosed();
    };
    this.send({ t: 'hello', v: PROTOCOL_VERSION, name: this.name });
  }

  private send(msg: Message): void {
    try {
      this.transport?.send(msg);
    } catch {
      /* connection closing; the close handler will take over */
    }
  }

  private setStatus(s: SessionStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.emit('status', s);
  }

  private handleClosed(): void {
    this.transport = null;
    if (this.status === 'closed') return;
    if (!this.everConnected) {
      this.setStatus('waiting');
      return;
    }
    this.setStatus('disconnected');
    this.emit('system', this.role === 'host' ? 'Opponent disconnected.' : 'Connection to the host was lost.');
    if (this.active) {
      this.disconnectDeadline = this.now() + this.reconnectMs;
      this.timer = setTimeout(() => this.abandon(), this.reconnectMs);
    }
  }

  private abandon(): void {
    this.timer = null;
    this.disconnectDeadline = null;
    if (!this.active || this.myColor === null) return;
    this.state = endGame(this.state, { winner: this.myColor, reason: 'abandoned' });
    this.emit('system', 'The opponent did not return in time. The game has ended.');
    this.emit('state', this.state);
  }

  private markConnected(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.disconnectDeadline = null;
    const again = this.everConnected;
    this.everConnected = true;
    const was = this.status;
    this.setStatus('connected');
    if (was !== 'connected') this.emit('system', again ? 'Opponent reconnected.' : 'Opponent joined.');
  }

  /** Call periodically (e.g. every 5 s): sends a ping and drops a silent link. */
  tick(): void {
    if (!this.transport || this.status !== 'connected') return;
    const gap = this.now() - this.lastTick;
    this.lastTick = this.now();
    // If our own timers were suspended (sleeping laptop, background tab) we cannot judge the link.
    if (gap > 30_000) this.lastRx = this.now();
    if (this.now() - this.lastRx > DEAD_LINK_MS) {
      const t = this.transport;
      t.onMessage = null;
      t.onClose = null;
      t.close();
      this.handleClosed();
      return;
    }
    this.send({ t: 'ping', ts: this.now() });
  }

  close(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.disconnectDeadline = null;
    const t = this.transport;
    this.transport = null;
    if (t) {
      t.onMessage = null;
      t.onClose = null;
      t.close();
    }
    this.setStatus('closed');
  }

  // ---- receiving --------------------------------------------------------------------------

  private receive(raw: unknown): void {
    const msg = parseMessage(raw);
    if (!msg) return;
    this.lastRx = this.now();
    switch (msg.t) {
      case 'hello':
        if (msg.v !== PROTOCOL_VERSION) {
          this.emit('error', 'The other player is running a different version of the game.');
          this.close();
          return;
        }
        if (this.role === 'host') {
          this.sendConfig();
          this.markConnected();
        }
        return;
      case 'config':
        if (this.role !== 'guest') return;
        this.pieces = msg.pieces;
        this.hostColor = msg.hostColor;
        this.state = msg.state;
        this.moveCount = msg.n;
        this.configured = true;
        if (msg.theme) this.themeId = msg.theme;
        if (msg.n === 0) this.resetFlags();
        this.markConnected();
        this.emit('state', this.state);
        if (msg.theme) this.emit('theme', msg.theme);
        return;
      case 'theme':
        if (this.role === 'guest') {
          this.themeId = msg.id;
          this.emit('theme', msg.id);
        }
        return;
      case 'state-sync':
        if (this.role !== 'guest') return;
        this.state = msg.state;
        this.moveCount = msg.n;
        this.emit('state', this.state);
        return;
      case 'sync-request':
        if (this.role === 'host') this.send({ t: 'state-sync', state: this.state, n: this.moveCount });
        return;
      case 'action':
        this.receiveAction(msg.action, msg.n);
        return;
      case 'chat': {
        const text = msg.text.trim();
        if (text) this.emit('chat', text);
        return;
      }
      case 'draw-offer':
        if (!this.active) return;
        if (this.drawOfferedByMe) {
          this.agreeDraw(true);
          return;
        }
        this.drawOfferedByThem = true;
        this.emit('system', 'Opponent offers a draw.');
        this.emit('flags');
        this.emit('drawOffer');
        return;
      case 'draw-accept':
        if (this.active && this.drawOfferedByMe) this.agreeDraw(false);
        return;
      case 'draw-decline':
        if (this.drawOfferedByMe) {
          this.drawOfferedByMe = false;
          this.emit('system', 'Opponent declined the draw.');
          this.emit('flags');
        }
        return;
      case 'resign':
        if (this.active && this.myColor !== null) {
          this.state = endGame(this.state, { winner: this.myColor, reason: 'resign' });
          this.resetFlags();
          this.emit('system', 'Opponent resigned.');
          this.emit('state', this.state);
        }
        return;
      case 'rematch-request':
      case 'rematch-accept':
        if (this.active) return;
        this.rematchTheirs = true;
        this.emit('system', 'Opponent wants a rematch.');
        this.emit('flags');
        this.maybeStartRematch();
        return;
      case 'ping':
        this.send({ t: 'pong', ts: msg.ts });
        return;
      case 'pong':
        return;
    }
  }

  private receiveAction(action: Action, n: number): void {
    const opp = this.myColor === null ? null : opponent(this.myColor);
    const ok =
      this.status === 'connected' &&
      this.active &&
      n === this.moveCount &&
      opp !== null &&
      this.state.turn === opp &&
      isLegalAction(this.state, action);
    if (!ok) {
      // Ignore it; make sure we agree on the state.
      if (this.role === 'host') this.send({ t: 'state-sync', state: this.state, n: this.moveCount });
      else this.send({ t: 'sync-request' });
      return;
    }
    const prev = this.state;
    this.state = applyAction(prev, action);
    this.moveCount++;
    this.emit('action', action, prev, this.state, false);
  }

  private sendConfig(): void {
    if (this.hostColor === null) return;
    this.send({
      t: 'config',
      pieces: this.pieces,
      hostColor: this.hostColor,
      state: this.state,
      n: this.moveCount,
      ...(this.themeId ? { theme: this.themeId } : {}),
    });
  }

  private agreeDraw(iSentOffer: boolean): void {
    if (iSentOffer) this.send({ t: 'draw-accept' });
    this.state = endGame(this.state, { winner: null, reason: 'agreed' });
    this.resetFlags();
    this.emit('system', 'Draw agreed.');
    this.emit('state', this.state);
  }

  private resetFlags(): void {
    this.drawOfferedByMe = false;
    this.drawOfferedByThem = false;
    this.rematchMine = false;
    this.rematchTheirs = false;
    this.emit('flags');
  }

  private maybeStartRematch(): void {
    if (this.role !== 'host' || !this.rematchMine || !this.rematchTheirs) return;
    this.hostColor = opponent(this.hostColor ?? 0);
    this.state = createInitialState(this.pieces);
    this.moveCount = 0;
    this.resetFlags();
    this.sendConfig();
    this.emit('system', 'Rematch! Colours swapped.');
    this.emit('state', this.state);
  }

  // ---- local actions -------------------------------------------------------------------------

  /** Apply my own move and tell the opponent. Returns false if it is not allowed right now. */
  playLocal(action: Action): boolean {
    if (!this.isMyTurn || !isLegalAction(this.state, action)) return false;
    const prev = this.state;
    const n = this.moveCount;
    this.state = applyAction(prev, action);
    this.moveCount++;
    this.send({ t: 'action', action, n });
    this.emit('action', action, prev, this.state, true);
    return true;
  }

  /** Host: change the shared theme and tell the guest. */
  setTheme(id: string): void {
    if (this.role !== 'host' || this.themeId === id) return;
    this.themeId = id;
    this.send({ t: 'theme', id });
  }

  sendChat(text: string): boolean {
    const t = text.trim().slice(0, MAX_CHAT_LENGTH);
    if (!t || this.status !== 'connected') return false;
    this.send({ t: 'chat', text: t });
    return true;
  }

  offerDraw(): void {
    if (!this.active || this.status !== 'connected' || this.drawOfferedByMe) return;
    if (this.drawOfferedByThem) {
      this.respondDraw(true);
      return;
    }
    this.drawOfferedByMe = true;
    this.send({ t: 'draw-offer' });
    this.emit('system', 'You offered a draw.');
    this.emit('flags');
  }

  respondDraw(accept: boolean): void {
    if (!this.active || !this.drawOfferedByThem) return;
    this.drawOfferedByThem = false;
    if (accept) {
      this.agreeDraw(true);
    } else {
      this.send({ t: 'draw-decline' });
      this.emit('flags');
    }
  }

  resign(): void {
    if (!this.active || this.myColor === null) return;
    this.send({ t: 'resign' });
    this.state = endGame(this.state, { winner: opponent(this.myColor), reason: 'resign' });
    this.resetFlags();
    this.emit('state', this.state);
  }

  /** Ask for a rematch, or accept the opponent's request. */
  requestRematch(): void {
    if (this.active || this.status !== 'connected' || this.rematchMine) return;
    this.rematchMine = true;
    this.send({ t: this.rematchTheirs ? 'rematch-accept' : 'rematch-request' });
    this.emit('flags');
    this.maybeStartRematch();
  }
}
