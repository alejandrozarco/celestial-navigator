# Dual-Mode Celestial Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-mode celestial navigation app (Photo Nav + Sight Reduction) with shared d3 nav chart and least-squares fix calculation, modularized from the existing monolithic `celestial-nav-v3.html`.

**Architecture:** ES modules (no build step) with centralized state store. Photo Nav mode extracts from the existing monolith; Sight Reduction mode is new. Both modes feed into a shared `lops[] → fix → nav-chart` pipeline. The d3 Mercator nav chart replaces Leaflet.

**Tech Stack:** Vanilla JS ES modules, d3 v7 (ESM CDN), EXIF.js (CDN). Browser-based test harness (no Node required).

**Spec:** `docs/superpowers/specs/2026-03-20-dual-mode-nav-design.md`
**Existing monolith:** `celestial-nav-v3.html` (source for extraction)
**Prior redesign spec:** `docs/superpowers/specs/2026-03-19-celestial-nav-redesign.md`

---

## File Map

| File | Responsibility | Source |
|------|----------------|--------|
| `js/math.js` | D2R, R2D, nrm, clamp, gmst, zenithFix, solve3x3, angSep | Extract from monolith lines 381-391, 406 |
| `js/catalog.js` | 58 nav stars, constellation lines | Extract from monolith |
| `js/altitude.js` | equatorialToAltAz, visibleStars | Extract from monolith line 745-763, new visibleStars |
| `js/sight-reduction.js` | gha, lha, calcHcZn, sightReduce, magToTrue | New, formulas from spec |
| `js/fix.js` | leastSquaresFix | New, inspired by monolith altitudeFix (line 1110) |
| `js/nav-chart.js` | d3 Mercator chart with LOPs, CoEA, fix | New |
| `js/state.js` | Centralized pub/sub store | New |
| `js/plate-solve.js` | plateSolve, projectToPixel, pixelToSky | Extract from monolith lines 396-440 |
| `js/detection.js` | detectBrightSpots | Extract from monolith |
| `js/auto-id.js` | buildCatalogHash, runAutoID | Extract from monolith |
| `js/overlay.js` | SVG overlay on sky image | Extract from monolith line 769+ |
| `js/ui.js` | DOM manipulation, tab switching, obs table | New + extract |
| `js/app.js` | Entry point, computePipeline, wiring | New |
| `index.html` | HTML shell + CSS + dual-mode layout | New (CSS from monolith) |
| `test.html` | Browser-based test harness | New |

**Build order:** Pure math first → domain logic → visualization → UI → wiring. Each task produces independently testable output.

---

### Task 1: math.js — Core Math Utilities

**Files:**
- Create: `js/math.js`
- Create: `test.html`

