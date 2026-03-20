import { equatorialToAltAz, visibleStars } from '../js/altitude.js';
import { CAT } from '../js/catalog.js';

test('equatorialToAltAz: Polaris from mid-latitudes is circumpolar near latitude', () => {
  // Polaris altitude ≈ observer latitude (not dec). From 40°N, alt ≈ 40°.
  const { alt_d, az_d } = equatorialToAltAz(2.53, 89.26, 40, -74, new Date('2025-06-15T00:00:00Z'));
  assert(alt_d > 30 && alt_d < 50, `Polaris alt should be ~40° from 40°N, got ${alt_d}`);
});

test('equatorialToAltAz: star below horizon has negative alt', () => {
  // Sirius (Dec ~-16.7°) from lat 89°N should be below horizon
  const { alt_d } = equatorialToAltAz(6.75, -16.72, 89, 0, new Date('2025-06-15T12:00:00Z'));
  assert(alt_d < 0, `Sirius from north pole should be below horizon, got ${alt_d}`);
});

test('visibleStars filters to above-horizon only', () => {
  const ap = { lat: 40, lon: -74 };
  const utc = new Date('2025-06-15T03:00:00Z');
  const stars = visibleStars(ap, utc);
  assert(stars.length > 0, 'Should have some visible stars');
  assert(stars.length < Object.keys(CAT).length, 'Should not have all catalog stars visible');
  assert(stars.every(s => s.alt > 0), 'All returned stars should have positive altitude');
  // Should be sorted by altitude descending
  for (let i = 1; i < stars.length; i++) {
    assert(stars[i].alt <= stars[i-1].alt, 'Should be sorted by altitude descending');
  }
});
