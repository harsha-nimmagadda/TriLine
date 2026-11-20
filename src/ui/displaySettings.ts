import { openModal } from './dialog';
import { h } from './dom';
import { QUALITY_BLURB, QUALITY_LABEL, QUALITY_SETTINGS, QualityManager, QualitySetting } from './quality';

/** "Auto (High)" / "High" – the text shown for the current quality setting on buttons. */
export function qualitySummary(q: QualityManager): string {
  const eff = q.level;
  if (q.urlOverride) return `${QUALITY_LABEL[eff]} (URL)`;
  return q.setting === 'auto' ? `Auto (${QUALITY_LABEL[eff]})` : QUALITY_LABEL[q.setting];
}

/** Modal with the Display quality control. Applies instantly and persists. */
export function openDisplaySettings(quality: QualityManager): () => void {
  const group = h('div', { class: 'segmented grid quality-seg', attrs: { role: 'radiogroup', 'aria-label': 'Display quality' } });
  const blurb = h('p', { class: 'note' });
  const override = h('p', { class: 'note', attrs: { hidden: '' } });
  const buttons = new Map<QualitySetting, HTMLButtonElement>();

  for (const s of QUALITY_SETTINGS) {
    const btn = h(
      'button',
      { class: 'seg', attrs: { type: 'button', role: 'radio', 'aria-checked': 'false' }, on: { click: () => quality.setSetting(s) } },
      h('span', { class: 'seg-main', text: QUALITY_LABEL[s] }),
      h('span', { class: 'seg-sub', text: s === 'auto' ? `now ${QUALITY_LABEL[quality.autoLevel]}` : '' }),
    );
    buttons.set(s, btn);
    group.append(btn);
  }

  const refresh = () => {
    const eff = quality.level;
    for (const [s, btn] of buttons) {
      const on = s === quality.setting;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-checked', String(on));
      if (s === 'auto') (btn.lastElementChild as HTMLElement).textContent = `now ${QUALITY_LABEL[quality.autoLevel]}`;
    }
    blurb.textContent = `${QUALITY_LABEL[eff]}: ${QUALITY_BLURB[eff]}`;
    override.hidden = !quality.urlOverride;
    override.textContent = quality.urlOverride ? `This page was opened with ?quality=${quality.urlOverride}, which overrides the setting for this visit.` : '';
  };
  refresh();
  const off = quality.onChange(refresh);

  const m = openModal({
    title: 'Display quality',
    variant: 'small',
    body: [
      h('p', { class: 'note', text: 'Higher levels use photo-quality images where the theme has them. Lower levels are lighter on older phones.' }),
      group,
      blurb,
      override,
    ],
    footer: [h('button', { class: 'btn primary', text: 'Done', attrs: { type: 'button' }, on: { click: () => m.close() } })],
    onClose: off,
    initialFocus: () => group.querySelector('.on'),
  });
  return () => m.close();
}