- [ ] **Step 1: Create test.html harness**

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Celestial Nav Tests</title>
<style>
body{font-family:monospace;background:#0a0a1a;color:#ccc;padding:20px}
.pass{color:#4f4}
.fail{color:#f44}
#results{white-space:pre-wrap}
</style></head><body>
<h2>Celestial Nav — Tests</h2>
<div id="results"></div>
<script type="module">
const el = document.getElementById('results');
let pass = 0, fail = 0;
window.test = (name, fn) => {
  try { fn(); pass++; el.innerHTML += `<span class="pass">✓ ${name}</span>\n`; }
  catch(e){ fail++; el.innerHTML += `<span class="fail">✗ ${name}: ${e.message}</span>\n`; }
};
window.assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
window.assertNear = (a, b, tol, msg) => {
  if (Math.abs(a - b) > (tol || 0.001)) throw new Error(`${msg || ''} expected ${b}, got ${a} (tol ${tol})`);
};
window.runTests = () => el.innerHTML += `\n─── ${pass} passed, ${fail} failed ───\n`;

// Test modules will be imported below as tasks add them
import('./tests/math.test.js').then(() =>
  import('./tests/sight-reduction.test.js').catch(() => {})
).then(() =>
  import('./tests/fix.test.js').catch(() => {})
).then(() => runTests()).catch(e => el.innerHTML += `\nLoad error: ${e.message}\n`);
</script></body></html>
```

- [ ] **Step 2: Create math tests**

Create `tests/math.test.js`:

```js
import { D2R, R2D, nrm, clamp, gmst, angSep } from '../js/math.js';

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
```

- [ ] **Step 3: Run test.html in browser, verify tests fail (math.js missing)**

Open `test.html` via a local HTTP server. Expected: load error for `math.js`.

- [ ] **Step 4: Implement math.js**

Create `js/math.js` (extracted from monolith lines 381-391, 406):

```js
export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;
export const nrm = a => ((a % 360) + 360) % 360;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function gmst(date) {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T = (JD - 2451545.0) / 36525;
  return nrm(280.46061837 + 360.98564736629 * (JD - 2451545.0)
    + 0.000387933 * T * T - T * T * T / 38710000);
}

export function zenithFix(ra_h, dec_d, date) {
  let lon = nrm(ra_h * 15) - gmst(date);
  lon = ((lon + 180) % 360 + 360) % 360 - 180;
  return { lat: dec_d, lon };
}

export function solve3x3(M, b) {
  const d = M[0]*(M[4]*M[8]-M[5]*M[7]) - M[1]*(M[3]*M[8]-M[5]*M[6]) + M[2]*(M[3]*M[7]-M[4]*M[6]);
  if (Math.abs(d) < 1e-14) return null;
  return [
    (b[0]*(M[4]*M[8]-M[5]*M[7]) - M[1]*(b[1]*M[8]-M[5]*b[2]) + M[2]*(b[1]*M[7]-M[4]*b[2])) / d,
    (M[0]*(b[1]*M[8]-M[5]*b[2]) - b[0]*(M[3]*M[8]-M[5]*M[6]) + M[2]*(M[3]*b[2]-b[1]*M[6])) / d,
    (M[0]*(M[4]*b[2]-b[1]*M[7]) - M[1]*(M[3]*b[2]-b[1]*M[6]) + b[0]*(M[3]*M[7]-M[4]*M[6])) / d
  ];
}

export function angSep(ra1_h, dec1_d, ra2_h, dec2_d) {
  const ra1 = ra1_h * 15 * D2R, d1 = dec1_d * D2R;
  const ra2 = ra2_h * 15 * D2R, d2 = dec2_d * D2R;
  return R2D * Math.acos(clamp(
    Math.sin(d1)*Math.sin(d2) + Math.cos(d1)*Math.cos(d2)*Math.cos(ra1-ra2), -1, 1));
}
```

- [ ] **Step 5: Run tests, verify all pass**

Open `test.html`. Expected: all 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add js/math.js test.html tests/math.test.js
git commit -m "feat: extract math.js utilities and test harness"
```

---

### Task 2: catalog.js — Star Catalog

**Files:**
- Create: `js/catalog.js`

- [ ] **Step 1: Extract catalog from monolith**

The monolith has a `CAT` object with 58 navigational stars as `{name: [ra_h, dec_d, mag]}`. Extract it into `js/catalog.js`.

Read the catalog section from the monolith (search for `const CAT`), then create:

```js
// js/catalog.js
// 58 navigational stars, J2000.0 epoch
// Format: { name: [ra_hours, dec_degrees, magnitude] }
export const CAT = {
  // ... extracted from monolith
};

export const CAT_ENTRIES = Object.entries(CAT).sort((a, b) => a[0].localeCompare(b[0]));
export const CAT_BY_MAG = [...CAT_ENTRIES].sort((a, b) => a[1][2] - b[1][2]);

// Constellation stick figure lines: [[star1, star2], ...]
export const CONST_LINES = [
  // ... extracted from monolith, with broken ['Mirfak','Algol'] removed
];
```

- [ ] **Step 2: Verify catalog exports work**

Add a quick test to `tests/math.test.js` (or a new file) that imports `CAT` and checks it has 58 entries and Polaris exists.

- [ ] **Step 3: Commit**

```bash
git add js/catalog.js
git commit -m "feat: extract star catalog to catalog.js"
```

---

### Task 3: altitude.js — Alt/Az Conversions + Visible Stars

**Files:**
- Create: `js/altitude.js`
- Create: `tests/altitude.test.js`

- [ ] **Step 1: Write tests for equatorialToAltAz and visibleStars**

Create `tests/altitude.test.js`:

```js
import { equatorialToAltAz, visibleStars } from '../js/altitude.js';

test('equatorialToAltAz: Polaris from mid-latitudes is high', () => {
  // Polaris (RA ~2.53h, Dec ~89.26°) from lat 40°N should have alt ≈ 89°
  const { alt_d, az_d } = equatorialToAltAz(2.53, 89.26, 40, -74, new Date('2025-06-15T00:00:00Z'));
  assert(alt_d > 80, `Polaris alt should be >80°, got ${alt_d}`);
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
  assert(stars.length < 58, 'Should not have all 58 stars visible');
  assert(stars.every(s => s.alt > 0), 'All returned stars should have positive altitude');
  // Should be sorted by altitude descending
  for (let i = 1; i < stars.length; i++) {
    assert(stars[i].alt <= stars[i-1].alt, 'Should be sorted by altitude descending');
  }
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement altitude.js**

Create `js/altitude.js`:

```js
import { D2R, R2D, nrm, clamp, gmst } from './math.js';
import { CAT, CAT_ENTRIES } from './catalog.js';

export function equatorialToAltAz(ra_h, dec_d, lat_d, lon_d, date) {
  const LMST = nrm(gmst(date) + lon_d);
  const HA = (LMST - ra_h * 15) * D2R;
  const dec = dec_d * D2R, lat = lat_d * D2R;
  const sinAlt = Math.sin(dec)*Math.sin(lat) + Math.cos(dec)*Math.cos(lat)*Math.cos(HA);
  const alt_d = R2D * Math.asin(clamp(sinAlt, -1, 1));
  const az_r = Math.atan2(Math.sin(HA), Math.cos(HA)*Math.sin(lat) - Math.tan(dec)*Math.cos(lat));
  return { alt_d, az_d: nrm(R2D * az_r + 180) };
}

export function visibleStars(ap, utc) {
  return CAT_ENTRIES
    .map(([name, [ra_h, dec_d, mag]]) => {
      const { alt_d, az_d } = equatorialToAltAz(ra_h, dec_d, ap.lat, ap.lon, utc);
      return { name, ra: ra_h * 15, dec: dec_d, mag, alt: alt_d, az: az_d };
    })
    .filter(s => s.alt > 0)
    .sort((a, b) => b.alt - a.alt);
}
```

Note: `visibleStars` returns `ra` in **degrees** (catalog stores hours, we convert: `ra_h * 15`), matching the spec convention for `sight-reduction.js`.

- [ ] **Step 4: Update test.html to import altitude tests**

Add `import('./tests/altitude.test.js').catch(() => {})` to the chain in `test.html`.

- [ ] **Step 5: Run tests, verify all pass**

- [ ] **Step 6: Commit**

```bash
git add js/altitude.js tests/altitude.test.js test.html
git commit -m "feat: add altitude.js with equatorialToAltAz and visibleStars"
```

---

### Task 4: sight-reduction.js — Intercept Method

**Files:**
- Create: `js/sight-reduction.js`
- Create: `tests/sight-reduction.test.js`

- [ ] **Step 1: Write tests**

Create `tests/sight-reduction.test.js`:

```js
import { gha, lha, calcHcZn, sightReduce, magToTrue } from '../js/sight-reduction.js';

test('gha returns 0-360 range', () => {
  const g = gha(new Date('2025-06-15T00:00:00Z'), 101.29); // Sirius RA in degrees
  assert(g >= 0 && g < 360, `GHA out of range: ${g}`);
});

test('lha with east longitude adds', () => {
  // GHA 90° + lon 30°E = LHA 120°
  assertNear(lha(90, 30), 120, 0.001);
});

test('lha with west longitude subtracts', () => {
  // GHA 90° + lon -30° (30°W) = LHA 60°
  assertNear(lha(90, -30), 60, 0.001);
});

test('lha normalizes to 0-360', () => {
  assertNear(lha(350, 20), 10, 0.001);
  assertNear(lha(10, -20), 350, 0.001);
});

test('calcHcZn: Polaris from 40N has high altitude, Zn near 0/360', () => {
  // Polaris: dec ~89.26°. From lat 40°N, Hc should be ~89°, Zn near 0° or 360°
  const g = gha(new Date('2025-06-15T00:00:00Z'), 37.95);
  const { Hc_deg, Zn_deg } = calcHcZn(40, -74, 89.26, g);
  assert(Hc_deg > 80, `Polaris Hc should be >80°, got ${Hc_deg}`);
  assert(Zn_deg < 5 || Zn_deg > 355, `Polaris Zn should be near north, got ${Zn_deg}`);
});

test('sightReduce produces valid intercept', () => {
  const star = { name: 'Sirius', ra: 101.29, dec: -16.72 };
  const ap = { lat: 34, lon: -118 };
  const utc = new Date('2025-12-15T04:00:00Z');
  const Ho = 30.0; // degrees
  const result = sightReduce(star, Ho, utc, ap, 0);
  assert(isFinite(result.intercept_nm), 'intercept should be finite');
  assert(result.Zn >= 0 && result.Zn < 360, 'Zn in range');
  assert(isFinite(result.Hc), 'Hc should be finite');
  assertNear(result.Ho, 30.0, 0.001, 'Ho should match input');
  assert(result.starName === 'Sirius', 'star name');
});

test('magToTrue: east declination adds', () => {
  // Magnetic 180° + declination 10°E = 190° true
  assertNear(magToTrue(180, 10), 190, 0.001);
});

test('magToTrue: west declination subtracts', () => {
  // Magnetic 180° + declination -10° (10°W) = 170° true
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
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement sight-reduction.js**

Create `js/sight-reduction.js`:

```js
import { D2R, R2D, nrm, clamp, gmst } from './math.js';

export function gha(utc, ra_deg) {
  const gmst_deg = gmst(utc);
  return nrm(gmst_deg - ra_deg);
}

export function lha(gha_deg, ap_lon) {
  return nrm(gha_deg + ap_lon);
}

export function calcHcZn(ap_lat, ap_lon, dec, gha_deg) {
  const lat = ap_lat * D2R;
  const d = dec * D2R;
  const LHA = lha(gha_deg, ap_lon) * D2R;
  const sinHc = Math.sin(lat)*Math.sin(d) + Math.cos(lat)*Math.cos(d)*Math.cos(LHA);
  const Hc_deg = R2D * Math.asin(clamp(sinHc, -1, 1));
  const Z = Math.atan2(
    -Math.cos(d) * Math.sin(LHA),
    Math.sin(d) * Math.cos(lat) - Math.cos(d) * Math.cos(LHA) * Math.sin(lat)
  );
  return { Hc_deg, Zn_deg: nrm(R2D * Z) };
}

export function magToTrue(magBearing, magDecl) {
  return nrm(magBearing + magDecl);
}

export function sightReduce(star, Ho_deg, utc, ap, magDecl, magBearing) {
  const gha_deg = gha(utc, star.ra);
  const { Hc_deg, Zn_deg } = calcHcZn(ap.lat, ap.lon, star.dec, gha_deg);
  const intercept_nm = (Ho_deg - Hc_deg) * 60; // degrees to arcminutes = nm
  return {
    intercept_nm,
    Zn: Zn_deg,
    Hc: Hc_deg,
    Ho: Ho_deg,
    starName: star.name,
    trueBearing: magBearing != null ? magToTrue(magBearing, magDecl) : null
  };
}
```

- [ ] **Step 4: Update test.html import chain if needed**

- [ ] **Step 5: Run tests, verify all pass**

- [ ] **Step 6: Commit**

```bash
git add js/sight-reduction.js tests/sight-reduction.test.js
git commit -m "feat: add sight-reduction.js with intercept method"
```

---

### Task 5: fix.js — Least-Squares Fix

**Files:**
- Create: `js/fix.js`
- Create: `tests/fix.test.js`

- [ ] **Step 1: Write tests**

Create `tests/fix.test.js`:

```js
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
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement fix.js**

Create `js/fix.js`:

```js
import { D2R, R2D, nrm } from './math.js';

export function leastSquaresFix(lops, ap) {
  const n = lops.length;
  if (n < 2) return null;

  // Check angle of cut — find max angular spread between any two LOPs
  let maxSpread = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let diff = Math.abs(lops[i].Zn - lops[j].Zn);
      if (diff > 180) diff = 360 - diff;
      if (diff > maxSpread) maxSpread = diff;
    }
  }
  if (maxSpread < 15) return null;

  // Build A matrix and b vector
  // Each LOP: dN*cos(Zn) + dE*sin(Zn) = intercept
  const A = [], b = [];
  for (const lop of lops) {
    const zr = lop.Zn * D2R;
    A.push([Math.cos(zr), Math.sin(zr)]);
    b.push(lop.intercept_nm);
  }

  // Normal equations: (A^T A)x = A^T b
  let a11 = 0, a12 = 0, a22 = 0, r1 = 0, r2 = 0;
  for (let i = 0; i < n; i++) {
    a11 += A[i][0] * A[i][0];
    a12 += A[i][0] * A[i][1];
    a22 += A[i][1] * A[i][1];
    r1  += A[i][0] * b[i];
    r2  += A[i][1] * b[i];
  }

  const det = a11 * a22 - a12 * a12;
  if (Math.abs(det) < 1e-10) return null;

  const dN = (a22 * r1 - a12 * r2) / det;
  const dE = (a11 * r2 - a12 * r1) / det;

  // Compute residuals
  const residuals = lops.map((lop, i) => {
    return A[i][0] * dN + A[i][1] * dE - b[i];
  });
  const rms = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / n);

  // Convert offsets to lat/lon
  const lat = ap.lat + dN / 60;
  const cosLat = Math.cos(ap.lat * D2R);
  const lon = ap.lon + (cosLat > 1e-6 ? dE / (60 * cosLat) : 0);

  return {
    lat, lon,
    dLat_nm: dN,
    dLon_nm: dE,
    residuals,
    confidence: rms
  };
}
```

- [ ] **Step 4: Update test.html import chain**

- [ ] **Step 5: Run tests, verify all pass**

- [ ] **Step 6: Commit**

```bash
git add js/fix.js tests/fix.test.js test.html
git commit -m "feat: add fix.js with least-squares LOP solver"
```

---

### Task 6: state.js — Centralized Store

**Files:**
- Create: `js/state.js`

- [ ] **Step 1: Implement state.js**

```js
export function createStore(initial) {
  let state = { ...initial };
  const listeners = {};

  return {
    get() { return Object.freeze({ ...state }); },

    update(patch) {
      state = { ...state, ...patch };
      const event = 'change';
      (listeners[event] || []).forEach(fn => fn(state));
    },

    on(event, fn) {
      (listeners[event] = listeners[event] || []).push(fn);
    },

    off(event, fn) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(f => f !== fn);
      }
    }
  };
}

