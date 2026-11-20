/** No 0/O/1/I so codes are easy to read out loud. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const PEER_PREFIX = 'peddadhadi-';

export function generateCode(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return s;
}

/** Upper-case, strip spaces/dashes; returns null if not a valid code. */
export function normalizeCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[\s-]/g, '');
  if (c.length !== CODE_LENGTH) return null;
  for (const ch of c) if (!ALPHABET.includes(ch)) return null;
  return c;
}

export const peerIdFor = (code: string): string => PEER_PREFIX + code;

/** Share link for the current page (no old hash). Works under any base path, e.g. /TriLine/. */
export function shareLink(code: string, loc: { origin: string; pathname: string; search: string }): string {
  return `${loc.origin}${loc.pathname}${loc.search}#join=${code}`;
}

/** Reads `#join=CODE` from a hash string. */
export function codeFromHash(hash: string): string | null {
  const m = /^#?join=([^&]+)/i.exec(hash);
  if (!m) return null;
  try {
    return normalizeCode(decodeURIComponent(m[1]));
  } catch {
    return null;
  }
}
