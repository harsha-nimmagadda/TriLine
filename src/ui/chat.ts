import type { VoiceState } from '../net/voice';
import { MAX_CHAT_LENGTH } from '../net/protocol';
import { h } from './dom';

export type ChatKind = 'me' | 'them' | 'system';

export interface ChatOptions {
  /** Returns false if the message could not be sent. */
  onSend(text: string): boolean;
  voice: {
    supported: boolean;
    onStart(): void;
    onToggleMute(): void;
    onHangUp(): void;
  } | null;
  onUnreadChange(n: number): void;
}

const DESKTOP = '(min-width: 900px)';

/**
 * Chat log + input + voice controls. A side panel on desktop, a slide-up drawer on phones.
 * All message text is inserted with textContent, never as HTML.
 */
export class ChatPanel {
  readonly el: HTMLElement;
  private log: HTMLElement;
  private input: HTMLInputElement;
  private chip: HTMLElement;
  private voiceBtn: HTMLButtonElement | null = null;
  private muteBtn: HTMLButtonElement | null = null;
  private voiceNote: HTMLElement | null = null;
  private voiceLatency: HTMLElement | null = null;
  private unread = 0;
  private open = false;
  private logWrap: HTMLElement;
  private pill: HTMLButtonElement;
  private stick = true;
  private vvHandler: (() => void) | null = null;

  constructor(private opts: ChatOptions) {
    this.chip = h('span', { class: 'chip', text: 'Connecting…' });
    this.log = h('div', { class: 'chat-log', attrs: { role: 'log', 'aria-live': 'polite' } });
    this.input = h('input', {
      class: 'chat-input',
      attrs: { type: 'text', maxlength: String(MAX_CHAT_LENGTH), placeholder: 'Type a message…', autocomplete: 'off', 'aria-label': 'Chat message' },
    });
    const form = h(
      'form',
      {
        class: 'chat-form',
        on: {
          submit: (e) => {
            e.preventDefault();
            const text = this.input.value.trim();
            if (!text) return;
            if (opts.onSend(text)) {
              this.addMessage('me', text);
              this.input.value = '';
            } else {
              this.addMessage('system', 'Message not sent: not connected.');
            }
          },
        },
      },
      this.input,
      h('button', { class: 'btn primary', text: 'Send', attrs: { type: 'submit' } }),
    );

    const header = h(
      'div',
      { class: 'chat-header' },
      h('strong', { class: 'chat-title', text: 'Chat' }),
      this.chip,
      h('button', { class: 'icon-btn chat-close', text: '✕', attrs: { 'aria-label': 'Close chat', type: 'button' }, on: { click: () => this.setOpen(false) } }),
    );

    const headParts: (HTMLElement | null)[] = [header];
    if (opts.voice) {
      const v = opts.voice;
      this.voiceBtn = h('button', { class: 'btn', text: '🎤 Start voice', attrs: { type: 'button' }, on: { click: () => this.voiceClick() } });
      this.muteBtn = h('button', { class: 'btn', text: 'Mute', attrs: { type: 'button', hidden: '' }, on: { click: () => v.onToggleMute() } });
      this.voiceNote = h('div', { class: 'voice-note', attrs: { hidden: '' } });
      if (!v.supported) {
        this.voiceBtn.disabled = true;
        this.voiceBtn.title = 'Voice needs microphone support (and a secure page)';
      }
      this.voiceLatency = h('div', { class: 'voice-latency', attrs: { hidden: '', 'aria-live': 'off', title: 'Estimated one-way voice delay' } });
      this.voiceLatency.style.cssText = 'padding:4px 12px 0;font-size:.8rem;font-variant-numeric:tabular-nums';
      headParts.push(h('div', { class: 'voice-bar' }, this.voiceBtn, this.muteBtn), this.voiceLatency, this.voiceNote);
    }
    this.pill = h('button', { class: 'new-msgs', text: '↓ New messages', attrs: { type: 'button', hidden: '' }, on: { click: () => this.scrollToEnd() } });
    this.logWrap = h('div', { class: 'chat-log-wrap' }, this.log, this.pill);
    this.log.addEventListener(
      'scroll',
      () => {
        this.stick = this.nearEnd();
        if (this.stick) this.pill.hidden = true;
        this.el.toggleAttribute('data-scrolled', this.log.scrollTop > 1);
      },
      { passive: true },
    );
    this.el = h('aside', { class: 'chat', attrs: { 'aria-label': 'Chat' } }, h('div', { class: 'chat-head' }, ...headParts), this.logWrap, form);
  }

