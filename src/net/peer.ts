import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { generateCode, peerIdFor } from './roomCode';
import type { Transport } from './transport';

export type NetErrorKind = 'unreachable' | 'unknown-code' | 'failed';

export class NetError extends Error {
  constructor(
    public kind: NetErrorKind,
    message?: string,
  ) {
    super(message ?? describeNetError(kind));
  }
}

export function describeNetError(kind: NetErrorKind): string {
  switch (kind) {
    case 'unknown-code':
      return 'No game found with that code. Check the code, and make sure the host still has the game open.';
    case 'unreachable':
      return "Couldn't reach the matchmaking server (PeerJS). Check your internet connection and try again.";
    case 'failed':
      return "Couldn't connect to the other player. Some networks (corporate Wi-Fi, some mobile carriers) block direct peer-to-peer connections. Try a different network.";
  }
}

function toNetError(err: unknown): NetError {
  const type = (err as { type?: string } | null)?.type;
  switch (type) {
    case 'peer-unavailable':
      return new NetError('unknown-code');
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return new NetError('unreachable');
    default:
      return new NetError('failed');
  }
}

const OPEN_TIMEOUT_MS = 12_000;

/** Wrap a PeerJS data connection as a Transport. */
function wrapConnection(conn: DataConnection): Transport {
  const t: Transport = {
    onMessage: null,
    onClose: null,
    send: (data) => conn.send(data),
    close: () => conn.close(),
  };
  conn.on('data', (d) => t.onMessage?.(d));
  let closed = false;
  const fireClose = () => {
    if (closed) return;
    closed = true;
    t.onClose?.();
  };
  conn.on('close', fireClose);
  conn.on('error', fireClose);
  // Underlying ICE connection dying does not always emit 'close' promptly.
  const pc = (conn as unknown as { peerConnection?: RTCPeerConnection }).peerConnection;
  pc?.addEventListener('iceconnectionstatechange', () => {
    if (pc.iceConnectionState === 'closed' || pc.iceConnectionState === 'failed') fireClose();
  });
  return t;
}

/** What the voice layer needs from a room. */
export interface PeerEndpoint {
  getPeer(): Peer | null;
  remoteId(): string | null;
  onCall: ((call: MediaConnection) => void) | null;
}

function openPeer(id?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id) : new Peer();
    const timer = setTimeout(() => {
      peer.destroy();
      reject(new NetError('unreachable'));
    }, OPEN_TIMEOUT_MS);
    peer.on('open', () => {
      clearTimeout(timer);
      resolve(peer);
    });
    peer.on('error', (err) => {
      clearTimeout(timer);
      peer.destroy();
      reject(Object.assign(toNetError(err), { peerType: (err as { type?: string }).type }));
    });
  });
}

export interface HostRoom extends PeerEndpoint {
  code: string;
  destroy(): void;
}

/**
 * Register as the host under `peddadhadi-<CODE>`. Regenerates the code if the id is taken.
 * `onConnection` fires for every (re)connection from the guest.
 */
export async function createHostRoom(onConnection: (t: Transport) => void): Promise<HostRoom> {
  let peer: Peer | null = null;
  let code = '';
  for (let attempt = 0; attempt < 6; attempt++) {
    code = generateCode();
    try {
      peer = await openPeer(peerIdFor(code));
      break;
    } catch (e) {
      const type = (e as { peerType?: string }).peerType;
      if (type === 'unavailable-id' && attempt < 5) continue;
      throw e;
    }
  }
  if (!peer) throw new NetError('failed');
  const live = peer;
  let destroyed = false;
  let remote: string | null = null;

  const room: HostRoom = {
    code,
    getPeer: () => live,
    remoteId: () => remote,
    onCall: null,
    destroy() {
      destroyed = true;
      live.destroy();
    },
  };
  live.on('connection', (conn) => {
    conn.on('open', () => {
      remote = conn.peer;
      onConnection(wrapConnection(conn));
    });
  });
  live.on('call', (call) => room.onCall?.(call));
  // Keep the code registered with the broker if the signalling link drops.
  live.on('disconnected', () => {
    const retry = () => {
      if (destroyed || live.destroyed) return;
      if (live.disconnected) live.reconnect();
      setTimeout(() => {
        if (!destroyed && !live.destroyed && live.disconnected) retry();
      }, 3000);
    };
    setTimeout(retry, 1000);
  });
  live.on('error', () => {
    /* connection-level problems surface through the transports */
  });
  return room;
}

export interface GuestLinkHandlers {
  /** Called for the first connection and for every successful reconnect. */
  onTransport(t: Transport): void;
}

/** Joins a host by code and keeps trying to reconnect (3 s apart) after the link drops. */
export class GuestLink implements PeerEndpoint {
  onCall: ((call: MediaConnection) => void) | null = null;
  private peer: Peer | null = null;
  private stopped = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private errorHandler: ((err: unknown) => void) | null = null;
  private readonly hostId: string;

  constructor(
    readonly code: string,
    private handlers: GuestLinkHandlers,
  ) {
    this.hostId = peerIdFor(code);
  }

  getPeer(): Peer | null {
    return this.peer;
  }
  remoteId(): string | null {
    return this.hostId;
  }

  /** Resolves when connected; rejects with a NetError describing why not. */
  async connect(): Promise<void> {
    const t = await this.connectOnce();
    this.deliver(t);
  }

  private deliver(t: Transport): void {
    const prevClose = t.onClose;
    // The session installs its own onClose after onTransport; we watch via a wrapper.
    this.handlers.onTransport(t);
    const sessionClose = t.onClose ?? prevClose;
    t.onClose = () => {
      sessionClose?.();
      this.scheduleRetry();
    };
  }

  private async ensurePeer(): Promise<Peer> {
    const existing = this.peer;
    if (existing && !existing.destroyed) {
      if (!existing.disconnected) return existing;
      // Signalling link dropped (e.g. network change): re-register and wait for it.
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new NetError('unreachable')), 8000);
        existing.once('open', () => {
          clearTimeout(timer);
          resolve();
        });
        existing.reconnect();
      });
      return existing;
    }
    const peer = await openPeer();
    peer.on('call', (call) => this.onCall?.(call));
    peer.on('error', (err) => this.errorHandler?.(err));
    this.peer = peer;
    return peer;
  }

  private async connectOnce(): Promise<Transport> {
    const peer = await this.ensurePeer();
    return new Promise<Transport>((resolve, reject) => {
      let done = false;
      const finish = (fn: () => void) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.errorHandler = null;
        fn();
      };
      const conn = peer.connect(this.hostId, { reliable: true });
      const timer = setTimeout(
        () =>
          finish(() => {
            conn.close();
            reject(new NetError('failed'));
          }),
        OPEN_TIMEOUT_MS,
      );
      this.errorHandler = (err) => finish(() => reject(toNetError(err)));
      conn.on('open', () => finish(() => resolve(wrapConnection(conn))));
      conn.on('error', (err) => finish(() => reject(toNetError(err))));
    });
  }

  private scheduleRetry(): void {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;
      if (this.stopped) return;
      try {
        const t = await this.connectOnce();
        if (this.stopped) {
          t.close();
          return;
        }
        this.deliver(t);
      } catch {
        this.scheduleRetry();
      }
    }, 3000);
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.peer?.destroy();
  }
}