export const INITIAL_STATE = {
  mode: 'sights',
  ap: { lat: 34, lon: -118 },
  utc: new Date(),
  magDecl: 0,
  observations: [],
  image: null,
  detections: [],
  identifiedStars: [],
  plateSolution: null,
  horizon: null,
  lops: [],
  fix: null
};
```

- [ ] **Step 2: Commit**

```bash
git add js/state.js
git commit -m "feat: add state.js centralized store"
```

---

### Task 7: nav-chart.js — d3 Mercator Nav Chart

**Files:**
- Create: `js/nav-chart.js`

This is the largest new module. No automated tests (visual module), but we'll verify manually.

- [ ] **Step 1: Create nav-chart.js**

```js
import { D2R, R2D, nrm } from './math.js';

const COLORS = ['#4a9eff','#ff6b6b','#6bff8a','#ffaa4a','#c084fc','#22d3ee','#f472b6','#a3e635'];

export function createNavChart(container) {
  // d3 loaded from CDN — access via globalThis.d3
  const d3 = globalThis.d3;
  if (!d3) throw new Error('d3 not loaded');

  const svg = d3.select(container).append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .style('background', '#0a0a1a');

  const g = svg.append('g'); // main group for zoom
  const gridG = g.append('g').attr('class', 'grid');
  const lopG = g.append('g').attr('class', 'lops');
  const fixG = g.append('g').attr('class', 'fix');

  let width, height, projection, colorMap = {};

  function getColor(starName) {
    if (!colorMap[starName]) {
      colorMap[starName] = COLORS[Object.keys(colorMap).length % COLORS.length];
    }
    return colorMap[starName];
  }

  // Zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.5, 10])
    .on('zoom', (e) => g.attr('transform', e.transform));
  svg.call(zoom);

  function resize() {
    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    svg.attr('viewBox', `0 0 ${width} ${height}`);
  }

  function update({ ap, lops = [], fix = null, radius_nm = 200 }) {
    resize();
    if (!ap) return;

    // Mercator projection centered on AP
    const nmToDeg = 1 / 60;
    const latExtent = radius_nm * nmToDeg;
    const lonExtent = radius_nm * nmToDeg / Math.cos(ap.lat * D2R);

    projection = d3.geoMercator()
      .center([ap.lon, ap.lat])
      .fitSize([width, height], {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[ap.lon - lonExtent, ap.lat - latExtent],
                         [ap.lon + lonExtent, ap.lat - latExtent],
                         [ap.lon + lonExtent, ap.lat + latExtent],
                         [ap.lon - lonExtent, ap.lat + latExtent],
                         [ap.lon - lonExtent, ap.lat - latExtent]]]
        }
      });

    drawGrid(ap, radius_nm);
    drawAP(ap);
    drawLOPs(ap, lops, radius_nm);
    if (fix) drawFix(fix);
    else fixG.selectAll('*').remove();
  }

  function drawGrid(ap, radius_nm) {
    gridG.selectAll('*').remove();
    const nmToDeg = 1/60;
    // Draw lat/lon grid lines
    const step = radius_nm > 100 ? 1 : 0.5; // degree step
    const latMin = ap.lat - radius_nm * nmToDeg;
    const latMax = ap.lat + radius_nm * nmToDeg;
    const cosLat = Math.cos(ap.lat * D2R);
    const lonMin = ap.lon - radius_nm * nmToDeg / cosLat;
    const lonMax = ap.lon + radius_nm * nmToDeg / cosLat;

    for (let lat = Math.floor(latMin/step)*step; lat <= latMax; lat += step) {
      const p1 = projection([lonMin, lat]);
      const p2 = projection([lonMax, lat]);
      if (p1 && p2) {
        gridG.append('line')
          .attr('x1',p1[0]).attr('y1',p1[1]).attr('x2',p2[0]).attr('y2',p2[1])
          .attr('stroke','#1a2a4a').attr('stroke-width',0.5);
        gridG.append('text').text(formatLat(lat))
          .attr('x',p1[0]+4).attr('y',p1[1]-2)
          .attr('fill','#3a5a8a').attr('font-size',9).attr('font-family','monospace');
      }
    }
    for (let lon = Math.floor(lonMin/step)*step; lon <= lonMax; lon += step) {
      const p1 = projection([lon, latMin]);
      const p2 = projection([lon, latMax]);
      if (p1 && p2) {
        gridG.append('line')
          .attr('x1',p1[0]).attr('y1',p1[1]).attr('x2',p2[0]).attr('y2',p2[1])
          .attr('stroke','#1a2a4a').attr('stroke-width',0.5);
        gridG.append('text').text(formatLon(lon))
          .attr('x',p1[0]+4).attr('y',p2[1]-2)
          .attr('fill','#3a5a8a').attr('font-size',9).attr('font-family','monospace');
      }
    }

    // North indicator
    const nPt = projection([ap.lon, ap.lat + radius_nm * nmToDeg * 0.9]);
    if (nPt) {
      gridG.append('text').text('N')
        .attr('x',nPt[0]).attr('y',nPt[1]).attr('text-anchor','middle')
        .attr('fill','#5a7aaa').attr('font-size',14).attr('font-family','monospace');
    }

    // Scale bar
    const sbLen = 50; // nm
    const p1 = projection([ap.lon, ap.lat - radius_nm/60*0.85]);
    const p2 = projection([ap.lon + sbLen/60/cosLat, ap.lat - radius_nm/60*0.85]);
    if (p1 && p2) {
      gridG.append('line')
        .attr('x1',p1[0]).attr('y1',p1[1]).attr('x2',p2[0]).attr('y2',p2[1])
        .attr('stroke','#5a7aaa').attr('stroke-width',1.5);
      gridG.append('text').text(`${sbLen} nm`)
        .attr('x',(p1[0]+p2[0])/2).attr('y',p1[1]-4).attr('text-anchor','middle')
        .attr('fill','#5a7aaa').attr('font-size',9).attr('font-family','monospace');
    }
  }

  function drawAP(ap) {
    gridG.selectAll('.ap-marker').remove();
    const pt = projection([ap.lon, ap.lat]);
    if (!pt) return;
    const apG = gridG.append('g').attr('class','ap-marker');
    apG.append('circle').attr('cx',pt[0]).attr('cy',pt[1]).attr('r',6)
      .attr('fill','none').attr('stroke','#ffcc00').attr('stroke-width',2);
    apG.append('line').attr('x1',pt[0]-8).attr('y1',pt[1]).attr('x2',pt[0]+8).attr('y2',pt[1])
      .attr('stroke','#ffcc00').attr('stroke-width',1.5);
    apG.append('line').attr('x1',pt[0]).attr('y1',pt[1]-8).attr('x2',pt[0]).attr('y2',pt[1]+8)
      .attr('stroke','#ffcc00').attr('stroke-width',1.5);
    apG.append('text').text('AP').attr('x',pt[0]+10).attr('y',pt[1]-4)
      .attr('fill','#ffcc00').attr('font-size',11).attr('font-family','monospace');
  }

  function drawLOPs(ap, lops, radius_nm) {
    lopG.selectAll('*').remove();
    const apPt = projection([ap.lon, ap.lat]);
    if (!apPt) return;
    const cosLat = Math.cos(ap.lat * D2R);
    const nmToDeg = 1/60;
    const lopLen = radius_nm / 3;

    for (const lop of lops) {
      const color = lop.color || getColor(lop.starName);
      const zr = lop.Zn * D2R;

      // Azimuth line (dashed, from AP outward)
      const azEndLat = ap.lat + Math.cos(zr) * radius_nm * 0.9 * nmToDeg;
      const azEndLon = ap.lon + Math.sin(zr) * radius_nm * 0.9 * nmToDeg / cosLat;
      const azEnd = projection([azEndLon, azEndLat]);
      if (azEnd) {
        lopG.append('line')
          .attr('x1',apPt[0]).attr('y1',apPt[1]).attr('x2',azEnd[0]).attr('y2',azEnd[1])
          .attr('stroke',color).attr('stroke-width',1).attr('stroke-dasharray','4,4').attr('opacity',0.5);
        lopG.append('text').text(`${lop.starName} Zn ${Math.round(lop.Zn)}°`)
          .attr('x',azEnd[0]+4).attr('y',azEnd[1]-4)
          .attr('fill',color).attr('font-size',9).attr('font-family','monospace');
      }

      // Intercept point (along azimuth line at intercept distance)
      const intLat = ap.lat + Math.cos(zr) * lop.intercept_nm * nmToDeg;
      const intLon = ap.lon + Math.sin(zr) * lop.intercept_nm * nmToDeg / cosLat;

      // LOP: perpendicular to azimuth at intercept point
      const perpZr = zr + Math.PI / 2;
      const p1Lat = intLat + Math.cos(perpZr) * lopLen * nmToDeg;
      const p1Lon = intLon + Math.sin(perpZr) * lopLen * nmToDeg / cosLat;
      const p2Lat = intLat - Math.cos(perpZr) * lopLen * nmToDeg;
      const p2Lon = intLon - Math.sin(perpZr) * lopLen * nmToDeg / cosLat;

      const lp1 = projection([p1Lon, p1Lat]);
      const lp2 = projection([p2Lon, p2Lat]);
      if (lp1 && lp2) {
        lopG.append('line')
          .attr('x1',lp1[0]).attr('y1',lp1[1]).attr('x2',lp2[0]).attr('y2',lp2[1])
          .attr('stroke',color).attr('stroke-width',2.5);
        const intPt = projection([intLon, intLat]);
        if (intPt) {
          lopG.append('text').text(`a=${lop.intercept_nm > 0 ? '+' : ''}${lop.intercept_nm.toFixed(1)}'`)
            .attr('x',lp2[0]+4).attr('y',lp2[1]-2)
            .attr('fill',color).attr('font-size',9).attr('font-family','monospace');
        }
      }

      // CoEA arc (subtle dashed arc near LOP)
      if (lop.Ho != null && lop.starDec != null) {
        // Small arc segment approximation near the LOP
        const arcPts = [];
        for (let a = -15; a <= 15; a += 3) {
          const angle = zr + a * D2R;
          const aLat = ap.lat + Math.cos(angle) * lop.intercept_nm * nmToDeg;
          const aLon = ap.lon + Math.sin(angle) * lop.intercept_nm * nmToDeg / cosLat;
          const pt = projection([aLon, aLat]);
          if (pt) arcPts.push(pt);
        }
        if (arcPts.length > 1) {
          const line = d3.line().x(d=>d[0]).y(d=>d[1]).curve(d3.curveBasis);
          lopG.append('path').attr('d', line(arcPts))
            .attr('fill','none').attr('stroke',color).attr('stroke-width',1)
            .attr('stroke-dasharray','2,3').attr('opacity',0.4);
        }
      }
    }
  }

  function drawFix(fix) {
    fixG.selectAll('*').remove();
    const pt = projection([fix.lon, fix.lat]);
    if (!pt) return;
    fixG.append('circle').attr('cx',pt[0]).attr('cy',pt[1]).attr('r',8)
      .attr('fill','none').attr('stroke','#ff3').attr('stroke-width',2.5);
    fixG.append('line').attr('x1',pt[0]-10).attr('y1',pt[1]).attr('x2',pt[0]+10).attr('y2',pt[1])
      .attr('stroke','#ff3').attr('stroke-width',2);
    fixG.append('line').attr('x1',pt[0]).attr('y1',pt[1]-10).attr('x2',pt[0]).attr('y2',pt[1]+10)
      .attr('stroke','#ff3').attr('stroke-width',2);
    fixG.append('text').text('FIX').attr('x',pt[0]+14).attr('y',pt[1]-4)
      .attr('fill','#ff3').attr('font-size',11).attr('font-weight','bold').attr('font-family','monospace');
    fixG.append('text').text(`${formatLat(fix.lat)} ${formatLon(fix.lon)}`)
      .attr('x',pt[0]+14).attr('y',pt[1]+10)
      .attr('fill','#ff3').attr('font-size',9).attr('font-family','monospace');
  }

  function formatLat(d) {
    const abs = Math.abs(d);
    const deg = Math.floor(abs);
    const min = ((abs - deg) * 60).toFixed(1);
    return `${deg}°${min}'${d >= 0 ? 'N' : 'S'}`;
  }

  function formatLon(d) {
    const abs = Math.abs(d);
    const deg = Math.floor(abs);
    const min = ((abs - deg) * 60).toFixed(1);
    return `${deg}°${min}'${d >= 0 ? 'E' : 'W'}`;
  }

  return { update, resize, destroy: () => svg.remove() };
}
```

- [ ] **Step 2: Commit**

```bash
git add js/nav-chart.js
git commit -m "feat: add nav-chart.js d3 Mercator chart"
```

---

### Task 8: index.html — HTML Shell + CSS + Dual-Mode Layout

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create index.html**

Build the HTML shell with:
- d3 v7 CDN `<script>` tag
- EXIF.js CDN `<script>` tag
- CSS extracted from monolith + new dual-mode layout styles
- Tab bar (Photo / Sights)
- Left panel with both mode panels (toggled by tab)
- Right panel for nav chart container
- Bottom bar with AP, Mag Decl, UTC, Fix readout
- `<script type="module" src="js/app.js"></script>`

Layout structure:

```html
<div class="app-layout">
  <div class="left-panel">
    <div class="tab-bar">
      <button class="tab active" data-mode="sights">⚓ Sights</button>
      <button class="tab" data-mode="photo">📷 Photo</button>
    </div>
    <div class="panel sights-panel active">
      <!-- Star selector + observations table -->
      <div class="star-selector">
        <button id="addStar" class="btn">+ Add Star</button>
        <select id="starDropdown" class="finput" style="display:none"></select>
      </div>
      <div id="obsTable"></div>
      <button id="computeFix" class="btn btn-teal" style="display:none">Compute Fix</button>
    </div>
    <div class="panel photo-panel">
      <!-- Photo Nav UI (existing, to be wired later) -->
      <div class="dz" id="dropzone">
        <div class="dz-title">Drop sky photo here</div>
        <div class="dz-hint">JPEG / PNG / HEIC</div>
      </div>
      <div id="photoView" style="display:none"></div>
    </div>
  </div>
  <div class="right-panel">
    <div id="navChart"></div>
  </div>
  <div class="bottom-bar">
    <div class="input-group">
      <label class="flbl">AP Lat</label>
      <input id="apLat" type="text" class="finput" value="34° 00.0' N" placeholder="34° 00.0' N">
    </div>
    <div class="input-group">
      <label class="flbl">AP Lon</label>
      <input id="apLon" type="text" class="finput" value="118° 00.0' W" placeholder="118° 00.0' W">
    </div>
    <div class="input-group">
      <label class="flbl">Mag Decl</label>
      <input id="magDecl" type="number" class="finput" value="12" step="0.1"> °E
    </div>
    <div class="input-group">
      <label class="flbl">UTC</label>
      <input id="utcInput" type="datetime-local" class="finput">
    </div>
    <div class="fix-readout" id="fixReadout">—</div>
  </div>
