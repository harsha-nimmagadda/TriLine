import { DEFAULT_CONFIG } from '../game/config';
import { GameController } from '../game/controller';
import { OnlineSession } from '../net/session';
import { GuestLink, HostRoom, createHostRoom, NetError, PeerEndpoint, describeNetError } from '../net/peer';
import { MAX_CHAT_LENGTH } from '../net/protocol';
import { CODE_LENGTH, codeFromHash, normalizeCode, shareLink } from '../net/roomCode';
import { VoiceChat } from '../net/voice';
import { BoardView } from './boardView';
import { ChatPanel } from './chat';
import { closeDialogs, confirmDialog, menuDialog } from './dialog';
import { clear, h } from './dom';
import { Hud } from './hud';
import { openRules } from './rules';
import type { SoundManager } from './sound';
import type { Theme } from './themes/theme';
import type { ThemeManager } from './themes';
import { openThemePicker } from './themePicker';
import { segmented } from './widgets';

export interface FlowHost {
  swap(node: HTMLElement, cleanup?: () => void): void;
  home(): void;
  sound: SoundManager;
  /** The effective theme (live getter). */
  readonly theme: Theme;
  themes: ThemeManager;
}

const JOIN_TIMEOUT_MS = 12_000;

/** Screens and wiring for online play: menu, hosting lobby, joining, and the online game screen. */
export class OnlineFlow {
  constructor(private host: FlowHost) {}

  /** If the page was opened with #join=CODE, start joining. Returns true if handled. */
  handleHash(): boolean {
    const hash = window.location.hash;
    if (!/^#?join=/i.test(hash)) return false;
    const code = codeFromHash(hash);
    try {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      /* ignore */
    }
    if (code) void this.join(code);
    else this.showMenu('That invite link has an invalid game code. Ask your friend to send it again.');
    return true;
  }

  // ---- menu ------------------------------------------------------------------------------

  showMenu(error?: string, prefill = ''): void {
    const input = h('input', {
      class: 'code-input',
      attrs: {
        type: 'text',
        maxlength: String(CODE_LENGTH + 2),
        placeholder: 'ABC234',
        autocomplete: 'off',
        autocapitalize: 'characters',
        spellcheck: 'false',
        'aria-label': 'Game code',
      },
    });
    input.value = prefill;
    const errBox = h('div', { class: 'error-box', attrs: { role: 'alert', hidden: '' } });
    const showErr = (t: string) => {
      errBox.textContent = t;
      errBox.hidden = !t;
    };
    if (error) showErr(error);
    const doJoin = () => {
      const code = normalizeCode(input.value);
      if (!code) {
        showErr(`Enter the ${CODE_LENGTH}-character game code your friend shared (letters and numbers 2-9).`);
        return;
      }
      void this.join(code);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doJoin();
    });
    const screen = h(
      'section',
      { class: 'screen setup' },
      h('h2', { text: 'Play online' }),
      h('p', { class: 'tagline', text: 'Play a friend over the internet. No account needed.' }),
      errBox,
      h(
        'div',
        { class: 'menu' },
        h('button', { class: 'btn primary big', text: 'Create game', on: { click: () => this.showCreate() } }),
        h('div', { class: 'or', text: 'or join with a code' }),
        h('div', { class: 'join-row' }, input, h('button', { class: 'btn big', text: 'Join', on: { click: doJoin } })),
        h('button', { class: 'btn big ghost', text: 'Back', on: { click: () => this.host.home() } }),
      ),
    );
    this.host.swap(screen);
  }

  private showCreate(): void {
    const cfg = { pieces: DEFAULT_CONFIG.pieces as 9 | 11, color: 0 as 0 | 1 };
    const names = this.host.theme.sideNames;
    const screen = h(
      'section',
      { class: 'screen setup' },
      h('h2', { text: 'Create an online game' }),
      segmented<number>(
        'Pieces each',
        [
          { value: 9, text: '9', sub: 'classic' },
          { value: 11, text: '11', sub: 'longer game' },
        ],
        () => cfg.pieces,
        (v) => (cfg.pieces = v as 9 | 11),
      ),
      segmented<number>(
        'You play',
        [
          { value: 0, text: names[0], sub: 'moves first' },
          { value: 1, text: names[1], sub: 'moves second' },
        ],
        () => cfg.color,
        (v) => (cfg.color = v as 0 | 1),
      ),
      h(
        'div',
        { class: 'menu' },
        h('button', { class: 'btn primary big', text: 'Create game', on: { click: () => void this.hostGame(cfg.pieces, cfg.color) } }),
        h('button', { class: 'btn big ghost', text: 'Back', on: { click: () => this.showMenu() } }),
      ),
    );
    this.host.swap(screen);
  }

