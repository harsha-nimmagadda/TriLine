/** Pure helpers for tuning audio SDP and summarising WebRTC stats for low-latency voice. */

export interface OpusTuning {
  /** Packetisation time in ms (smaller = lower latency, more overhead). */
  ptime: number;
  minptime: number;
  maxaveragebitrate: number;
}

export const DEFAULT_OPUS_TUNING: OpusTuning = { ptime: 10, minptime: 10, maxaveragebitrate: 32000 };

/**
 * Tune the Opus audio section of an SDP: Opus first in the m=audio line, 10 ms packets, in-band FEC
 * on, DTX off (no resume delay after silence), mono, ~32 kbps cap. Returns the input unchanged if it
 * has no Opus payload. Preserves the original line endings.
 */
export function tuneOpusSdp(sdp: string, tuning: OpusTuning = DEFAULT_OPUS_TUNING): string {
  const eol = sdp.includes('\r\n') ? '\r\n' : '\n';
  const lines = sdp.split(/\r?\n/);
  const opusLine = lines.find((l) => /^a=rtpmap:\d+ opus\/48000/i.test(l));
  if (!opusLine) return sdp;
  const pt = /^a=rtpmap:(\d+)/.exec(opusLine)![1];

  // Locate the audio media section.
  const start = lines.findIndex((l) => l.startsWith('m=audio'));
  if (start < 0) return sdp;
  let end = lines.findIndex((l, i) => i > start && l.startsWith('m='));
  if (end < 0) end = lines.length;

  // Prefer Opus in the payload list.
  const parts = lines[start].split(' ');
  const head = parts.slice(0, 3);
  const pts = parts.slice(3);
  if (pts.includes(pt)) lines[start] = [...head, pt, ...pts.filter((p) => p !== pt)].join(' ');

  const want: Record<string, string> = {
    minptime: String(tuning.minptime),
    useinbandfec: '1',
    usedtx: '0',
    stereo: '0',
    'sprop-stereo': '0',
    maxaveragebitrate: String(tuning.maxaveragebitrate),
  };

  let fmtp = -1;
  for (let i = start; i < end; i++) if (lines[i].startsWith(`a=fmtp:${pt} `)) fmtp = i;
  if (fmtp >= 0) {
    const params = new Map<string, string>();
    for (const kv of lines[fmtp].slice(`a=fmtp:${pt} `.length).split(';')) {
      const [k, ...v] = kv.trim().split('=');
      if (k) params.set(k, v.join('='));
    }
    for (const [k, v] of Object.entries(want)) params.set(k, v);
    lines[fmtp] = `a=fmtp:${pt} ${[...params].map(([k, v]) => (v === '' ? k : `${k}=${v}`)).join(';')}`;
  } else {
    const rtpmapIdx = lines.indexOf(opusLine);
    lines.splice(rtpmapIdx + 1, 0, `a=fmtp:${pt} ${Object.entries(want).map(([k, v]) => `${k}=${v}`).join(';')}`);
    end++;
  }

  // ptime / maxptime attributes (replace any existing ones).
  for (let i = end - 1; i > start; i--) if (/^a=(ptime|maxptime):/.test(lines[i])) {
    lines.splice(i, 1);
    end--;
  }
  const lastAttr = (() => {
    for (let i = end - 1; i > start; i--) if (lines[i] !== '') return i;
    return end - 1;
  })();
  lines.splice(lastAttr + 1, 0, `a=ptime:${tuning.ptime}`, `a=maxptime:${Math.max(tuning.ptime, 20)}`);
  return lines.join(eol);
}

// ---- stats ---------------------------------------------------------------------------------

export interface VoiceStats {
  /** Estimated one-way delay in ms: RTT/2 plus receive jitter-buffer delay. */
  latencyMs: number | null;
  rttMs: number | null;
  jitterBufferMs: number | null;
  /** True if media is relayed through a TURN server (adds latency). */
  relayed: boolean;
}

type StatEntry = Record<string, unknown>;

/** Reduce a getStats() report (as an array of entries) to the numbers we show. */
export function summarizeStats(entries: readonly StatEntry[]): VoiceStats {
  const byId = new Map<string, StatEntry>();
  for (const e of entries) if (typeof e.id === 'string') byId.set(e.id, e);

  let pair: StatEntry | undefined;
  const transport = entries.find((e) => e.type === 'transport' && typeof e.selectedCandidatePairId === 'string');
  if (transport) pair = byId.get(transport.selectedCandidatePairId as string);
  if (!pair) {
    pair = entries.find((e) => e.type === 'candidate-pair' && (e.selected === true || (e.nominated === true && e.state === 'succeeded')));
  }

  const num = (x: unknown): number | null => (typeof x === 'number' && isFinite(x) ? x : null);
  const rttSec = pair ? num(pair.currentRoundTripTime) : null;
  const rttMs = rttSec === null ? null : rttSec * 1000;

  const inbound = entries.find((e) => e.type === 'inbound-rtp' && (e.kind === 'audio' || e.mediaType === 'audio'));
  let jbMs: number | null = null;
  if (inbound) {
    const delay = num(inbound.jitterBufferDelay);
    const count = num(inbound.jitterBufferEmittedCount);
    if (delay !== null && count) jbMs = (delay / count) * 1000;
  }

  let relayed = false;
  if (pair) {
    for (const key of ['localCandidateId', 'remoteCandidateId']) {
      const c = byId.get(pair[key] as string);
      if (c && c.candidateType === 'relay') relayed = true;
    }
  }

  const latencyMs = rttMs === null && jbMs === null ? null : (rttMs ?? 0) / 2 + (jbMs ?? 0);
  return { latencyMs, rttMs, jitterBufferMs: jbMs, relayed };
}

export function latencyLevel(ms: number | null): 'good' | 'ok' | 'bad' | 'unknown' {
  if (ms === null) return 'unknown';
  return ms < 150 ? 'good' : ms < 300 ? 'ok' : 'bad';
}
