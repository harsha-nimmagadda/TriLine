import { GameState, createInitialState } from '../engine/state';
import { BoardView } from './boardView';
import { openModal } from './dialog';
import { h } from './dom';
import { THEMES, Theme, ThemeManager } from './themes';

/** A small mid-game position used for the live previews: a dhadi for light and a capturable dark piece. */
function previewState(): GameState {
  const base = createInitialState(9);
  const board = base.board.slice();
  for (const i of [0, 1, 2, 11, 20]) board[i] = 0;
  for (const i of [8, 9, 17, 22, 13]) board[i] = 1;
  return { ...base, board, hand: [4, 4], turn: 0, phase: 'removing', formed: [0] };
}

function buildPreview(theme: Theme): HTMLElement {
  const view = new BoardView(theme, () => undefined);
  view.setInteractive(false);
  view.sync(previewState());
  view.setOverlay({ selected: null, targets: [], capturable: [9, 13] });
  view.el.setAttribute('aria-hidden', 'true');
  return h('div', { class: 'theme-preview' }, view.el);
}

/** Modal grid of live theme previews. Selecting applies the theme immediately. */
export function openThemePicker(manager: ThemeManager): () => void {
  let off: () => void = () => undefined;
  const grid = h('div', { class: 'theme-grid', attrs: { role: 'group', 'aria-label': 'Themes' } });
  const note = h('p', { class: 'note theme-note' });
  const buttons = new Map<string, HTMLButtonElement>();

  for (const t of THEMES) {
    const btn = h(
      'button',
      { class: 'theme-card', attrs: { type: 'button', 'aria-pressed': 'false' }, on: { click: () => manager.setPreference(t.id) } },
      buildPreview(t),
      h('span', { class: 'theme-name', text: t.name }),
      h('span', { class: 'theme-sides', text: `${t.sideNames[0]} vs ${t.sideNames[1]}` }),
    );
    buttons.set(t.id, btn);
    grid.append(btn);
  }

  const refresh = () => {
    const forced = manager.overriddenBy;
    for (const [id, btn] of buttons) {
      const on = id === manager.current.id;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.disabled = !!forced;
    }
    note.textContent = forced ? `Host's theme: ${forced.name}. The theme can't be changed during an online game you joined.` : '';
    note.hidden = !forced;
  };
  refresh();
  off = manager.onChange(refresh);

  const m = openModal({
    title: 'Choose a theme',
    variant: 'wide',
    body: [note, grid],
    footer: [h('button', { class: 'btn primary', text: 'Done', attrs: { type: 'button' }, on: { click: () => m.close() } })],
    onClose: () => off(),
    initialFocus: () => (grid.querySelector('.on') as HTMLElement | null) ?? grid.querySelector('button'),
  });
  return () => m.close();
}
