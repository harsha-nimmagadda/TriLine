import { h } from './dom';

/**
 * Shared modal component. Every dialog in the app (rules, theme picker, menu, confirms, game over,
 * voice/draw prompts) uses this one layout:
 *   fixed header (title + close button) / scrollable body / fixed footer (actions).
 * Styling is entirely through the theme CSS variables (see the .modal-* rules in style.css).
 */

export interface ModalOptions {
  title: string;
  /** Scrollable content. */
  body?: (Node | string | null | undefined | false)[] | Node | string;
  /** Pinned action buttons. */
  footer?: (Node | null | undefined | false)[];
  /** Escape, backdrop click and the × button close the modal (default true). Use false for required choices. */
  dismissible?: boolean;
  /** Show the × button (defaults to `dismissible`). */
  showClose?: boolean;
  /** Extra class on the panel: 'small' | 'wide' | 'over' ... */
  variant?: string;
  role?: 'dialog' | 'alertdialog';
  /** Called once after the modal has closed, however it closed. */
  onClose?: () => void;
  /** Transient modals are removed by closeDialogs() (e.g. when the game ends underneath them). */
  transient?: boolean;
  /** Element to focus on open (default: the primary footer button, else the first focusable). */
  initialFocus?: () => HTMLElement | null;
}

