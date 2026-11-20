import { clear, h } from './dom';

export function segmented<T extends string | number>(
  label: string,
  options: { value: T; text: string; sub?: string }[],
  get: () => T,
  set: (v: T) => void,
): HTMLElement {
  const group = h('div', { class: 'segmented', attrs: { role: 'radiogroup', 'aria-label': label } });
  const render = () => {
    clear(group);
    for (const o of options) {
      const on = get() === o.value;
      group.append(
        h(
          'button',
          {
            class: `seg${on ? ' on' : ''}`,
            attrs: { role: 'radio', 'aria-checked': String(on) },
            on: {
              click: () => {
                set(o.value);
                render();
              },
            },
          },
          h('span', { class: 'seg-main', text: o.text }),
          o.sub ? h('span', { class: 'seg-sub', text: o.sub }) : null,
        ),
      );
    }
  };
  render();
  return h('div', { class: 'field' }, h('div', { class: 'field-label', text: label }), group);
}
