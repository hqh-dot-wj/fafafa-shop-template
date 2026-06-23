import { haversineDistanceMeters } from './haversine-distance-meters';

describe('haversineDistanceMeters', () => {
  it('同一点距离为 0', () => {
    expect(haversineDistanceMeters(28.2, 112.9, 28.2, 112.9)).toBe(0);
  });

  it('相近两点距离在百米量级（与球面公式一致）', () => {
    const m = haversineDistanceMeters(28, 112, 28.001, 112);
    expect(m).toBeGreaterThan(100);
    expect(m).toBeLessThan(120);
  });
});