  private showError(title: string, message: string, retry?: () => void): void {
    const screen = h(
      'section',
      { class: 'screen setup' },
      h('h2', { text: title }),
      h('div', { class: 'error-box', text: message, attrs: { role: 'alert' } }),
      h(
        'div',
        { class: 'menu' },
        retry ? h('button', { class: 'btn primary big', text: 'Try again', on: { click: retry } }) : null,
        h('button', { class: 'btn big', text: 'Back', on: { click: () => this.showMenu() } }),
      ),
    );
    this.host.swap(screen);
  }

  // ---- host ------------------------------------------------------------------------------

  private async hostGame(pieces: 9 | 11, color: 0 | 1): Promise<void> {
    const session = new OnlineSession({ role: 'host', pieces, hostColor: color, themeId: this.host.themes.preference.id });
    const offTheme = this.host.themes.onChange(() => session.setTheme(this.host.themes.preference.id));
    session.on('status', (st) => st === 'closed' && offTheme());
    let room: HostRoom | null = null;
    let started = false;
    let cancelled = false;
    const cleanup = () => {
      cancelled = true;
      if (!started) {
        room?.destroy();
        session.close();
      }
    };
    // Leaving the "creating" screen before the room exists cancels creation; once it exists the
    // lobby screen takes over (its own cleanup above) so this must not tear the room down.
    const creatingCleanup = () => {
      if (!room) cleanup();
    };
    this.host.swap(
      h('section', { class: 'screen setup' }, h('h2', { text: 'Creating game…' }), h('p', { class: 'tagline', text: 'Contacting the matchmaking server.' }),
        h('div', { class: 'menu' }, h('button', { class: 'btn big ghost', text: 'Cancel', on: { click: () => this.showMenu() } }))),
      creatingCleanup,
    );
    try {
      room = await createHostRoom((t) => session.attachTransport(t));
    } catch (e) {
      if (cancelled) return;
      const kind = e instanceof NetError ? e.kind : 'failed';
      this.showError("Couldn't create the game", describeNetError(kind), () => void this.hostGame(pieces, color));
      return;
    }
    if (cancelled) {
      room.destroy();
      return;
    }
    const live = room;
    if (import.meta.env.DEV) (window as unknown as { __room?: HostRoom }).__room = live;
    const link = shareLink(live.code, window.location);
    const linkInput = h('input', { class: 'code-input link', attrs: { type: 'text', readonly: '', 'aria-label': 'Invite link', value: link } });
    const copyBtn = h('button', { class: 'btn', text: 'Copy link' });
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        linkInput.select();
        document.execCommand?.('copy');
      }
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy link'), 1800);
    });
    const shareBtn =
      typeof navigator.share === 'function'
        ? h('button', {
            class: 'btn',
            text: 'Share…',
            on: {
              click: () => {
                void navigator.share({ title: 'Pedda Dhadi', text: `Join my Pedda Dhadi game! Code: ${live.code}`, url: link }).catch(() => undefined);
              },
            },
          })
        : null;
    const screen = h(
      'section',
      { class: 'screen setup lobby' },
      h('h2', { text: 'Game created' }),
      h('p', { class: 'tagline', text: 'Send this code or link to your friend.' }),
      h('div', { class: 'code-display', text: live.code, attrs: { 'aria-label': `Game code ${live.code.split('').join(' ')}` } }),
      h('div', { class: 'share-row' }, linkInput),
      h('div', { class: 'share-row' }, copyBtn, shareBtn),
      h('div', { class: 'waiting' }, h('span', { class: 'spinner' }), 'Waiting for opponent…'),
      h('p', { class: 'tagline small', text: `You play ${this.host.theme.sideNames[color]}. Keep this page open.` }),
      h('div', { class: 'menu' }, h('button', { class: 'btn big ghost', text: 'Cancel', on: { click: () => this.showMenu() } })),
    );
    this.host.swap(screen, cleanup);
    session.on('error', (t) => {
      if (!started) this.showError('Connection problem', t);
    });
    session.on('status', (s) => {
      if (s === 'connected' && !started && !cancelled) {
        started = true;
        this.startGame(session, live, () => live.destroy());
      }
    });
  }

  // ---- guest -----------------------------------------------------------------------------

  async join(code: string): Promise<void> {
    const session = new OnlineSession({ role: 'guest' });
    const link = new GuestLink(code, { onTransport: (t) => session.attachTransport(t) });
    let started = false;
    let cancelled = false;
    this.host.swap(
      h(
        'section',
        { class: 'screen setup' },
        h('h2', { text: `Joining ${code}…` }),
        h('div', { class: 'waiting' }, h('span', { class: 'spinner' }), 'Connecting to the host…'),
        h('div', { class: 'menu' }, h('button', { class: 'btn big ghost', text: 'Cancel', on: { click: () => this.showMenu('', code) } })),
      ),
      () => {
        cancelled = true;
        if (!started) {
          link.stop();
          session.close();
        }
      },
    );
    const fail = (title: string, msg: string) => {
      if (cancelled || started) return;
      link.stop();
      session.close();
      this.showError(title, msg, () => void this.join(code));
    };
    session.on('error', (t) => fail('Connection problem', t));
    session.on('state', () => {
      if (!started && !cancelled && session.configured) {
        started = true;
        this.startGame(session, link, () => link.stop());
      }
    });
    try {
      await link.connect();
    } catch (e) {
      fail("Couldn't join the game", describeNetError(e instanceof NetError ? e.kind : 'failed'));
      return;
    }
    setTimeout(() => {
      if (!started && !cancelled) fail("Couldn't join the game", 'The host did not respond. Make sure they still have the game open, then try again.');
    }, JOIN_TIMEOUT_MS);
  }

  // ---- game ------------------------------------------------------------------------------

  private startGame(session: OnlineSession, endpoint: PeerEndpoint, teardown: () => void): void {
    const themes = this.host.themes;
    // The host's theme is used by both players: a guest follows it and gets its own back on leaving.
    if (session.role === 'guest' && session.themeId) themes.setOverride(session.themeId);
    const sound = this.host.sound;
    let controller!: GameController;
    let voice!: VoiceChat;
    const overlayHost = h('div', { class: 'overlay-host' });
    let overShown = false;

    const board = new BoardView(themes.current, (p) => controller.handleTap(p));

    const panel: ChatPanel = new ChatPanel({
      onSend: (t) => session.sendChat(t.slice(0, MAX_CHAT_LENGTH)),
      onUnreadChange: (n) => hud.setChatBadge(n),
      voice: {
        supported: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
        onStart: () => void voice.start(),
        onToggleMute: () => {
          voice.setMuted(!voice.muted);
          panel.setVoiceState(voice.state, voice.muted);
        },
        onHangUp: () => voice.hangUp(),
      },
    });

    const leave = async () => {
      if (session.active && session.status === 'connected') {
        const ok = await confirmDialog({
          title: 'Leave this game?',
          text: 'Leaving counts as resigning.',
          ok: 'Leave game',
          cancel: 'Stay',
          danger: true,
        });
        if (!ok) return;
        session.resign();
        setTimeout(() => this.host.home(), 150);
      } else {
        this.host.home();
      }
    };

    const hud: Hud = new Hud(themes.current, {
      onUndo: () => undefined,
      onRules: () => openRules(),
      onMenu: () =>
        void menuDialog('Menu', [
          { label: session.role === 'host' ? 'Change theme' : 'Theme', onClick: () => openThemePicker(themes) },
          { label: 'Leave game', danger: true, onClick: () => void leave() },
        ]),
      onResign: async () => {
        const ok = await confirmDialog({ title: 'Resign this game?', text: 'Your opponent will win.', ok: 'Resign', cancel: 'Keep playing', danger: true });
        if (ok) session.resign();
      },
      onDraw: () => {
        if (!session.active) {
          overShown = true;
          renderOver();
        } else session.offerDraw();
      },
      onChat: () => panel.toggle(),
    });

    const renderOver = () => {
      if (!overShown) return;
      const r = session.state.result;
      if (!r) return;
      const kind = r.winner === null ? 'draw' : r.winner === session.myColor ? 'win' : 'lose';
      let label = 'Rematch';
      let disabled = false;
      let note = 'Colours swap for the next game.';
      if (session.status !== 'connected') {
        disabled = true;
        note = 'Your opponent has left, so a rematch is not possible.';
      } else if (session.rematchMine) {
        label = 'Waiting for opponent…';
        disabled = true;
        note = '';
      } else if (session.rematchTheirs) {
        label = 'Accept rematch';
        note = 'Your opponent wants a rematch!';
      }
      const rematch = h('button', { class: 'btn primary big', text: label, on: { click: () => session.requestRematch() } });
      rematch.disabled = disabled;
      const card = h(
        'div',
        { class: `modal over ${kind}`, attrs: { role: 'dialog', 'aria-modal': 'true' } },
        h('h2', { text: controller.resultText() }),
        h('p', { text: controller.resultDetail() }),
        note ? h('p', { class: 'note', text: note }) : null,
        h(
          'div',
          { class: 'menu' },
          rematch,
          h('button', { class: 'btn big', text: 'Home', on: { click: () => this.host.home() } }),
          h('button', {
            class: 'btn big ghost',
            text: 'View board',
            on: {
              click: () => {
                overShown = false;
                clear(overlayHost);
              },
            },
          }),
        ),
      );
      clear(overlayHost);
      overlayHost.append(h('div', { class: 'backdrop' }, card));
    };

    controller = new GameController(
      { ...DEFAULT_CONFIG, mode: 'online', pieces: session.pieces },
      {
        board,
        hud,
        sound,
        session,
        sideNames: () => themes.current.sideNames,
        onGameOver: () => {
          closeDialogs();
          overShown = true;
          renderOver();
        },
        onGameResumed: () => {
          overShown = false;
          clear(overlayHost);
        },
        onOnlineChange: renderOver,
      },
    );

    voice = new VoiceChat(endpoint, {
      state: (s) => panel.setVoiceState(s, voice.muted),
      incoming: (accept, decline) => {
        panel.addMessage('system', 'Opponent started voice chat.');
        void confirmDialog({
          title: 'Opponent started voice',
          text: 'Join voice chat? Your browser will ask for microphone access.',
          ok: 'Join voice',
          cancel: 'Not now',
        }).then((ok) => (ok ? accept() : decline()));
      },
      stats: (st) => panel.setVoiceStats(st),
      message: (t) => {
        panel.setVoiceNote(t);
        panel.addMessage('system', t);
      },
    });

    const chip = () => {
      const s = session.status;
      if (s === 'connected') panel.setStatus('Connected', 'ok');
      else if (s === 'waiting') panel.setStatus('Waiting for opponent', 'warn');
      else panel.setStatus(session.role === 'host' ? 'Opponent disconnected' : 'Disconnected', 'bad');
    };
    chip();
    const unsubs = [
      themes.onChange((t) => {
        board.setTheme(t);
        hud.setTheme(t);
        controller.refresh();
        renderOver();
        if (session.role === 'host') session.setTheme(themes.preference.id);
      }),
      session.on('theme', (id) => themes.setOverride(id)),
      session.on('chat', (t) => {
        panel.addMessage('them', t);
        sound.play('place');
      }),
      session.on('system', (t) => panel.addMessage('system', t)),
      session.on('status', () => {
        chip();
        renderOver();
        if (session.status !== 'connected') voice.hangUp();
      }),
      session.on('drawOffer', () => {
        void confirmDialog({ title: 'Opponent offers a draw', text: 'Do you accept?', ok: 'Accept draw', cancel: 'Decline' }).then((ok) => session.respondDraw(ok));
      }),
      session.on('error', (t) => {
        panel.addMessage('system', t);
      }),
    ];

    const screen = h(
      'section',
      { class: 'screen game online' },
      h('div', { class: 'game-main' }, hud.top, h('div', { class: 'board-wrap' }, board.el), hud.bottom),
      panel.el,
      overlayHost,
    );
    // Closing the tab: tell the peer right away instead of waiting for ICE to time out.
    const onHide = () => session.close();
    window.addEventListener('pagehide', onHide);
    this.host.swap(screen, () => {
      window.removeEventListener('pagehide', onHide);
      if (session.role === 'guest') themes.setOverride(null);
      for (const u of unsubs) u();
      closeDialogs();
      controller.dispose();
      voice.dispose();
      session.close();
      teardown();
      board.destroy();
    });
    panel.addMessage('system', `You are playing ${themes.current.sideNames[session.myColor ?? 0]}.`);
    controller.start();
  }
}