  private voiceState: VoiceState = 'idle';
  private voiceClick(): void {
    const v = this.opts.voice!;
    if (this.voiceState === 'idle') v.onStart();
    else v.onHangUp();
  }

  setVoiceState(s: VoiceState, muted: boolean): void {
    this.voiceState = s;
    if (!this.voiceBtn || !this.muteBtn) return;
    this.voiceBtn.textContent = s === 'idle' ? '🎤 Start voice' : s === 'starting' ? 'Connecting… (hang up)' : '📞 Hang up';
    this.muteBtn.hidden = s === 'idle';
    this.muteBtn.textContent = muted ? 'Unmute' : 'Mute';
    this.voiceBtn.classList.toggle('active', s === 'in-call');
  }

  setStatus(text: string, kind: 'ok' | 'warn' | 'bad'): void {
    this.chip.textContent = text;
    this.chip.dataset.kind = kind;
  }

  private visible(): boolean {
    return this.open || window.matchMedia(DESKTOP).matches;
  }

  private nearEnd(): boolean {
    return this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 40;
  }

  private scrollToEnd(): void {
    this.log.scrollTop = this.log.scrollHeight;
    this.stick = true;
    this.pill.hidden = true;
  }

  /** On phones, keep the drawer above the on-screen keyboard using the visual viewport. */
  private trackViewport(on: boolean): void {
    const vv = window.visualViewport;
    if (!vv) return;
    if (!on) {
      if (this.vvHandler) {
        vv.removeEventListener('resize', this.vvHandler);
        vv.removeEventListener('scroll', this.vvHandler);
      }
      this.vvHandler = null;
      this.el.style.removeProperty('--kb');
      this.el.style.removeProperty('--vvh');
      return;
    }
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      this.el.style.setProperty('--kb', `${Math.round(kb)}px`);
      this.el.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
      if (this.nearEnd()) this.scrollToEnd();
    };
    this.vvHandler = update;
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
  }

  setOpen(o: boolean): void {
    this.open = o;
    this.el.classList.toggle('open', o);
    this.trackViewport(o && !window.matchMedia(DESKTOP).matches);
    if (o) {
      this.clearUnread();
      this.scrollToEnd();
      this.input.focus();
    }
  }

  destroy(): void {
    this.trackViewport(false);
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  private clearUnread(): void {
    this.unread = 0;
    this.opts.onUnreadChange(0);
  }

  addMessage(kind: ChatKind, text: string): void {
    const d = new Date();
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const row = h(
      'div',
      { class: `msg ${kind}` },
      kind === 'system' ? null : h('span', { class: 'msg-who', text: kind === 'me' ? 'You' : 'Opponent' }),
      h('span', { class: 'msg-text', text }),
      kind === 'system' ? null : h('span', { class: 'msg-time', text: time }),
    );
    const follow = this.nearEnd() || kind === 'me';
    this.log.append(row);
    while (this.log.childElementCount > 300) this.log.firstElementChild?.remove();
    if (follow) this.scrollToEnd();
    else if (kind !== 'system') this.pill.hidden = false;
    if (kind === 'them' && !this.visible()) {
      this.unread++;
      this.opts.onUnreadChange(this.unread);
    }
  }

  /** Latency readout, e.g. "~85 ms"; pass null to hide. */
  setVoiceStats(stats: { latencyMs: number | null; relayed: boolean } | null): void {
    const el = this.voiceLatency;
    if (!el) return;
    if (!stats) {
      el.hidden = true;
      return;
    }
    const ms = stats.latencyMs;
    el.hidden = false;
    el.textContent = (ms === null ? 'Voice delay: measuring…' : `Voice delay ~${Math.round(ms)} ms`) + (stats.relayed ? ' · relayed (slower)' : '');
    el.style.color = ms === null ? '' : ms < 150 ? 'var(--good)' : ms < 300 ? 'var(--accent)' : 'var(--danger)';
  }

  /** Short note under the voice buttons (errors, hints). */
  setVoiceNote(text: string): void {
    if (!this.voiceNote) return;
    this.voiceNote.textContent = text;
    this.voiceNote.hidden = !text;
  }
}