</div>
```

CSS should include the monolith's existing design tokens (`:root` vars) plus grid layout for the dual-mode structure. Key layout CSS:

```css
.app-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr auto;
  height: 100vh;
  gap: 0;
}
.left-panel { grid-row: 1; grid-column: 1; overflow-y: auto; padding: 12px; }
.right-panel { grid-row: 1; grid-column: 2; }
#navChart { width: 100%; height: 100%; }
.bottom-bar {
  grid-row: 2; grid-column: 1 / -1;
  display: flex; gap: 12px; align-items: center;
  padding: 8px 12px; border-top: 0.5px solid var(--bdr);
  flex-wrap: wrap;
}
.panel { display: none; }
.panel.active { display: block; }
.tab-bar { display: flex; gap: 6px; margin-bottom: 12px; }
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add index.html dual-mode layout shell"
```

---

### Task 9: ui.js — DOM Events + Observations Table

**Files:**
- Create: `js/ui.js`

- [ ] **Step 1: Implement ui.js**

This module handles:
- Tab switching (Photo / Sights mode)
- Parsing AP lat/lon from degree-minute format
- Populating the star dropdown with `visibleStars()` results
- Adding/removing observation rows
- Reading observation inputs (Ho deg/min, UTC, mag bearing)
- Rendering computed columns (Hc, intercept, Zn)
- Showing/hiding "Compute Fix" button
- Updating fix readout

```js
import { visibleStars } from './altitude.js';

