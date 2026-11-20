import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, applyAction } from '../src/engine';
import { generateCode, normalizeCode, codeFromHash, shareLink, peerIdFor } from '../src/net/roomCode';
import { parseMessage, parseState } from '../src/net/protocol';
import { OnlineSession } from '../src/net/session';
import { createMemoryPair } from '../src/net/transport';

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

async function connect(hostOpts: { pieces?: 9 | 11; hostColor?: 0 | 1 } = {}) {
  const host = new OnlineSession({ role: 'host', reconnectMs: 60_000, ...hostOpts });
  const guest = new OnlineSession({ role: 'guest', reconnectMs: 60_000 });
  const [a, b] = createMemoryPair();
  host.attachTransport(a);
  guest.attachTransport(b);
  await flush();
  return { host, guest, a, b };
}

describe('room codes', () => {
  it('generates 6-char codes without ambiguous characters', () => {
    for (let i = 0; i < 200; i++) {
      const c = generateCode();
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
  });
  it('normalises user input and rejects bad codes', () => {
    expect(normalizeCode(' abc-234 ')).toBe('ABC234');
    expect(normalizeCode('ABC23')).toBeNull();
    expect(normalizeCode('ABC0O1')).toBeNull();
  });
  it('builds a share link under a sub-path and reads it back', () => {
    const link = shareLink('ABC234', { origin: 'https://x.github.io', pathname: '/TriLine/', search: '' });
    expect(link).toBe('https://x.github.io/TriLine/#join=ABC234');
    expect(codeFromHash('#join=abc234')).toBe('ABC234');
    expect(codeFromHash('#join=bad')).toBeNull();
    expect(codeFromHash('')).toBeNull();
    expect(peerIdFor('ABC234')).toBe('peddadhadi-ABC234');
  });
});

describe('protocol validation', () => {
  it('accepts well-formed messages and rejects garbage', () => {
    expect(parseMessage({ t: 'action', action: { type: 'place', to: 3 }, n: 0 })).toEqual({
      t: 'action',
      action: { type: 'place', to: 3 },
      n: 0,
    });
    expect(parseMessage({ t: 'action', action: { type: 'place', to: 99 }, n: 0 })).toBeNull();
    expect(parseMessage({ t: 'action', action: { type: 'fly', to: 1 }, n: 0 })).toBeNull();
    expect(parseMessage({ t: 'nope' })).toBeNull();
    expect(parseMessage(null)).toBeNull();
    expect(parseMessage('hi')).toBeNull();
    expect(parseMessage({ t: 'chat', text: 5 })).toBeNull();
  });
  it('truncates long chat and validates states', () => {
    const m = parseMessage({ t: 'chat', text: 'x'.repeat(1000) });
    expect(m && m.t === 'chat' && m.text.length).toBe(300);
    const s = createInitialState(9);
    expect(parseState(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(parseState({ ...s, board: [] })).toBeNull();
    expect(parseState({ ...s, phase: 'gameover' })).toBeNull(); // gameover needs a result
    expect(parseState({ ...s, turn: 2 })).toBeNull();
  });
});

describe('online session', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('handshake sends config with colours and initial state', async () => {
    const { host, guest } = await connect({ pieces: 11, hostColor: 1 });
    expect(host.status).toBe('connected');
    expect(guest.status).toBe('connected');
    expect(guest.pieces).toBe(11);
    expect(guest.state.hand).toEqual([11, 11]);
    expect(host.myColor).toBe(1);
    expect(guest.myColor).toBe(0);
  });

  it('plays moves both ways and keeps states identical', async () => {
    const { host, guest } = await connect({ hostColor: 0 });
    expect(host.playLocal({ type: 'place', to: 0 })).toBe(true);
    await flush();
    expect(guest.state.board[0]).toBe(0);
    expect(guest.playLocal({ type: 'place', to: 8 })).toBe(true);
    await flush();
    expect(host.state).toEqual(guest.state);
    // Out of turn is refused locally.
    expect(guest.playLocal({ type: 'place', to: 5 })).toBe(false);
  });

  it('dhadi + removal flows between peers', async () => {
    const { host, guest } = await connect();
    const seq: [typeof host, { type: 'place'; to: number } | { type: 'remove'; at: number }][] = [
      [host, { type: 'place', to: 0 }],
      [guest, { type: 'place', to: 8 }],
      [host, { type: 'place', to: 1 }],
      [guest, { type: 'place', to: 9 }],
      [host, { type: 'place', to: 2 }],
      [host, { type: 'remove', at: 8 }],
    ];
    for (const [s, a] of seq) {
      expect(s.playLocal(a)).toBe(true);
      await flush();
    }
    expect(guest.state.lost).toEqual([0, 1]);
    expect(guest.state.turn).toBe(1);
    expect(host.state).toEqual(guest.state);
  });

  it('ignores illegal actions and re-syncs the guest from the host', async () => {
    const { host, guest, b } = await connect();
    // Host places; guest "cheats" by sending an action on the host's turn.
    host.playLocal({ type: 'place', to: 0 });
    await flush();
    const before = JSON.stringify(host.state);
    // guest sends place on an occupied point (illegal)
    b.send({ t: 'action', action: { type: 'place', to: 0 }, n: 1 });
    await flush();
    expect(JSON.stringify(host.state)).toBe(before);
    // out-of-sequence number is also ignored
    b.send({ t: 'action', action: { type: 'place', to: 5 }, n: 7 });
    await flush();
    expect(JSON.stringify(host.state)).toBe(before);
    expect(guest.state).toEqual(host.state);
  });

  it('guest desync is repaired by state-sync request', async () => {
    const { host, guest } = await connect();
    // Corrupt the guest's view.
    guest.state = createInitialState(9);
    guest.moveCount = 0;
    host.playLocal({ type: 'place', to: 0 }); // n=0 matches guest n, but guest state differs; legal anyway
    await flush();
    host.playLocal({ type: 'place', to: 3 }).valueOf(); // host's turn is over -> refused
    const guestMove = guest.playLocal({ type: 'place', to: 4 });
    await flush();
    expect(guestMove).toBe(true);
    // host applies guest's action (n=1 matches). States still consistent between engines:
    expect(host.moveCount).toBe(2);
    // Now force a mismatch by sending a bogus sequence number from guest
    const bogus = applyAction(createInitialState(9), { type: 'place', to: 2 });
    expect(bogus.board[2]).toBe(0);
    guest.moveCount = 99; // guest believes in a wrong count -> host ignores and syncs
    host.playLocal({ type: 'place', to: 6 });
    await flush();
    guest.playLocal({ type: 'place', to: 10 });
    await flush();
    expect(guest.state).toEqual(host.state);
    expect(guest.moveCount).toBe(host.moveCount);
  });

  it('chat, draw offer/accept and resign', async () => {
    const { host, guest } = await connect();
    const chats: string[] = [];
    guest.on('chat', (t) => chats.push(t));
    expect(host.sendChat('  hello  ')).toBe(true);
    expect(host.sendChat('   ')).toBe(false);
    await flush();
    expect(chats).toEqual(['hello']);

    const offers = vi.fn();
    guest.on('drawOffer', offers);
    host.offerDraw();
    await flush();
    expect(offers).toHaveBeenCalledOnce();
    guest.respondDraw(false);
    await flush();
    expect(host.drawOfferedByMe).toBe(false);
    host.offerDraw();
    await flush();
    guest.respondDraw(true);
    await flush();
    expect(host.state.result).toEqual({ winner: null, reason: 'agreed' });
    expect(guest.state.result).toEqual({ winner: null, reason: 'agreed' });
  });

  it('resign awards the win to the opponent on both sides', async () => {
    const { host, guest } = await connect({ hostColor: 0 });
    guest.resign();
    await flush();
    expect(host.state.result).toEqual({ winner: 0, reason: 'resign' });
    expect(guest.state.result).toEqual({ winner: 0, reason: 'resign' });
  });

  it('rematch needs both players and swaps colours', async () => {
    const { host, guest } = await connect({ hostColor: 0 });
    host.playLocal({ type: 'place', to: 0 });
    await flush();
    guest.resign();
    await flush();
    host.requestRematch();
    await flush();
    expect(host.state.phase).toBe('gameover'); // guest has not agreed yet
    expect(guest.rematchTheirs).toBe(true);
    guest.requestRematch();
    await flush();
    expect(host.state.phase).toBe('placing');
    expect(host.myColor).toBe(1);
    expect(guest.myColor).toBe(0);
    expect(guest.state).toEqual(host.state);
    expect(guest.moveCount).toBe(0);
    // Player 1 (light) moves first: now the guest.
    expect(guest.isMyTurn).toBe(true);
    expect(host.isMyTurn).toBe(false);
  });

  it('guest-initiated rematch also works', async () => {
    const { host, guest } = await connect({ hostColor: 0 });
    host.resign();
    await flush();
    guest.requestRematch();
    await flush();
    host.requestRematch();
    await flush();
    expect(guest.state.phase).toBe('placing');
    expect(guest.myColor).toBe(0);
  });

  it('disconnect, reconnect resumes with the current state', async () => {
    const { host, guest, a } = await connect();
    host.playLocal({ type: 'place', to: 0 });
    await flush();
    a.close();
    await flush();
    expect(host.status).toBe('disconnected');
    expect(guest.status).toBe('disconnected');
    expect(host.disconnectDeadline).not.toBeNull();
    expect(host.playLocal({ type: 'place', to: 1 })).toBe(false);
    // Guest reconnects with a fresh transport.
    const [a2, b2] = createMemoryPair();
    host.attachTransport(a2);
    guest.attachTransport(b2);
    await flush();
    expect(host.status).toBe('connected');
    expect(guest.status).toBe('connected');
    expect(guest.state).toEqual(host.state);
    expect(host.disconnectDeadline).toBeNull();
    vi.advanceTimersByTime(120_000);
    expect(host.state.phase).not.toBe('gameover');
  });

  it('awards the game after the reconnect window expires', async () => {
    const { host, a } = await connect({ hostColor: 0 });
    a.close();
    await flush();
    vi.advanceTimersByTime(59_000);
    expect(host.state.phase).not.toBe('gameover');
    vi.advanceTimersByTime(2_000);
    expect(host.state.result).toEqual({ winner: 0, reason: 'abandoned' });
  });

  it('rejects an incompatible protocol version', async () => {
    const host = new OnlineSession({ role: 'host' });
    const [a, b] = createMemoryPair();
    host.attachTransport(a);
    const errors: string[] = [];
    host.on('error', (e) => errors.push(e));
    b.send({ t: 'hello', v: 999 });
    await flush();
    expect(errors.length).toBe(1);
    expect(host.status).toBe('closed');
  });

  it('heartbeat drops a silent link', async () => {
    let now = 0;
    const host = new OnlineSession({ role: 'host', now: () => now });
    const guest = new OnlineSession({ role: 'guest', now: () => now });
    const [a, b] = createMemoryPair();
    host.attachTransport(a);
    guest.attachTransport(b);
    await flush();
    b.onMessage = null; // the guest goes silent (no pongs)
    for (let i = 0; i < 4; i++) {
      now += 5_000;
      host.tick();
      await flush();
    }
    expect(host.status).toBe('connected'); // 20 s of silence is still tolerated
    for (let i = 0; i < 3; i++) {
      now += 5_000;
      host.tick();
      await flush();
    }
    expect(host.status).toBe('disconnected');
  });
});
