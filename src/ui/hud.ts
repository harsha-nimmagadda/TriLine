import { GameState, Player, opponent } from '../engine/state';
import { h, svgEl, svgFragment } from './dom';
import type { Theme } from './themes/theme';

export interface PlayerLabel {
  name: string;
  /** e.g. "Light seeds" */
  side: string;
}

export interface HudModel {
  state: GameState;
  labels: readonly [PlayerLabel, PlayerLabel];
  status: string;
  statusKind: 'normal' | 'capture' | 'over' | 'wait';
  showUndo: boolean;
  undoEnabled: boolean;
  /** Online games only. */
  online?: { active: boolean; connected: boolean; drawPending: boolean };
}

export interface HudCallbacks {
  onUndo(): void;
  onRules(): void;
  onMenu(): void;
  /** Online extras; presence of onResign enables the online buttons. */
  onResign?(): void;
  onDraw?(): void;
  onChat?(): void;
}

interface Card {
  root: HTMLElement;
  name: HTMLElement;
  side: HTMLElement;
  hand: HTMLElement;
  captured: HTMLElement;
}

/** Turn indicator, piece counters, status line and the action bar. */
export class Hud {
  readonly top: HTMLElement;
  readonly bottom: HTMLElement;
  private cards: [Card, Card];
  private status: HTMLElement;
  private undoBtn: HTMLButtonElement;
  private resignBtn: HTMLButtonElement | null = null;
  private drawBtn: HTMLButtonElement | null = null;
  private chatBadge: HTMLElement | null = null;

  constructor(theme: Theme, cb: HudCallbacks) {
    const mk = (p: Player): Card => {
      const icon = svgEl('svg', { viewBox: '-26 -22 52 44', class: 'card-icon', 'aria-hidden': 'true' });
      for (const n of svgFragment(theme.piece(p, 17))) icon.append(n);
      const name = h('div', { class: 'card-name' });
      const side = h('div', { class: 'card-side' });
      const hand = h('span', { class: 'stat-val', text: '0' });
      const captured = h('span', { class: 'stat-val', text: '0' });
      const root = h(
        'div',
        { class: `card p${p}` },
        icon,
        h('div', { class: 'card-main' }, name, side),
        h(
          'div',
          { class: 'card-stats' },
          h('div', { class: 'stat', attrs: { title: 'Pieces left to place' } }, h('span', { class: 'stat-label', text: 'In hand' }), hand),
          h('div', { class: 'stat', attrs: { title: 'Opponent pieces captured' } }, h('span', { class: 'stat-label', text: 'Captured' }), captured),
        ),
      );
      return { root, name, side, hand, captured };
    };
    this.cards = [mk(0), mk(1)];
    this.status = h('div', { class: 'status', attrs: { role: 'status', 'aria-live': 'polite' } });
    this.top = h('div', { class: 'hud-top' }, h('div', { class: 'cards' }, this.cards[0].root, this.cards[1].root), this.status);

    this.undoBtn = h('button', { class: 'btn', text: 'Undo', on: { click: () => cb.onUndo() } });
    this.bottom = h(
      'div',
      { class: 'hud-bottom' },
      this.undoBtn,
      h('button', { class: 'btn', text: 'How to play', on: { click: () => cb.onRules() } }),
      h('button', { class: 'btn', text: 'Menu', on: { click: () => cb.onMenu() } }),
    );
    if (cb.onResign) {
      this.resignBtn = h('button', { class: 'btn danger', text: 'Resign', on: { click: () => cb.onResign?.() } });
      this.drawBtn = h('button', { class: 'btn', text: 'Offer draw', on: { click: () => cb.onDraw?.() } });
      this.chatBadge = h('span', { class: 'badge-count', attrs: { hidden: '' }, text: '0' });
      const chatBtn = h('button', { class: 'btn chat-toggle', on: { click: () => cb.onChat?.() } }, 'Chat ', this.chatBadge);
      this.bottom.prepend(this.resignBtn, this.drawBtn, chatBtn);
    }
  }

  update(m: HudModel): void {
    const s = m.state;
    for (const p of [0, 1] as const) {
      const c = this.cards[p];
      c.name.textContent = m.labels[p].name;
      c.side.textContent = m.labels[p].side;
      c.hand.textContent = String(s.hand[p]);
      c.captured.textContent = String(s.lost[opponent(p)]);
      c.root.classList.toggle('active', s.phase !== 'gameover' && s.turn === p);
    }
    this.status.textContent = m.status;
    this.status.dataset.kind = m.statusKind;
    this.undoBtn.hidden = !m.showUndo;
    this.undoBtn.disabled = !m.undoEnabled;
    if (this.resignBtn && this.drawBtn && m.online) {
      this.resignBtn.disabled = !m.online.active;
      if (!m.online.active) {
        this.drawBtn.disabled = false;
        this.drawBtn.textContent = 'Results';
      } else {
        this.drawBtn.disabled = !m.online.connected || m.online.drawPending;
        this.drawBtn.textContent = m.online.drawPending ? 'Draw offered' : 'Offer draw';
      }
    }
  }

  setChatBadge(n: number): void {
    if (!this.chatBadge) return;
    this.chatBadge.textContent = String(n);
    this.chatBadge.hidden = n === 0;
  }
}