export function initUI(store, computePipeline) {
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const mode = tab.dataset.mode;
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.querySelector(`.${mode}-panel`).classList.add('active');
      store.update({ mode });
    });
  });

  // Star selector
  const addBtn = document.getElementById('addStar');
  const dropdown = document.getElementById('starDropdown');

  addBtn.addEventListener('click', () => {
    const state = store.get();
    const stars = visibleStars(state.ap, state.utc);
    dropdown.innerHTML = '<option value="">— select star —</option>';
    const existing = state.observations.map(o => o.starName);
    stars.filter(s => !existing.includes(s.name)).forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = `${s.name} (mag ${s.mag.toFixed(1)}, alt ${s.alt.toFixed(0)}°)`;
      dropdown.appendChild(opt);
    });
    dropdown.style.display = 'inline-block';
    dropdown.focus();
  });

  dropdown.addEventListener('change', () => {
    const name = dropdown.value;
    if (!name) return;
    const state = store.get();
    const obs = [...state.observations, {
      starName: name,
      Ho_deg: 0, Ho_min: 0,
      utc: state.utc,
      magBearing: null,
      Hc: 0, intercept_nm: 0, Zn: 0
    }];
    store.update({ observations: obs });
    dropdown.style.display = 'none';
    renderObsTable(store, computePipeline);
    computePipeline();
  });

  // Global inputs
  const utcInput = document.getElementById('utcInput');
  utcInput.value = new Date().toISOString().slice(0, 16);
  utcInput.addEventListener('change', () => {
    store.update({ utc: new Date(utcInput.value + 'Z') });
    computePipeline();
  });

  document.getElementById('apLat').addEventListener('change', (e) => {
    const lat = parseDM(e.target.value, 'lat');
    if (lat != null) {
      const state = store.get();
      store.update({ ap: { ...state.ap, lat } });
      computePipeline();
    }
  });

  document.getElementById('apLon').addEventListener('change', (e) => {
    const lon = parseDM(e.target.value, 'lon');
    if (lon != null) {
      const state = store.get();
      store.update({ ap: { ...state.ap, lon } });
      computePipeline();
    }
  });

  document.getElementById('magDecl').addEventListener('change', (e) => {
    store.update({ magDecl: parseFloat(e.target.value) || 0 });
    computePipeline();
  });

  document.getElementById('computeFix').addEventListener('click', () => {
    computePipeline();
  });

  // Initial render
  renderObsTable(store, computePipeline);
  store.on('change', () => updateFixReadout(store.get()));
}

