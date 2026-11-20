import { describe, expect, it } from 'vitest';
import { ADJACENT, MILLS, MILLS_AT, NUM_POINTS, areAdjacent, pointGrid, pointIndex } from '../src/engine';

describe('board geometry', () => {
  it('has 24 points and 16 dhadis', () => {
    expect(NUM_POINTS).toBe(24);
    expect(MILLS.length).toBe(16);
  });

  it('has 12 square sides and 4 cross lines', () => {
    const cross = MILLS.filter((m) => Math.floor(m[0] / 8) !== Math.floor(m[2] / 8));
    expect(cross.length).toBe(4);
    for (const m of cross) {
      expect(m[0] % 8).toBe(m[1] % 8);
      expect(m[1] % 8).toBe(m[2] % 8);
      expect(m[0] % 2).toBe(1); // only through side midpoints
    }
  });

  it('every dhadi is three distinct, collinear points', () => {
    for (const m of MILLS) {
      expect(new Set(m).size).toBe(3);
      const g = m.map(pointGrid);
      const sameX = g.every((p) => p.x === g[0].x);
      const sameY = g.every((p) => p.y === g[0].y);
      expect(sameX || sameY).toBe(true);
    }
  });

  it('every point lies in exactly two dhadis', () => {
    for (let p = 0; p < 24; p++) expect(MILLS_AT[p].length).toBe(2);
  });

  it('adjacency is symmetric with expected degrees', () => {
    for (let a = 0; a < 24; a++) {
      for (const b of ADJACENT[a]) expect(ADJACENT[b]).toContain(a);
    }
    for (let p = 0; p < 24; p++) {
      const pos = p % 8;
      const ring = Math.floor(p / 8);
      const expected = pos % 2 === 0 ? 2 : ring === 1 ? 4 : 3;
      expect(ADJACENT[p].length).toBe(expected);
    }
    const edges = ADJACENT.reduce((n, l) => n + l.length, 0) / 2;
    expect(edges).toBe(32);
  });

  it('corners never connect between squares', () => {
    expect(areAdjacent(pointIndex(0, 0), pointIndex(1, 0))).toBe(false);
    expect(areAdjacent(pointIndex(0, 1), pointIndex(1, 1))).toBe(true);
    expect(areAdjacent(pointIndex(0, 1), pointIndex(2, 1))).toBe(false);
  });
});
