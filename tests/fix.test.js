import { leastSquaresFix } from '../js/fix.js';

test('leastSquaresFix: two perpendicular LOPs give exact fix', () => {
  // LOP 1: Zn = 0° (north), intercept = +5 nm → fix is 5nm north of AP
  // LOP 2: Zn = 90° (east), intercept = +3 nm → fix is 3nm east of AP
  const lops = [
    { intercept_nm: 5, Zn: 0, starName: 'Star1' },
    { intercept_nm: 3, Zn: 90, starName: 'Star2' }
  ];
  const ap = { lat: 34, lon: -118 };
  const fix = leastSquaresFix(lops, ap);
  assert(fix !== null, 'fix should not be null');
  assertNear(fix.dLat_nm, 5, 0.01, 'dLat should be 5nm');
  assertNear(fix.dLon_nm, 3, 0.01, 'dLon should be 3nm');
  // 5nm north = 5/60 degrees
  assertNear(fix.lat, 34 + 5/60, 0.001, 'fix lat');
  // 3nm east at lat 34 = 3/(60*cos(34°)) degrees
  const lonOffset = 3 / (60 * Math.cos(34 * Math.PI / 180));
  assertNear(fix.lon, -118 + lonOffset, 0.001, 'fix lon');
});

test('leastSquaresFix: fix at AP when intercepts are zero', () => {
  const lops = [
    { intercept_nm: 0, Zn: 45, starName: 'A' },
    { intercept_nm: 0, Zn: 135, starName: 'B' }
  ];
  const fix = leastSquaresFix(lops, { lat: 34, lon: -118 });
  assert(fix !== null);
  assertNear(fix.dLat_nm, 0, 0.01);
  assertNear(fix.dLon_nm, 0, 0.01);
});

test('leastSquaresFix: returns null for parallel LOPs', () => {
  // Two LOPs with same azimuth = no unique fix
  const lops = [
    { intercept_nm: 5, Zn: 90, starName: 'A' },
    { intercept_nm: 3, Zn: 90, starName: 'B' }
  ];
  const fix = leastSquaresFix(lops, { lat: 34, lon: -118 });
  assert(fix === null, 'parallel LOPs should return null');
});

test('leastSquaresFix: returns null for nearly parallel LOPs (<15°)', () => {
  const lops = [
    { intercept_nm: 5, Zn: 90, starName: 'A' },
    { intercept_nm: 3, Zn: 100, starName: 'B' }
  ];
  const fix = leastSquaresFix(lops, { lat: 34, lon: -118 });
  assert(fix === null, 'nearly parallel LOPs should return null');
});

test('leastSquaresFix: three LOPs overdetermined', () => {
  // Three LOPs that all agree on the same point
  const lops = [
    { intercept_nm: 5, Zn: 0, starName: 'A' },
    { intercept_nm: 3, Zn: 90, starName: 'B' },
    { intercept_nm: 0, Zn: 45, starName: 'C' }
  ];
  const fix = leastSquaresFix(lops, { lat: 34, lon: -118 });
  assert(fix !== null);
  assert(fix.residuals.length === 3, 'should have 3 residuals');
  assert(isFinite(fix.confidence), 'confidence should be finite');
});