export function renderObsTable(store, computePipeline) {
  const state = store.get();
  const container = document.getElementById('obsTable');
  container.innerHTML = '';

  state.observations.forEach((obs, i) => {
    const row = document.createElement('div');
    row.className = 'obs-row';
    const obsUtcVal = (obs.utc instanceof Date ? obs.utc : new Date(obs.utc)).toISOString().slice(0, 16);
    row.innerHTML = `
      <span class="obs-name">${obs.starName}</span>
      <label>Ho:</label>
      <input type="number" class="finput obs-ho-deg" data-i="${i}" value="${obs.Ho_deg}" min="0" max="90" style="width:40px">°
      <input type="number" class="finput obs-ho-min" data-i="${i}" value="${obs.Ho_min}" min="0" max="59.9" step="0.1" style="width:50px">'
      <label>UTC:</label>
      <input type="datetime-local" class="finput obs-utc" data-i="${i}" value="${obsUtcVal}" style="width:140px">
      <label>Brg:</label>
      <input type="number" class="finput obs-brg" data-i="${i}" value="${obs.magBearing || ''}" placeholder="—" style="width:50px">°
      <span class="obs-computed">
        Hc ${obs.Hc.toFixed(1)}° | a=${obs.intercept_nm > 0 ? '+' : ''}${obs.intercept_nm.toFixed(1)}' | Zn ${obs.Zn.toFixed(0)}°
      </span>
      <button class="srmv" data-i="${i}">✕</button>
    `;
    container.appendChild(row);
  });

  // Event delegation
  container.querySelectorAll('.obs-ho-deg,.obs-ho-min,.obs-brg,.obs-utc').forEach(inp => {
    inp.addEventListener('change', () => {
      const idx = parseInt(inp.dataset.i);
      const obs = [...state.observations];
      obs[idx] = { ...obs[idx] };
      if (inp.classList.contains('obs-ho-deg')) obs[idx].Ho_deg = parseFloat(inp.value) || 0;
      if (inp.classList.contains('obs-ho-min')) obs[idx].Ho_min = parseFloat(inp.value) || 0;
      if (inp.classList.contains('obs-brg')) obs[idx].magBearing = inp.value ? parseFloat(inp.value) : null;
      if (inp.classList.contains('obs-utc')) obs[idx].utc = inp.value ? new Date(inp.value + 'Z') : state.utc;
      store.update({ observations: obs });
      computePipeline();
    });
  });

  container.querySelectorAll('.srmv').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.i);
      const obs = state.observations.filter((_, j) => j !== idx);
      store.update({ observations: obs });
      renderObsTable(store, computePipeline);
      computePipeline();
    });
  });

  // Show/hide compute fix button
  document.getElementById('computeFix').style.display = state.observations.length >= 2 ? 'inline-block' : 'none';
}

