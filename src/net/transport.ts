/** Minimal message pipe; PeerJS connections and the in-memory test transport both implement it. */
export interface Transport {
  send(data: unknown): void;
  close(): void;
  onMessage: ((data: unknown) => void) | null;
  onClose: (() => void) | null;
}

class MemoryEnd implements Transport {
  onMessage: ((data: unknown) => void) | null = null;
  onClose: (() => void) | null = null;
  peer!: MemoryEnd;
  closed = false;

  send(data: unknown): void {
    if (this.closed) return;
    // Round-trip through JSON like a real wire, delivered asynchronously.
    const copy = JSON.parse(JSON.stringify(data));
    queueMicrotask(() => {
      if (!this.peer.closed) this.peer.onMessage?.(copy);
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    queueMicrotask(() => {
      const other = this.peer;
      if (!other.closed) {
        other.closed = true;
        other.onClose?.();
      }
      this.onClose?.();
    });
  }
}

/** Two connected in-memory transports (for tests). */
export function createMemoryPair(): [Transport, Transport] {
  const a = new MemoryEnd();
  const b = new MemoryEnd();
  a.peer = b;
  b.peer = a;
  return [a, b];
}
