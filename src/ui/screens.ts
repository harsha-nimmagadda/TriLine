import { AIClient } from '../ai/client';
import { DIFFICULTIES, Difficulty } from '../ai';
import { DEFAULT_CONFIG, GameConfig } from '../game/config';
import { GameController } from '../game/controller';
import { BoardView } from './boardView';
import { clear, h, svgEl, svgFragment } from './dom';
import { segmented } from './widgets';
import { Hud } from './hud';
import { openRules } from './rules';
import { SoundManager } from './sound';
import { ThemeManager, Theme, applyTheme } from './themes';
import { ModalHandle, menuDialog, openModal } from './dialog';
import { openThemePicker } from './themePicker';
import { readStore, writeStore } from './storage';
import { OnlineFlow } from './online';

const DIFF_LABEL: Record<Difficulty, { text: string; sub: string }> = {
  kids: { text: 'Kids', sub: 'For kids' },
  easy: { text: 'Easy', sub: 'New to the game' },
  medium: { text: 'Medium', sub: 'Casual player' },
  hard: { text: 'Hard', sub: 'Experienced' },
  expert: { text: 'Expert', sub: 'Veteran' },
};

/** Owns the screen stack: home, setup, game. */
export class App {
  private main: HTMLElement;
  private muteBtn: HTMLButtonElement;
  private sound = new SoundManager();
  readonly themes = new ThemeManager({ get: readStore, set: writeStore });
  private cleanup: (() => void) | null = null;
  /** Re-renders the current non-game screen when the theme changes (null on game screens). */
  private rerender: (() => void) | null = null;
  private lastConfig: GameConfig = { ...DEFAULT_CONFIG };
  private online: OnlineFlow;

  private get theme(): Theme {
    return this.themes.current;
  }

  constructor(root: HTMLElement) {
    const app = this;
    this.online = new OnlineFlow({
      swap: (n, c) => this.swap(n, c),
      home: () => this.showHome(),
      sound: this.sound,
      themes: this.themes,
      get theme(): Theme {
        return app.themes.current;
      },
    });
    applyTheme(this.themes.current);
    this.themes.onChange((t) => {
      const el = document.documentElement;
      el.classList.add('theme-switching');
      applyTheme(t);
      window.setTimeout(() => el.classList.remove('theme-switching'), 450);
      this.rerender?.();
    });
    this.muteBtn = h('button', {
      class: 'icon-btn',
      attrs: { 'aria-label': 'Toggle sound' },
      on: {
        click: () => {
          this.sound.toggle();
          this.renderMute();
        },
      },
    });
    this.main = h('main', { class: 'screen-host' });
    root.append(
      h(
        'header',
        { class: 'topbar' },
        h('div', { class: 'brand', text: 'Pedda Dhadi' }),
        h(
          'div',
          { class: 'topbar-actions' },
          h('button', { class: 'icon-btn', text: '🎨', attrs: { 'aria-label': 'Choose theme', title: 'Theme' }, on: { click: () => openThemePicker(this.themes) } }),
          h('button', { class: 'icon-btn', text: '?', attrs: { 'aria-label': 'How to play' }, on: { click: () => openRules() } }),
          this.muteBtn,
        ),
      ),
      this.main,
    );
    this.renderMute();
    if (!this.online.handleHash()) this.showHome();
  }

  private renderMute(): void {
    this.muteBtn.textContent = this.sound.muted ? '🔇' : '🔊';
    this.muteBtn.setAttribute('aria-pressed', String(this.sound.muted));
    this.muteBtn.title = this.sound.muted ? 'Sound off' : 'Sound on';
  }

  private swap(node: HTMLElement, cleanup?: () => void): void {
    this.cleanup?.();
    this.cleanup = cleanup ?? null;
    this.rerender = null;
    clear(this.main);
    this.main.append(node);
  }

  // ---- home ----------------------------------------------------------------------------

  showHome(): void {
    const render = () => this.showHome();
    const emblem = svgEl('svg', { viewBox: '0 0 120 120', class: 'emblem', 'aria-hidden': 'true' });
    for (const n of svgFragment(`
      <g fill="none" stroke="${this.theme.lines.stroke}" stroke-width="3" stroke-linecap="round">
        <rect x="10" y="10" width="100" height="100"/><rect x="34" y="34" width="52" height="52" transform="translate(0 0)"/>
        <rect x="22" y="22" width="76" height="76"/>
        <path d="M60 10V22M60 98V110M10 60H22M98 60H110M60 22V34M60 86V98M22 60H34M86 60H98"/>
      </g>`)) emblem.append(n);
    const piece = (p: 0 | 1, x: number, y: number) => {
      const g = svgEl('g', { transform: `translate(${x} ${y})` });
      for (const n of svgFragment(this.theme.piece(p, 9))) g.append(n);
      return g;
    };
    emblem.append(piece(0, 60, 10), piece(0, 22, 22), piece(1, 98, 60), piece(1, 60, 98), piece(0, 34, 60));

    const screen = h(
      'section',
      { class: 'screen home' },
      h('div', { class: 'emblem-wrap' }, emblem),
      h('h1', { text: 'Pedda Dhadi' }),
      h('p', { class: 'tagline', text: 'The classic Telugu game of three-in-a-row. Make a dhadi, capture a piece.' }),
      h(
        'div',
        { class: 'menu' },
        h('button', { class: 'btn primary big', text: 'Play vs Computer', on: { click: () => this.showSetup('ai') } }),
        h('button', { class: 'btn big', text: 'Two players on this device', on: { click: () => this.showSetup('local') } }),
        h('button', { class: 'btn big', text: 'Play online', on: { click: () => this.online.showMenu() } }),
        h('button', { class: 'btn big ghost', text: 'Theme: ' + this.theme.name, on: { click: () => openThemePicker(this.themes) } }),
        h('button', { class: 'btn big ghost', text: 'How to play', on: { click: () => openRules() } }),
      ),
    );
    this.swap(screen);
    this.rerender = render;
  }