function updateFixReadout(state) {
  const el = document.getElementById('fixReadout');
  if (state.fix) {
    el.textContent = `Fix: ${formatDM(state.fix.lat, 'lat')} ${formatDM(state.fix.lon, 'lon')} (±${state.fix.confidence.toFixed(1)}nm)`;
    el.style.color = '#ff3';
  } else {
    el.textContent = '—';
    el.style.color = '';
  }
}

function parseDM(str, type) {
  // Parse "34° 12.5' N" or "118° 30.0' W" or plain number
  const m = str.match(/(\d+)[°\s]+(\d+\.?\d*)['\s]*(N|S|E|W)?/i);
  if (m) {
    let val = parseInt(m[1]) + parseFloat(m[2]) / 60;
    if (m[3] && /[SW]/i.test(m[3])) val = -val;
    return val;
  }
  const n = parseFloat(str);
  return isFinite(n) ? n : null;
}

function formatDM(d, type) {
  const abs = Math.abs(d);
  const deg = Math.floor(abs);
  const min = ((abs - deg) * 60).toFixed(1);
  const dir = type === 'lat' ? (d >= 0 ? 'N' : 'S') : (d >= 0 ? 'E' : 'W');
  return `${deg}°${min}'${dir}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add js/ui.js
git commit -m "feat: add ui.js with tab switching and observation table"
```

---

### Task 10: app.js — Entry Point + Compute Pipeline

**Files:**
- Create: `js/app.js`

- [ ] **Step 1: Implement app.js**

```js
import { createStore, INITIAL_STATE } from './state.js';
import { createNavChart } from './nav-chart.js';
import { sightReduce } from './sight-reduction.js';
import { leastSquaresFix } from './fix.js';
import { initUI, renderObsTable } from './ui.js';
import { CAT } from './catalog.js';

const store = createStore(INITIAL_STATE);
const chart = createNavChart(document.getElementById('navChart'));

function computePipeline() {
  const state = store.get();
  if (state.mode !== 'sights') return;

  const lops = [];
  const updatedObs = state.observations.map(obs => {
    const catEntry = CAT[obs.starName];
    if (!catEntry) return obs;
    const [ra_h, dec_d, mag] = catEntry;
    const star = { name: obs.starName, ra: ra_h * 15, dec: dec_d };
    const Ho_deg = obs.Ho_deg + obs.Ho_min / 60;
    const utc = obs.utc || state.utc;
    const result = sightReduce(star, Ho_deg, utc, state.ap, state.magDecl, obs.magBearing);
    lops.push({
      intercept_nm: result.intercept_nm,
      Zn: result.Zn,
      Ho: Ho_deg,
      starDec: dec_d,
      starName: obs.starName
    });
    return { ...obs, Hc: result.Hc, intercept_nm: result.intercept_nm, Zn: result.Zn };
  });

  const fix = lops.length >= 2 ? leastSquaresFix(lops, state.ap) : null;
  store.update({ observations: updatedObs, lops, fix });
  chart.update({ ap: state.ap, lops, fix });
  renderObsTable(store, computePipeline);
}

// Wire up UI
initUI(store, computePipeline);

// Handle resize
window.addEventListener('resize', () => chart.resize());

// Initial chart render
chart.update({ ap: store.get().ap, lops: [], fix: null });
```

- [ ] **Step 2: Verify end-to-end in browser**

Open `index.html` via HTTP server. Verify:
1. Tab switching works (Sights / Photo)
2. Can set AP, UTC, Mag Decl in bottom bar
3. Can add a star from the dropdown (shows only visible stars)
4. Can enter Ho values and see computed Hc, intercept, Zn
5. Nav chart shows AP marker, azimuth lines, LOPs
6. With 2+ stars, "Compute Fix" works and fix marker appears on chart

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: add app.js entry point with compute pipeline"
```

---

### Task 11: Extract Photo Nav Modules from Monolith

**Files:**
- Create: `js/plate-solve.js`
- Create: `js/detection.js`
- Create: `js/auto-id.js`
- Create: `js/overlay.js`

This task extracts the existing Photo Nav functionality from `celestial-nav-v3.html` into modules. These are straight extractions with `export` added — no logic changes.

- [ ] **Step 1: Extract plate-solve.js**

Extract `plateSolve()`, `projectToPixel()`, add `pixelToSky()` (inverse), add `rmsResidual` computation. Source: monolith lines 396-440.

```js
import { D2R, R2D, clamp, solve3x3 } from './math.js';

export function plateSolve(stars) { /* extracted from monolith */ }
export function projectToPixel(ra_h, dec_d, solve) { /* extracted */ }
export function pixelToSky(px, py, solve) { /* new inverse */ }
```

- [ ] **Step 2: Extract detection.js**

Extract `detectBrightSpots()`. Source: monolith (search for `detectBrightSpots`).

```js
export function detectBrightSpots(imageData, threshold, minSep) { /* extracted */ }
```

- [ ] **Step 3: Extract auto-id.js**

Extract `buildCatalogHash()` and `runAutoID()`. Source: monolith.

```js
import { angSep } from './math.js';
import { CAT, CAT_ENTRIES } from './catalog.js';

export function buildCatalogHash(tolerance) { /* extracted */ }
export function runAutoID(detections, catalogHash, solve) { /* extracted */ }
```

- [ ] **Step 4: Extract overlay.js**

Extract `drawOverlay()`. Source: monolith line 769+. Make it accept state as parameter instead of reading globals.

```js
import { D2R, R2D, nrm, gmst } from './math.js';
import { CAT, CONST_LINES } from './catalog.js';
import { projectToPixel } from './plate-solve.js';

export function drawOverlay(svgElement, state) { /* extracted, parameterized */ }
```

- [ ] **Step 5: Commit**

```bash
git add js/plate-solve.js js/detection.js js/auto-id.js js/overlay.js
git commit -m "feat: extract photo nav modules from monolith"
```

---

### Task 12: Wire Photo Nav Mode + Polish

**Files:**
- Modify: `js/ui.js`
- Modify: `js/app.js`
- Modify: `index.html`

- [ ] **Step 1: Add Photo Nav UI to ui.js**

Add image upload handling (drag-drop, file picker), detection controls, star identification picker, plate solve button, and "Export to Sights" bridge. This reuses existing monolith UI logic, adapted to the module structure.

- [ ] **Step 2: Wire Photo Nav in app.js**

Connect detection → identification → plate solve → overlay pipeline. Add "Export to Sights" handler that creates observation rows from identified stars.

- [ ] **Step 3: Add Photo Nav HTML to index.html**

Expand the `.photo-panel` div with detection settings, photo viewer with SVG overlay, sightings list, orientation inputs, etc. CSS from the monolith.

- [ ] **Step 4: End-to-end test both modes**

Verify:
- Photo Nav: upload image → detect → identify → plate solve → overlay renders
- Sights: add stars → enter Ho → compute fix → nav chart shows LOPs and fix
- Export bridge: plate solve in Photo → "Export to Sights" → observations pre-filled
- Tab switching preserves state

- [ ] **Step 5: Commit**

```bash
git add js/ui.js js/app.js index.html
git commit -m "feat: wire photo nav mode and export-to-sights bridge"
```

---

### Task 13: Demo Data + Final Verification

**Files:**
- Modify: `js/app.js` or `js/state.js`

- [ ] **Step 1: Add demo data**

Pre-populate a "Load Demo" button that fills in 3 star observations with known values for testing. Use the existing monolith demo data (Alphecca, Kochab, Arcturus) adapted to the Sights mode format.

- [ ] **Step 2: Full end-to-end verification**

Run through complete workflow:
1. Load demo data → nav chart shows LOPs
2. Compute fix → fix marker appears, lat/lon readout updates
3. Manually add a star, edit Ho → LOP updates in real-time
4. Run `test.html` → all unit tests pass

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: add demo data and complete dual-mode nav app"
```