export interface ModalHandle {
  readonly el: HTMLElement;
  readonly body: HTMLElement;
  readonly footer: HTMLElement;
  close(): void;
  setTitle(t: string): void;
  setBody(content: ModalOptions['body']): void;
  setFooter(nodes: (Node | null | undefined | false)[]): void;
  readonly closed: boolean;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Entry {
  handle: ModalHandle;
  backdrop: HTMLElement;
  panel: HTMLElement;
  opts: ModalOptions;
  returnFocus: Element | null;
}
const stack: Entry[] = [];
let idCounter = 0;
let keyListener: ((e: KeyboardEvent) => void) | null = null;

function lockScroll(on: boolean): void {
  document.documentElement.classList.toggle('modal-open', on);
}

function onKey(e: KeyboardEvent): void {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === 'Escape') {
    if (top.opts.dismissible !== false) {
      e.preventDefault();
      top.handle.close();
    }
    return;
  }
  if (e.key === 'Tab') {
    const items = Array.from(top.panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hidden && el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (!top.panel.contains(active)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

function fill(el: HTMLElement, content: ModalOptions['body']): void {
  el.replaceChildren();
  if (content === undefined || content === null) return;
  const list = Array.isArray(content) ? content : [content];
  for (const c of list) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
}

export function openModal(opts: ModalOptions): ModalHandle {
  const dismissible = opts.dismissible !== false;
  const showClose = opts.showClose ?? dismissible;
  const titleId = `modal-title-${++idCounter}`;

  const titleEl = h('h2', { class: 'modal-title', text: opts.title, attrs: { id: titleId } });
  const closeBtn = showClose
    ? h('button', { class: 'icon-btn modal-close', text: '×', attrs: { type: 'button', 'aria-label': 'Close' } })
    : null;
  const head = h('header', { class: 'modal-head' }, titleEl, closeBtn);
  const body = h('div', { class: 'modal-body' });
  const footer = h('footer', { class: 'modal-foot' });
  fill(body, opts.body);
  for (const f of opts.footer ?? []) if (f) footer.append(f);
  footer.hidden = footer.childElementCount === 0;

  const panel = h(
    'div',
    {
      class: `modal${opts.variant ? ' ' + opts.variant : ''}`,
      attrs: { role: opts.role ?? 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    },
    head,
    body,
    footer,
  );
  // Short dialogs (small / game over) stay centred on phones; tall content slides up as a bottom sheet.
  const sheet = !/(^|\s)(small|over)(\s|$)/.test(opts.variant ?? '');
  const backdrop = h('div', { class: `backdrop modal-backdrop${sheet ? ' sheet' : ''}` }, panel);

  // Scroll affordances: shadow under the header / above the footer when content is clipped.
  const updateScroll = () => {
    const top = body.scrollTop > 1;
    const more = body.scrollHeight - body.scrollTop - body.clientHeight > 1;
    panel.toggleAttribute('data-scrolled', top);
    panel.toggleAttribute('data-more', more);
  };
  body.addEventListener('scroll', updateScroll, { passive: true });
  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(updateScroll);
    ro.observe(body);
    ro.observe(panel);
  }

  let closed = false;
  const handle: ModalHandle = {
    el: panel,
    body,
    footer,
    get closed() {
      return closed;
    },
    close() {
      if (closed) return;
      closed = true;
      ro?.disconnect();
      const i = stack.findIndex((s) => s.handle === handle);
      const entry = i >= 0 ? stack.splice(i, 1)[0] : null;
      backdrop.remove();
      if (stack.length === 0) {
        lockScroll(false);
        if (keyListener) document.removeEventListener('keydown', keyListener);
        keyListener = null;
      }
      const ret = entry?.returnFocus;
      if (ret instanceof HTMLElement && document.contains(ret)) ret.focus();
      opts.onClose?.();
    },
    setTitle(t) {
      titleEl.textContent = t;
    },
    setBody(content) {
      fill(body, content);
      updateScroll();
    },
    setFooter(nodes) {
      footer.replaceChildren();
      for (const n of nodes) if (n) footer.append(n);
      footer.hidden = footer.childElementCount === 0;
      updateScroll();
    },
  };

  closeBtn?.addEventListener('click', () => handle.close());
  if (dismissible) {
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) handle.close();
    });
  }

  stack.push({ handle, backdrop, panel, opts, returnFocus: document.activeElement });
  document.body.append(backdrop);
  lockScroll(true);
  if (!keyListener) {
    keyListener = onKey;
    document.addEventListener('keydown', keyListener);
  }
  updateScroll();
  requestAnimationFrame(updateScroll);

  const focusTarget =
    opts.initialFocus?.() ?? footer.querySelector<HTMLElement>('.primary, .danger') ?? footer.querySelector<HTMLElement>('button') ?? panel.querySelector<HTMLElement>(FOCUSABLE);
  focusTarget?.focus();
  return handle;
}

/** Close every transient modal (confirms, menus, prompts). */
export function closeDialogs(): void {
  for (const e of [...stack]) if (e.opts.transient) e.handle.close();
}

/** Close every open modal. */
export function closeAllModals(): void {
  for (const e of [...stack]) e.handle.close();
}

// ---- common dialogs --------------------------------------------------------------------------

export interface DialogOptions {
  title: string;
  text?: string;
  ok: string;
  cancel?: string;
  danger?: boolean;
}

/** Confirm dialog. Resolves true on OK, false on cancel / Escape / × / backdrop. */
export function confirmDialog(opts: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let result = false;
    const ok = h('button', { class: `btn ${opts.danger ? 'danger' : 'primary'}`, text: opts.ok, attrs: { type: 'button' }, on: { click: () => { result = true; m.close(); } } });
    const cancel =
      opts.cancel !== undefined ? h('button', { class: 'btn', text: opts.cancel, attrs: { type: 'button' }, on: { click: () => m.close() } }) : null;
    const m = openModal({
      title: opts.title,
      body: opts.text ? [h('p', { text: opts.text })] : [],
      footer: [cancel, ok],
      variant: 'small',
      role: 'alertdialog',
      transient: true,
      dismissible: opts.cancel !== undefined,
      onClose: () => resolve(result),
      // Never default-focus a destructive action.
      initialFocus: () => (opts.danger && cancel ? cancel : ok),
    });
  });
}

export interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

/** Modal list of actions. Closes itself when an item is chosen. */
export function menuDialog(title: string, items: MenuItem[], closeLabel = 'Resume'): ModalHandle {
  const list = h('div', { class: 'menu-list' });
  const m: ModalHandle = openModal({
    title,
    variant: 'small',
    transient: true,
    body: [list],
    footer: [h('button', { class: 'btn', text: closeLabel, attrs: { type: 'button' }, on: { click: () => m.close() } })],
  });
  for (const it of items) {
    list.append(
      h('button', {
        class: `btn big${it.danger ? ' danger' : ''}`,
        text: it.label,
        attrs: { type: 'button' },
        on: {
          click: () => {
            m.close();
            it.onClick();
          },
        },
      }),
    );
  }
  (list.firstElementChild as HTMLElement | null)?.focus();
  return m;
}