  // ---- setup ---------------------------------------------------------------------------

  showSetup(mode: 'ai' | 'local', existing?: GameConfig): void {
    const cfg: GameConfig = existing ?? { ...this.lastConfig, mode };

    const fields: HTMLElement[] = [
      segmented<number>(
        'Pieces each',
        [
          { value: 9, text: '9', sub: 'classic' },
          { value: 11, text: '11', sub: 'longer game' },
        ],
        () => cfg.pieces,
        (v) => (cfg.pieces = v as 9 | 11),
      ),
    ];
    if (mode === 'ai') {
      fields.push(
        segmented<Difficulty>(
          'Difficulty',
          DIFFICULTIES.map((d) => ({ value: d, text: DIFF_LABEL[d].text, sub: DIFF_LABEL[d].sub })),
          () => cfg.difficulty,
          (v) => (cfg.difficulty = v),
          true,
        ),
        segmented<number>(
          'You play',
          [
            { value: 0, text: this.theme.sideNames[0], sub: 'moves first' },
            { value: 1, text: this.theme.sideNames[1], sub: 'moves second' },
          ],
          () => cfg.human,
          (v) => (cfg.human = v as 0 | 1),
        ),
      );
    }

    const screen = h(
      'section',
      { class: 'screen setup' },
      h('h2', { text: mode === 'ai' ? 'Play vs Computer' : 'Two players, one device' }),
      ...fields,
      h(
        'div',
        { class: 'menu' },
        h('button', { class: 'btn primary big', text: 'Start game', on: { click: () => this.startGame(cfg) } }),
        h('button', { class: 'btn big ghost', text: 'Back', on: { click: () => this.showHome() } }),
      ),
    );
    this.swap(screen);
    this.rerender = () => this.showSetup(mode, cfg);
  }

  // ---- game ----------------------------------------------------------------------------

  startGame(config: GameConfig): void {
    this.lastConfig = { ...config };
    const themes = this.themes;
    let controller: GameController;
    const ai = new AIClient();
    const board = new BoardView(themes.current, (p) => controller.handleTap(p));
    let overModal: ModalHandle | null = null;
    const hud = new Hud(themes.current, {
      onUndo: () => controller.undo(),
      onRules: () => openRules(),
      onMenu: () =>
        void menuDialog('Menu', [
          { label: 'Change theme', onClick: () => openThemePicker(themes) },
          { label: 'How to play', onClick: () => openRules() },
          { label: 'Back to home', danger: true, onClick: () => this.showHome() },
        ]),
    });

    const hideOverlay = () => overModal?.close();
    const showOver = (humanWon: boolean | null) => {
      const kind = humanWon === null ? 'draw' : humanWon ? 'win' : 'lose';
      overModal?.close();
      const again = h('button', { class: 'btn primary', text: 'Play again', attrs: { type: 'button' }, on: { click: () => this.startGame(config) } });
      overModal = openModal({
        title: controller.resultText(),
        body: [h('p', { text: controller.resultDetail() })],
        footer: [
          again,
          h('button', { class: 'btn', text: 'Home', attrs: { type: 'button' }, on: { click: () => this.showHome() } }),
          h('button', { class: 'btn ghost', text: 'View board', attrs: { type: 'button' }, on: { click: hideOverlay } }),
        ],
        variant: `over ${kind}`,
        initialFocus: () => again,
        onClose: () => {
          overModal = null;
        },
      });
    };

    controller = new GameController(config, {
      board,
      hud,
      sound: this.sound,
      ai,
      sideNames: () => themes.current.sideNames,
      onGameOver: (_s, humanWon) => showOver(humanWon),
      onGameResumed: hideOverlay,
    });

    const screen = h(
      'section',
      { class: 'screen game' },
      hud.top,
      h('div', { class: 'board-wrap' }, board.el),
      hud.bottom,
    );
    const offTheme = themes.onChange((t) => {
      board.setTheme(t);
      hud.setTheme(t);
      controller.refresh();
    });
    this.swap(screen, () => {
      offTheme();
      overModal?.close();
      controller.dispose();
      ai.dispose();
      board.destroy();
    });
    controller.start();
  }
}
