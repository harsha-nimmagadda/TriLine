import { h } from './dom';

/** Modal "How to play" panel. Returns a function that closes it. */
export function openRules(): () => void {
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  const li = (t: string) => h('li', { text: t });
  const panel = h(
    'div',
    { class: 'modal', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'How to play' } },
    h('h2', { text: 'How to play Pedda Dhadi' }),
    h('p', {
      text: 'Make a dhadi (three of your pieces in a straight line) to capture your opponent\'s pieces. Reduce them to fewer than 3, or leave them with no move, to win.',
    }),
    h('h3', { text: 'The board' }),
    h('ul', null,
      li('24 points on three nested squares. Lines join the squares only through the middle of each side.'),
      li('A dhadi is three of your pieces on one side of a square, or on one of the four lines that cross all three squares.'),
    ),
    h('h3', { text: '1. Placing' }),
    h('ul', null,
      li('Light (seeds) goes first. Take turns placing one piece on any empty point until everyone has placed all 9 (or 11) pieces.'),
    ),
    h('h3', { text: '2. Moving' }),
    h('ul', null,
      li('Then take turns sliding one piece to a neighbouring empty point along a line. No jumping or flying.'),
    ),
    h('h3', { text: 'Making a dhadi' }),
    h('ul', null,
      li('Whenever you form a dhadi (while placing or moving), remove one opponent piece.'),
      li('You cannot remove a piece that is in a dhadi, unless every opponent piece on the board is in a dhadi.'),
      li('Forming two dhadis with one move still removes only one piece.'),
      li('Break a dhadi and form it again later, and you capture again.'),
    ),
    h('h3', { text: 'Winning and drawing' }),
    h('ul', null,
      li('You win if your opponent has fewer than 3 pieces (on the board plus in hand), or has no legal move on their turn.'),
      li('The game is a draw after 50 moves in the moving phase without a capture, or if the same position occurs three times.'),
    ),
    h('button', { class: 'btn primary', text: 'Got it', on: { click: close } }),
  );
  const backdrop = h('div', { class: 'backdrop', on: { click: (e) => { if (e.target === backdrop) close(); } } }, panel);
  document.body.append(backdrop);
  document.addEventListener('keydown', onKey);
  panel.querySelector('button')?.focus();
  return close;
}
