/**
 * Board geometry for Pedda Dhadi.
 *
 * 24 points on three concentric squares. Point index = ring * 8 + pos where
 * ring 0 is the outer square, 2 the inner one, and pos goes clockwise from the
 * top-left corner:
 *
 *   0 --- 1 --- 2
 *   |           |
 *   7           3
 *   |           |
 *   6 --- 5 --- 4
 *
 * Lines connect the three squares only through the side midpoints (odd pos).
 */

export const NUM_POINTS = 24;
export const NUM_RINGS = 3;

export type Mill = readonly [number, number, number];

export const pointIndex = (ring: number, pos: number): number => ring * 8 + pos;

function buildMills(): Mill[] {
  const mills: Mill[] = [];
  // Each side of each square: corner - midpoint - corner.
  for (let ring = 0; ring < NUM_RINGS; ring++) {
    for (let side = 0; side < 4; side++) {
      const a = pointIndex(ring, side * 2);
      const b = pointIndex(ring, side * 2 + 1);
      const c = pointIndex(ring, (side * 2 + 2) % 8);
      mills.push([a, b, c]);
    }
  }
  // The four cross-lines through the side midpoints.
  for (const pos of [1, 3, 5, 7]) {
    mills.push([pointIndex(0, pos), pointIndex(1, pos), pointIndex(2, pos)]);
  }
  return mills;
}

/** All 16 possible dhadis (mills). */
export const MILLS: readonly Mill[] = buildMills();

function buildAdjacency(): number[][] {
  const adj: number[][] = Array.from({ length: NUM_POINTS }, () => []);
  const link = (a: number, b: number) => {
    adj[a].push(b);
    adj[b].push(a);
  };
  for (let ring = 0; ring < NUM_RINGS; ring++) {
    for (let pos = 0; pos < 8; pos++) {
      link(pointIndex(ring, pos), pointIndex(ring, (pos + 1) % 8));
    }
  }
  for (const pos of [1, 3, 5, 7]) {
    link(pointIndex(0, pos), pointIndex(1, pos));
    link(pointIndex(1, pos), pointIndex(2, pos));
  }
  return adj.map((list) => list.sort((x, y) => x - y));
}

/** ADJACENT[i] lists the points a piece on i may slide to. */
export const ADJACENT: readonly (readonly number[])[] = buildAdjacency();

/** MILLS_AT[i] lists indices into MILLS of the mills that contain point i. */
export const MILLS_AT: readonly (readonly number[])[] = Array.from({ length: NUM_POINTS }, (_, p) =>
  MILLS.map((m, i) => (m.includes(p) ? i : -1)).filter((i) => i >= 0),
);

export function areAdjacent(a: number, b: number): boolean {
  return ADJACENT[a].includes(b);
}

/** Logical grid position of a point, each coordinate in -3..3 (centre = 0,0). */
export function pointGrid(p: number): { x: number; y: number } {
  const ring = Math.floor(p / 8);
  const pos = p % 8;
  const d = 3 - ring;
  const table: [number, number][] = [
    [-d, -d],
    [0, -d],
    [d, -d],
    [d, 0],
    [d, d],
    [0, d],
    [-d, d],
    [-d, 0],
  ];
  const [x, y] = table[pos];
  return { x, y };
}
