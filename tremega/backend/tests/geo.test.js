// tests/geo.test.js
// Pure geo math — no I/O, no mocks.

const { haversineM, geofenceCheck, validateCoords } = require('../src/services/geo');

const NYC = { lat: 40.7128, lng: -74.006 };
const BOSTON = { lat: 42.3601, lng: -71.0589 };

describe('haversineM', () => {
  test('NYC to Boston is ~306km (±2%)', () => {
    const d = haversineM(NYC.lat, NYC.lng, BOSTON.lat, BOSTON.lng);
    expect(d).toBeGreaterThan(306000 * 0.98);
    expect(d).toBeLessThan(306000 * 1.02);
  });

  test('same point is 0 meters', () => {
    expect(haversineM(NYC.lat, NYC.lng, NYC.lat, NYC.lng)).toBe(0);
  });

  test('is symmetric', () => {
    const ab = haversineM(NYC.lat, NYC.lng, BOSTON.lat, BOSTON.lng);
    const ba = haversineM(BOSTON.lat, BOSTON.lng, NYC.lat, NYC.lng);
    expect(ab).toBeCloseTo(ba, 6);
  });
});

describe('validateCoords', () => {
  test('accepts valid numbers and normalizes numeric strings', () => {
    expect(validateCoords(40.7, -74)).toEqual({ lat: 40.7, lng: -74 });
    expect(validateCoords('40.7', '-74')).toEqual({ lat: 40.7, lng: -74 });
    expect(validateCoords(0, 0)).toEqual({ lat: 0, lng: 0 });
  });

  test('rejects out-of-range / non-finite / wrong-type values', () => {
    expect(validateCoords(91, 0)).toBeNull();
    expect(validateCoords(-91, 0)).toBeNull();
    expect(validateCoords(0, 181)).toBeNull();
    expect(validateCoords(0, -181)).toBeNull();
    expect(validateCoords(NaN, 0)).toBeNull();
    expect(validateCoords(Infinity, 0)).toBeNull();
    expect(validateCoords(null, 0)).toBeNull();
    expect(validateCoords(undefined, 0)).toBeNull();
    expect(validateCoords(true, 0)).toBeNull();
    expect(validateCoords('abc', 0)).toBeNull();
  });
});

describe('geofenceCheck', () => {
  const fence = { lat: 40.0, lng: -74.0, radius_m: 500 };

  test('point well inside -> inside, high confidence, no reasons', () => {
    const r = geofenceCheck({ lat: 40.001, lng: -74.001 }, fence, 10);
    expect(r.inside).toBe(true);
    expect(r.confidence).toBe('high');
    expect(r.reasons).toEqual([]);
    expect(r.distance_m).toBeGreaterThan(100);
    expect(r.distance_m).toBeLessThan(200);
    expect(r.radius_m).toBe(500);
  });

  test('point far outside -> inside false, high confidence', () => {
    const r = geofenceCheck({ lat: 40.05, lng: -74.05 }, fence, 10); // ~6.8km away
    expect(r.inside).toBe(false);
    expect(r.confidence).toBe('high');
    expect(r.reasons).toEqual([]);
  });

  test('distance exactly on the radius -> inside, boundary, low confidence', () => {
    const point = { lat: 40.002, lng: -74.003 };
    const exactRadius = haversineM(fence.lat, fence.lng, point.lat, point.lng);
    const r = geofenceCheck(point, { ...fence, radius_m: exactRadius }, 0);
    expect(r.inside).toBe(true);
    expect(r.confidence).toBe('low');
    expect(r.reasons).toContain('boundary');
  });

  test('beyond radius but within accuracy band -> inside, boundary, low confidence', () => {
    // ~120m from center with a 100m fence and 50m accuracy: 120 <= 100 + 50.
    const point = { lat: 40.0009, lng: -74.0006 };
    const d = haversineM(fence.lat, fence.lng, point.lat, point.lng);
    expect(d).toBeGreaterThan(100);
    const r = geofenceCheck(point, { ...fence, radius_m: 100 }, 50);
    expect(r.inside).toBe(true);
    expect(r.confidence).toBe('low');
    expect(r.reasons).toContain('boundary');
  });

  test('accuracy over 100m downgrades to low confidence with reason', () => {
    const r = geofenceCheck({ lat: 40.001, lng: -74.001 }, fence, 150);
    expect(r.inside).toBe(true);
    expect(r.confidence).toBe('low');
    expect(r.reasons).toContain('accuracy_exceeds_100m');
  });

  test('accuracy of exactly 100m stays high confidence', () => {
    const r = geofenceCheck({ lat: 40.0001, lng: -74.0001 }, fence, 100);
    expect(r.inside).toBe(true);
    expect(r.confidence).toBe('high');
  });

  test('missing accuracy is treated as 0 (no downgrade)', () => {
    const r = geofenceCheck({ lat: 40.0001, lng: -74.0001 }, fence);
    expect(r.inside).toBe(true);
    expect(r.confidence).toBe('high');
  });

  test('null/invalid coords -> INVALID_COORDS structured error, never throws', () => {
    const cases = [
      [null, fence],
      [undefined, fence],
      [{}, fence],
      [{ lat: 91, lng: 0 }, fence],
      [{ lat: 0, lng: -181 }, fence],
      [{ lat: NaN, lng: 0 }, fence],
      [{ lat: 40, lng: -74 }, null],
      [{ lat: 40, lng: -74 }, { lat: 40, lng: -74 }],
      [{ lat: 40, lng: -74 }, { lat: 40, lng: -74, radius_m: 0 }],
      [{ lat: 40, lng: -74 }, { lat: 40, lng: -74, radius_m: -5 }],
      [{ lat: 40, lng: -74 }, { lat: 40, lng: -74, radius_m: 'abc' }],
    ];
    cases.forEach(([point, f]) => {
      let r;
      expect(() => {
        r = geofenceCheck(point, f, 10);
      }).not.toThrow();
      expect(r.inside).toBe(false);
      expect(r.error).toBeDefined();
      expect(r.error.code).toBe('INVALID_COORDS');
    });
  });
});
