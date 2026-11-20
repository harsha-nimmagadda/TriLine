/**
 * Plays AI levels against each other and prints win/loss/draw tables.
 * Usage: npm run ai-ladder [-- --games 40 --hard-ms 150 --max-plies 300 --seed 1 --only easy|medium|hard]
 */
import { chooseAction, Difficulty } from '../src/ai';
import { Action, GameState, Player, applyAction, createInitialState, legalActions } from '../src/engine';

declare const process: { argv: string[] };

type Mover = (s: GameState, rng: () => number) => Action;

function arg(name: string, def: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
}
const GAMES = arg('games', 40);
const HARD_MS = arg('hard-ms', 150);
const MAX_PLIES = arg('max-plies', 300);
const SEED = arg('seed', 1);

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random: Mover = (s, rng) => {
  const a = legalActions(s);
  return a[Math.floor(rng() * a.length)];
};
const level =
  (d: Difficulty): Mover =>
  (s, rng) =>
    chooseAction(s, d, d === 'hard' ? { rng, timeMs: HARD_MS } : { rng });

const PLAYERS: Record<string, Mover> = {
  random,
  easy: level('easy'),
  medium: level('medium'),
  hard: level('hard'),
};

/** Returns winner index among (a, b): 0 = a, 1 = b, null = draw. */
function playGame(a: Mover, b: Mover, aIsLight: boolean, rng: () => number): 0 | 1 | null {
  let s = createInitialState(9);
  const movers: Record<Player, Mover> = aIsLight ? { 0: a, 1: b } : { 0: b, 1: a };
  let plies = 0;
  while (s.phase !== 'gameover' && plies < MAX_PLIES) {
    s = applyAction(s, movers[s.turn](s, rng));
    plies++;
  }
  const r = s.result;
  if (!r || r.winner === null) return null;
  const aColor: Player = aIsLight ? 0 : 1;
  return r.winner === aColor ? 0 : 1;
}

const pairings: [string, string][] = [
  ['easy', 'random'],
  ['medium', 'easy'],
  ['hard', 'medium'],
];

const rng = mulberry(SEED);
console.log(`Games per pairing: ${GAMES} (colours alternate), Hard time cap ${HARD_MS} ms/move, ${MAX_PLIES}-ply cap\n`);
console.log('Pairing           Win   Loss  Draw  Win%   (stronger listed first)');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
for (const [x, y] of pairings) {
  if (only && x !== only) continue;
  let w = 0;
  let l = 0;
  let d = 0;
  const t0 = Date.now();
  for (let g = 0; g < GAMES; g++) {
    const r = playGame(PLAYERS[x], PLAYERS[y], g % 2 === 0, rng);
    if (r === 0) w++;
    else if (r === 1) l++;
    else d++;
  }
  const pct = ((w / GAMES) * 100).toFixed(0);
  console.log(
    `${(x + ' vs ' + y).padEnd(17)} ${String(w).padStart(3)}   ${String(l).padStart(4)}  ${String(d).padStart(4)}  ${pct.padStart(3)}%   (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
  );
}
