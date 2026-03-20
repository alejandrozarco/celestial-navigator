import { D2R, R2D, nrm, clamp, gmst, angSep, zenithFix, solve3x3 } from '../js/math.js';

test('D2R and R2D are inverses', () => {
  assertNear(45 * D2R * R2D, 45, 1e-10);
});

test('nrm normalizes to 0-360', () => {
  assertNear(nrm(370), 10, 1e-10);
  assertNear(nrm(-10), 350, 1e-10);
  assertNear(nrm(0), 0, 1e-10);
});

test('clamp works', () => {
  assert(clamp(5, 0, 10) === 5);
  assert(clamp(-1, 0, 10) === 0);
  assert(clamp(11, 0, 10) === 10);
});

test('gmst returns degrees 0-360', () => {
  // J2000.0 epoch: 2000-01-01T12:00:00Z → GMST ≈ 280.46°
  const j2000 = new Date('2000-01-01T12:00:00Z');
  const g = gmst(j2000);
  assertNear(g, 280.46, 0.1, 'GMST at J2000');
  assert(g >= 0 && g < 360, 'GMST in range');
});

test('angSep of same point is 0', () => {
  assertNear(angSep(6.0, 45.0, 6.0, 45.0), 0, 1e-10);
});

test('angSep of poles is 180', () => {
  assertNear(angSep(0, 90, 0, -90), 180, 0.01);
});

test('angSep Polaris to Sirius', () => {
  // Polaris: RA ~2.53h, Dec ~89.26° ; Sirius: RA ~6.75h, Dec ~-16.72°
  const sep = angSep(2.53, 89.26, 6.75, -16.72);
  assertNear(sep, 105.9, 0.5, 'Polaris-Sirius separation');
});

test('zenithFix: returned lon is in [-180, 180]', () => {
  const date = new Date('2025-06-15T00:00:00Z');
  const result = zenithFix(2.0, 45.0, date);
  assert(result.lon >= -180 && result.lon <= 180, `lon ${result.lon} out of range`);
  assertNear(result.lat, 45.0, 0.001, 'lat equals dec');
});

test('solve3x3: solves known system', () => {
  // Identity matrix: solution = b
  const M = [1,0,0, 0,1,0, 0,0,1];
  const b = [3, 7, -2];
  const x = solve3x3(M, b);
  assertNear(x[0], 3, 1e-10);
  assertNear(x[1], 7, 1e-10);
  assertNear(x[2], -2, 1e-10);
});

test('solve3x3: returns null for singular matrix', () => {
  // Rows 1 and 2 are identical → singular
  const M = [1,2,3, 1,2,3, 0,0,1];
  const result = solve3x3(M, [1, 1, 0]);
  assert(result === null, 'singular matrix should return null');
});
