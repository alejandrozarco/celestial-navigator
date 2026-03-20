import { gha, lha, calcHcZn, sightReduce, magToTrue } from '../js/sight-reduction.js';

test('gha returns 0-360 range', () => {
  const g = gha(new Date('2025-06-15T00:00:00Z'), 101.29); // Sirius RA in degrees
  assert(g >= 0 && g < 360, `GHA out of range: ${g}`);
});

test('lha with east longitude adds', () => {
  assertNear(lha(90, 30), 120, 0.001);
});

test('lha with west longitude subtracts', () => {
  assertNear(lha(90, -30), 60, 0.001);
});

test('lha normalizes to 0-360', () => {
  assertNear(lha(350, 20), 10, 0.001);
  assertNear(lha(10, -20), 350, 0.001);
});

test('calcHcZn: Polaris from 40N has high altitude, Zn near 0/360', () => {
  const g = gha(new Date('2025-06-15T00:00:00Z'), 37.95);
  const { Hc_deg, Zn_deg } = calcHcZn(40, -74, 89.26, g);
  assert(Hc_deg > 80, `Polaris Hc should be >80°, got ${Hc_deg}`);
  assert(Zn_deg < 5 || Zn_deg > 355, `Polaris Zn should be near north, got ${Zn_deg}`);
});

test('sightReduce produces valid intercept', () => {
  const star = { name: 'Sirius', ra: 101.29, dec: -16.72 };
  const ap = { lat: 34, lon: -118 };
  const utc = new Date('2025-12-15T04:00:00Z');
  const Ho = 30.0;
  const result = sightReduce(star, Ho, utc, ap, 0);
  assert(isFinite(result.intercept_nm), 'intercept should be finite');
  assert(result.Zn >= 0 && result.Zn < 360, 'Zn in range');
  assert(isFinite(result.Hc), 'Hc should be finite');
  assertNear(result.Ho, 30.0, 0.001, 'Ho should match input');
  assert(result.starName === 'Sirius', 'star name');
});

test('magToTrue: east declination adds', () => {
  assertNear(magToTrue(180, 10), 190, 0.001);
});

test('magToTrue: west declination subtracts', () => {
  assertNear(magToTrue(180, -10), 170, 0.001);
});

test('magToTrue normalizes', () => {
  assertNear(magToTrue(355, 10), 5, 0.001);
});

test('sightReduce includes trueBearing when magBearing provided', () => {
  const star = { name: 'Sirius', ra: 101.29, dec: -16.72 };
  const result = sightReduce(star, 30, new Date('2025-12-15T04:00:00Z'), {lat:34,lon:-118}, 12, 200);
  assertNear(result.trueBearing, 212, 0.001, 'trueBearing = magBearing + magDecl');
});

test('sightReduce trueBearing is null when no magBearing', () => {
  const star = { name: 'Sirius', ra: 101.29, dec: -16.72 };
  const result = sightReduce(star, 30, new Date('2025-12-15T04:00:00Z'), {lat:34,lon:-118}, 0);
  assert(result.trueBearing === null, 'trueBearing should be null');
});
