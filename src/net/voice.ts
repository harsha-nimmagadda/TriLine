import type { MediaConnection } from 'peerjs';
import type { PeerEndpoint } from './peer';
import { VoiceStats, summarizeStats, tuneOpusSdp } from './sdp';

export type VoiceState = 'idle' | 'starting' | 'in-call';

export interface VoiceEvents {
  state(s: VoiceState): void;
  /** Opponent started voice. Call accept() / decline() in response to a user click. */
  incoming(accept: () => void, decline: () => void): void;
  /** Human-readable problem or note. */
  message(text: string): void;
  /** Latency readout, about every 2 s while in a call; null when voice is off. */
  stats?(s: VoiceStats | null): void;
}

/** Low-latency capture settings. Plain values are 'ideal' constraints, so nothing fails if unsupported. */
export function micConstraints(supported: Partial<Record<string, boolean>> = {}): MediaTrackConstraints {
  const want: Record<string, unknown> = {
    channelCount: 1, // mono: half the data, no stereo processing
    sampleRate: 48000, // Opus native rate, avoids resampling
    latency: 0, // ask for the smallest capture buffer
    echoCancellation: true, // kept on: players are often on speakers
    noiseSuppression: true,
    autoGainControl: true,
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(want)) if (supported[k] !== false) out[k] = v;
  return out as MediaTrackConstraints;
}

/** Receiver side: smallest jitter buffer / playout delay the browser will allow. */
export function tuneReceivers(pc: RTCPeerConnection): void {
  for (const r of pc.getReceivers()) {
    if (r.track?.kind !== 'audio') continue;
    const rx = r as RTCRtpReceiver & { jitterBufferTarget?: number | null; playoutDelayHint?: number | null };
    try {
      if ('jitterBufferTarget' in rx) rx.jitterBufferTarget = 0;
    } catch {
      /* unsupported value */
    }
    try {
      if ('playoutDelayHint' in rx) rx.playoutDelayHint = 0;
    } catch {
      /* unsupported */
    }
  }
}

/** Sender side: ask the network stack to prioritise the voice packets. */
export async function tuneSenders(pc: RTCPeerConnection): Promise<void> {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== 'audio') continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) continue;
      for (const enc of params.encodings) {
        (enc as RTCRtpEncodingParameters & { networkPriority?: string }).networkPriority = 'high';
        enc.priority = 'high';
      }
      await sender.setParameters(params);
    } catch {
      /* not supported in this browser */
    }
  }
}

const CALL_OPTIONS = { sdpTransform: (sdp: string) => tuneOpusSdp(sdp) };
const STATS_INTERVAL_MS = 2000;

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
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private pc: RTCPeerConnection | null = null;

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
    const supported = navigator.mediaDevices.getSupportedConstraints?.() ?? {};
    const stream = await navigator.mediaDevices.getUserMedia({ audio: micConstraints(supported as Record<string, boolean>), video: false });
    for (const t of stream.getAudioTracks()) (t as MediaStreamTrack & { contentHint: string }).contentHint = 'speech';
    return stream;
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
    const call = peer.call(remote, this.local, CALL_OPTIONS);
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
      call.answer(this.local, CALL_OPTIONS);
    } catch (e) {
      // Still listen, even without a microphone.
      this.events.message(`${(e as { name?: string }).name === 'NotSupported' ? 'No microphone support' : describeMicError(e)} You can listen but the opponent cannot hear you.`);
      call.answer(undefined, CALL_OPTIONS);
    }
    this.attach(call);
  }

  private attach(call: MediaConnection): void {
    this.call = call;
    call.on('stream', (stream) => {
      if (!this.audio) {
        this.audio = document.createElement('audio');
        this.audio.autoplay = true;
        this.audio.setAttribute('playsinline', '');
        this.audio.preload = 'none';
        this.audio.style.display = 'none';
        document.body.append(this.audio);
      }
      this.audio.srcObject = stream;
      void this.audio.play().catch(() => this.events.message('Tap the page to hear the opponent.'));
      this.setState('in-call');
      this.tuneConnection(call);
      this.startStats();
    });
    call.on('close', () => this.cleanup(true));
    call.on('error', () => this.cleanup(true));
  }

  /** Receiver/sender tuning once the call's RTCPeerConnection exists. */
  private tuneConnection(call: MediaConnection): void {
    const pc = (call as unknown as { peerConnection?: RTCPeerConnection }).peerConnection ?? null;
    this.pc = pc;
    if (!pc) return;
    tuneReceivers(pc);
    void tuneSenders(pc);
  }

  private startStats(): void {
    if (this.statsTimer || !this.events.stats) return;
    const poll = async () => {
      const pc = this.pc;
      if (!pc) return;
      try {
        const report = await pc.getStats();
        const entries: Record<string, unknown>[] = [];
        report.forEach((v) => entries.push(v as Record<string, unknown>));
        this.events.stats?.(summarizeStats(entries));
        tuneReceivers(pc); // receivers can appear late; harmless to repeat
      } catch {
        /* connection closing */
      }
    };
    setTimeout(() => void poll(), 800);
    this.statsTimer = setInterval(() => void poll(), STATS_INTERVAL_MS);
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
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.statsTimer = null;
    this.pc = null;
    this.events.stats?.(null);
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
