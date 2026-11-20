import { h } from './dom';

export interface DialogOptions {
  title: string;
  text?: string;
  ok: string;
  cancel?: string;
  danger?: boolean;
}

/** In-page confirm dialog. Resolves true on OK, false on cancel/Escape. */
export function confirmDialog(opts: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = (v: boolean) => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      resolve(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false);
    };
    const okBtn = h('button', { class: `btn ${opts.danger ? 'danger' : 'primary'}`, text: opts.ok, on: { click: () => finish(true) } });
    const buttons = h('div', { class: 'dialog-buttons' });
    if (opts.cancel !== undefined) buttons.append(h('button', { class: 'btn', text: opts.cancel, on: { click: () => finish(false) } }));
    buttons.append(okBtn);
    const panel = h(
      'div',
      { class: 'modal small', attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-label': opts.title } },
      h('h2', { text: opts.title }),
      opts.text ? h('p', { text: opts.text }) : null,
      buttons,
    );
    const backdrop = h('div', { class: 'backdrop dialog-backdrop' }, panel);
    document.body.append(backdrop);
    document.addEventListener('keydown', onKey);
    okBtn.focus();
  });
}

/** Remove any open confirm dialogs (e.g. when the game ends underneath them). */
export function closeDialogs(): void {
  document.querySelectorAll('.dialog-backdrop').forEach((e) => e.remove());
}

export interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

/** Simple modal list of actions. Closes itself when an item is chosen. */
export function menuDialog(title: string, items: MenuItem[], closeLabel = 'Resume'): void {
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  const list = h('div', { class: 'menu menu-list' });
  for (const it of items) {
    list.append(
      h('button', {
        class: `btn big${it.danger ? ' danger' : ''}`,
        text: it.label,
        on: {
          click: () => {
            close();
            it.onClick();
          },
        },
      }),
    );
  }
  list.append(h('button', { class: 'btn big ghost', text: closeLabel, on: { click: close } }));
  const panel = h('div', { class: 'modal small', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': title } }, h('h2', { text: title }), list);
  const backdrop = h('div', { class: 'backdrop dialog-backdrop', on: { click: (e) => { if (e.target === backdrop) close(); } } }, panel);
  document.body.append(backdrop);
  document.addEventListener('keydown', onKey);
  (list.firstElementChild as HTMLElement | null)?.focus();
}
