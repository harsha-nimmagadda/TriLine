import { describe, expect, it } from 'vitest';
import { latencyLevel, summarizeStats, tuneOpusSdp } from '../src/net/sdp';

const SDP = [
  'v=0',
  'o=- 1 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111 63 9 0 8',
  'c=IN IP4 0.0.0.0',
  'a=rtcp-mux',
  'a=rtpmap:111 opus/48000/2',
  'a=fmtp:111 minptime=10;useinbandfec=0;usedtx=1;stereo=1',
  'a=rtpmap:9 G722/8000',
  'a=sendrecv',
  'm=video 9 UDP/TLS/RTP/SAVPF 96',
  'a=rtpmap:96 VP8/90000',
  '',
].join('\r\n');

describe('tuneOpusSdp', () => {
  const out = tuneOpusSdp(SDP);
  it('sets low-latency Opus parameters', () => {
    const fmtp = out.split('\r\n').find((l) => l.startsWith('a=fmtp:111'))!;
    expect(fmtp).toContain('minptime=10');
    expect(fmtp).toContain('useinbandfec=1');
    expect(fmtp).toContain('usedtx=0');
    expect(fmtp).toContain('stereo=0');
    expect(fmtp).toContain('maxaveragebitrate=32000');
    expect(fmtp).not.toContain('useinbandfec=0');
  });
  it('adds ptime within the audio section only, keeps CRLF', () => {
    const lines = out.split('\r\n');
    const ptime = lines.indexOf('a=ptime:10');
    expect(ptime).toBeGreaterThan(lines.findIndex((l) => l.startsWith('m=audio')));
    expect(ptime).toBeLessThan(lines.findIndex((l) => l.startsWith('m=video')));
    expect(out).not.toMatch(/[^\r]\n/);
  });
  it('puts Opus first in the m=audio line', () => {
    const rest = tuneOpusSdp(SDP.replace('111 63 9 0 8', '9 0 111 8'));
    expect(rest).toContain('m=audio 9 UDP/TLS/RTP/SAVPF 111 9 0 8');
  });
  it('adds an fmtp line when there is none and is idempotent', () => {
    const bare = SDP.replace(/a=fmtp:111.*\r\n/, '');
    const t = tuneOpusSdp(bare);
    expect(t).toMatch(/a=fmtp:111 .*usedtx=0/);
    expect(tuneOpusSdp(t)).toBe(t);
    expect(tuneOpusSdp(out)).toBe(out);
  });
  it('leaves SDP without Opus untouched', () => {
    const none = SDP.replace('opus/48000/2', 'PCMU/8000');
    expect(tuneOpusSdp(none)).toBe(none);
  });
});

describe('summarizeStats', () => {
  const entries = [
    { id: 'T', type: 'transport', selectedCandidatePairId: 'P' },
    { id: 'P', type: 'candidate-pair', currentRoundTripTime: 0.06, localCandidateId: 'L', remoteCandidateId: 'R' },
    { id: 'L', type: 'local-candidate', candidateType: 'host' },
    { id: 'R', type: 'remote-candidate', candidateType: 'srflx' },
    { id: 'I', type: 'inbound-rtp', kind: 'audio', jitterBufferDelay: 2, jitterBufferEmittedCount: 100 },
  ];
  it('combines half RTT and jitter-buffer delay', () => {
    const s = summarizeStats(entries);
    expect(s.rttMs).toBeCloseTo(60);
    expect(s.jitterBufferMs).toBeCloseTo(20);
    expect(s.latencyMs).toBeCloseTo(50);
    expect(s.relayed).toBe(false);
  });
  it('flags relayed connections and handles missing data', () => {
    const relayed = summarizeStats(entries.map((e) => (e.id === 'R' ? { ...e, candidateType: 'relay' } : e)));
    expect(relayed.relayed).toBe(true);
    expect(summarizeStats([]).latencyMs).toBeNull();
  });
  it('classifies latency', () => {
    expect([latencyLevel(80), latencyLevel(200), latencyLevel(400), latencyLevel(null)]).toEqual(['good', 'ok', 'bad', 'unknown']);
  });
});
