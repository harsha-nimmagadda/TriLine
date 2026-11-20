import type { MediaConnection } from 'peerjs';
import type { PeerEndpoint } from './peer';

export type VoiceState = 'idle' | 'starting' | 'in-call';

export interface VoiceEvents {
  state(s: VoiceState): void;
  /** Opponent started voice. Call accept() / decline() in response to a user click. */
  incoming(accept: () => void, decline: () => void): void;
  /** Human-readable problem or note. */
  message(text: string): void;
}

export function describeMicError(e: unknown): string {
  const name = (e as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone permission was denied.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found.';
  if (name === 'NotReadableError') return 'The microphone is in use by another application.';
  return 'Could not access the microphone.';
}

/** Voice chat over a PeerJS media call. The callee must accept (autoplay rules). */
export class VoiceChat {
  state: VoiceState = 'idle';
  muted = false;
  private call: MediaConnection | null = null;
  private local: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;

  constructor(
    private endpoint: PeerEndpoint,
    private events: VoiceEvents,
  ) {
    endpoint.onCall = (call) => this.handleIncoming(call);
  }

  get supported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  private setState(s: VoiceState): void {
    this.state = s;
    this.events.state(s);
  }

  private async getMic(): Promise<MediaStream> {
    if (!this.supported) throw Object.assign(new Error('unsupported'), { name: 'NotSupported' });
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }

  /** Ask for the microphone and call the opponent. */
  async start(): Promise<void> {
    if (this.state !== 'idle') return;
    const peer = this.endpoint.getPeer();
    const remote = this.endpoint.remoteId();
    if (!peer || !remote) {
      this.events.message('Voice is not available until the opponent is connected.');
      return;
    }
    this.setState('starting');
    try {
      this.local = await this.getMic();
    } catch (e) {
      this.events.message(
        (e as { name?: string }).name === 'NotSupported'
          ? 'Voice chat needs a secure (https) page and a browser with microphone support.'
          : describeMicError(e),
      );
      this.setState('idle');
      return;
    }
    this.applyMute();
    const call = peer.call(remote, this.local);
    this.attach(call);
    this.events.message('Calling the opponent… they need to accept.');
  }

  private handleIncoming(call: MediaConnection): void {
    if (this.state !== 'idle') {
      call.close();
      return;
    }
    this.events.incoming(
      () => void this.accept(call),
      () => {
        call.close();
        this.events.message('You declined the voice call.');
      },
    );
  }

  private async accept(call: MediaConnection): Promise<void> {
    this.setState('starting');
    try {
      this.local = await this.getMic();
      this.applyMute();
      call.answer(this.local);
    } catch (e) {
      // Still listen, even without a microphone.
      this.events.message(`${(e as { name?: string }).name === 'NotSupported' ? 'No microphone support' : describeMicError(e)} You can listen but the opponent cannot hear you.`);
      call.answer();
    }
    this.attach(call);
  }

  private attach(call: MediaConnection): void {
    this.call = call;
    call.on('stream', (stream) => {
      if (!this.audio) {
        this.audio = document.createElement('audio');
        this.audio.autoplay = true;
        this.audio.style.display = 'none';
        document.body.append(this.audio);
      }
      this.audio.srcObject = stream;
      void this.audio.play().catch(() => this.events.message('Tap the page to hear the opponent.'));
      this.setState('in-call');
    });
    call.on('close', () => this.cleanup(true));
    call.on('error', () => this.cleanup(true));
  }

  private applyMute(): void {
    this.local?.getAudioTracks().forEach((t) => (t.enabled = !this.muted));
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyMute();
  }

  hangUp(): void {
    this.call?.close();
    this.cleanup(false);
  }

  private cleanup(remoteEnded: boolean): void {
    const was = this.state;
    this.call = null;
    this.local?.getTracks().forEach((t) => t.stop());
    this.local = null;
    if (this.audio) {
      this.audio.srcObject = null;
      this.audio.remove();
      this.audio = null;
    }
    if (was !== 'idle') {
      this.setState('idle');
      if (remoteEnded) this.events.message('Voice call ended.');
    }
  }

  dispose(): void {
    this.endpoint.onCall = null;
    this.hangUp();
  }
}
