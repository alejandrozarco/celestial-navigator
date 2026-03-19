# Celestial Nav Modular Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose `celestial-nav-v3.html` (1230 lines) into 10 ES modules with verified auto-ID, three-source altitude pipeline, and centralized state.

**Architecture:** Native ES modules (no build step), served via `<script type="module" src="js/app.js">`. Centralized pub/sub state store drives re-rendering. Pure-function modules for math, plate solving, detection, and auto-ID enable isolated testing.

**Tech Stack:** Vanilla JS ES modules, SVG overlay, Leaflet (CDN), EXIF.js (CDN)

**Spec:** `docs/superpowers/specs/2026-03-19-celestial-nav-redesign.md`

**Source (to extract from):** `celestial-nav-v3.html`

---

## File Structure

```
celestial/
  index.html              — HTML shell + CSS (no inline JS beyond module import)
  js/
    math.js               — D2R, R2D, nrm, clamp, gmst, zenithFix, solve3x3, angSep
    catalog.js            — CAT, CAT_ENTRIES, CAT_BY_MAG, CONST_LINES
    plate-solve.js        — plateSolve, projectToPixel, pixelToSky
    detection.js          — detectBrightSpots, DEFAULT_DETECTION_OPTS
    auto-id.js            — buildCatalogHash, runAutoID (with verification pipeline)
    altitude.js           — equatorialToAltAz, altazToEquatorial, altitudeFix,
                            computePhotoAltitude, DeviceAltitudeCapture, resolvedAltitude
    overlay.js            — drawOverlay (RA/Dec grid, stars, constellations, Alt/Az grid, horizon)
    state.js              — createStore
    ui.js                 — initUI (all DOM manipulation, rendering, event handlers)
    app.js                — entry point: imports, wires store → UI → computation pipeline
  test.html               — lightweight test page for pure-function modules
```

---

### Task 1: Create `js/math.js`

Extract all pure math utilities from the monolith. Add `angSep` (moved from catalog-adjacent code per spec B1 fix) and `solve3x3` (currently inlined in `plateSolve`).

**Files:**
- Create: `js/math.js`

- [ ] **Step 1: Create `js/math.js` with constants and basic utilities**

```js
// js/math.js — Pure math utilities for celestial navigation
export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;
export const nrm = a => ((a % 360) + 360) % 360;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
```

- [ ] **Step 2: Add `gmst`, `zenithFix`, `solve3x3`, `angSep`**

Extract `gmst` (line 385), `zenithFix` (line 386), the inline `s3` solver (line 406), and `angSep` (lines 388-391) into `math.js`. The `solve3x3` is currently an anonymous function inside `plateSolve` — promote it to a named export.

```js
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
  const d = M[0]*(M[4]*M[8]-M[5]*M[7]) - M[1]*(M[3]*M[8]-M[5]*M[6])
          + M[2]*(M[3]*M[7]-M[4]*M[6]);
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

- [ ] **Step 3: Commit**

```bash
git add js/math.js
git commit -m "feat: extract math.js — constants, gmst, zenithFix, solve3x3, angSep"
```

---

### Task 2: Create `js/catalog.js`

Extract the star catalog and constellation lines. Import `angSep` is no longer needed here (it's in math.js).

**Files:**
- Create: `js/catalog.js`

- [ ] **Step 1: Create `js/catalog.js` with CAT, derived arrays, and CONST_LINES**

Copy `CAT` object (line 326), `CAT_BY_MAG` (line 327), `CAT_ENTRIES` (line 328), and `CONST_LINES` (lines 333-368) from the monolith. Remove the broken `['Mirfak','Algol']` line (Algol is not in the catalog).

```js
// js/catalog.js — 58 navigational stars (J2000.0) and constellation stick figures
export const CAT = {
  'Acamar': [2.970, -40.30, 3.2],
  'Achernar': [1.629, -57.24, 0.5],
  // ... (all 58 stars, copied verbatim from lines 326)
};

export const CAT_BY_MAG = Object.entries(CAT).sort((a, b) => a[1][2] - b[1][2]);
export const CAT_ENTRIES = Object.entries(CAT);

export const CONST_LINES = [
  ['Betelgeuse', 'Bellatrix'], ['Betelgeuse', 'Alnilam'], ['Bellatrix', 'Alnilam'],
  ['Alnilam', 'Rigel'],
  ['Dubhe', 'Alioth'], ['Alioth', 'Alkaid'],
  ['Polaris', 'Kochab'],
  ['Antares', 'Shaula'],
  ['Rigil Kentaurus', 'Hadar'],
  ['Sirius', 'Adhara'],
  ['Acrux', 'Gacrux'],
  ['Regulus', 'Denebola'],
  ['Aldebaran', 'Elnath'],
  ['Castor', 'Pollux'],
  ['Alpheratz', 'Markab'], ['Markab', 'Enif'],
  ['Kaus Australis', 'Nunki'],
  ['Rasalhague', 'Sabik'],
  ['Achernar', 'Acamar'],
  ['Canopus', 'Avior'], ['Avior', 'Suhail'], ['Canopus', 'Miaplacidus'],
  // ['Mirfak', 'Algol'] — REMOVED: Algol not in catalog
  ['Arcturus', 'Alphecca'],
];
```

- [ ] **Step 2: Commit**

```bash
git add js/catalog.js
git commit -m "feat: extract catalog.js — 58 nav stars, constellation lines"
```

---

### Task 3: Create `js/plate-solve.js`

Extract plate solve with new `pixelToSky` inverse projection and `rmsResidual` computation (spec sections B3, B4).

**Files:**
- Create: `js/plate-solve.js`

- [ ] **Step 1: Create `js/plate-solve.js` with `plateSolve` + rmsResidual**

Extract `plateSolve` (lines 396-418) and `projectToPixel` (lines 424-437). Import `D2R`, `R2D`, `nrm`, `clamp`, `solve3x3` from `math.js`. Modify `plateSolve` to compute and return `rmsResidual`.

```js
import { D2R, R2D, nrm, clamp, solve3x3 } from './math.js';

export function plateSolve(stars) {
  if (stars.length < 2) return null;
  let ra0 = stars.reduce((s,x) => s + x.ra_h*15, 0) / stars.length;
  let de0 = stars.reduce((s,x) => s + x.dec_d, 0) / stars.length;
  let lastCx = null, lastCy = null, lastRa0 = ra0, lastDe0 = de0;

  for (let iter = 0; iter < 10; iter++) {
    // ... (existing iteration logic from lines 400-417)
    // Save lastCx, lastCy, lastRa0, lastDe0 each iteration
  }

  if (!lastCx || !lastCy) return null;

  const solve = { ra_h: nrm(ra0)/15, dec_d: de0, cx: lastCx, cy: lastCy,
                  ra0_deg: lastRa0, dec0_deg: lastDe0 };

  // Compute rmsResidual
  let sumSq = 0;
  for (const s of stars) {
    const proj = projectToPixel(s.ra_h, s.dec_d, solve);
    if (!proj) continue;
    const dx = proj.px - s.px, dy = proj.py - s.py;
    sumSq += dx*dx + dy*dy;
  }
  solve.rmsResidual = Math.sqrt(sumSq / stars.length);

  return solve;
}
```

- [ ] **Step 2: Add `projectToPixel`**

Copy from lines 424-437. No changes needed except removing global scope.

- [ ] **Step 3: Add `pixelToSky` (new — spec B3)**

Inverse of `projectToPixel`. Follows the formula from the spec:

```js
export function pixelToSky(px, py, solve) {
  if (!solve || !solve.cx || !solve.cy) return null;
  const cx = solve.cx, cy = solve.cy;

  // Undo pixel → tangent-plane
  const px_c = px - 0.5;
  const py_c = -(py - 0.5);  // undo y-negation
  const u = px_c - cx[2];
  const v = py_c - cy[2];

  const det = cx[0]*cy[1] - cx[1]*cy[0];
  if (Math.abs(det) < 1e-12) return null;

  const xi  = (u*cy[1] - v*cx[1]) / det;
  const eta = (v*cx[0] - u*cy[0]) / det;

  // Deproject from tangent plane to celestial coords
  const ra0  = solve.ra0_deg * D2R;
  const dec0 = solve.dec0_deg * D2R;
  const rho  = Math.sqrt(xi*xi + eta*eta);

  if (rho < 1e-12) return { ra_h: solve.ra0_deg / 15, dec_d: solve.dec0_deg };

  const c = Math.atan(rho);
  const dec = Math.asin(clamp(
    Math.cos(c)*Math.sin(dec0) + eta*Math.sin(c)*Math.cos(dec0)/rho, -1, 1));
  const ra = ra0 + Math.atan2(
    xi * Math.sin(c),
    rho*Math.cos(dec0)*Math.cos(c) - eta*Math.sin(dec0)*Math.sin(c));

  return { ra_h: ((ra * R2D % 360) + 360) % 360 / 15, dec_d: dec * R2D };
}
```

- [ ] **Step 4: Commit**

```bash
git add js/plate-solve.js
git commit -m "feat: extract plate-solve.js — plateSolve with rmsResidual, projectToPixel, pixelToSky"
```

---

### Task 4: Create `js/detection.js`

Extract bright-spot detection with centroiding.

**Files:**
- Create: `js/detection.js`

- [ ] **Step 1: Create `js/detection.js`**

Extract `detectBrightSpots` (lines 554-585) and `DEFAULT_DETECTION_OPTS`. Add FWHM `radius` output to each detected spot.

```js
export const DEFAULT_DETECTION_OPTS = { pct: 96, maxStars: 30, clusterPx: 18 };

export function detectBrightSpots(imgEl, opts) {
  opts = opts || DEFAULT_DETECTION_OPTS;
  const pct = opts.pct != null ? opts.pct : 96;
  const maxStars = opts.maxStars || 30;
  const clusterPx = opts.clusterPx || 18;

  // ... (existing detection logic from lines 557-584)
  // Add radius computation: after centroiding, compute weighted second moment
  // radius = sqrt(sum(w * r^2) / sum(w)) where r = distance from centroid

  // In the centroid loop, also accumulate:
  // let wr2sum = 0;
  // for dy/dx: wr2sum += w * ((nx-cx)*(nx-cx) + (ny-cy)*(ny-cy));
  // const radius = wsum > 0 ? Math.sqrt(wr2sum / wsum) : 1;
  // raw.push({ px: cx/W, py: cy/H, v, radius });

  return kept;
}
```

- [ ] **Step 2: Commit**

```bash
git add js/detection.js
git commit -m "feat: extract detection.js — detectBrightSpots with centroiding and FWHM radius"
```

---

### Task 5: Create `js/state.js`

Build the centralized pub/sub state store from scratch.

**Files:**
- Create: `js/state.js`

- [ ] **Step 1: Create `js/state.js`**

```js
export function createStore(initialState) {
  let state = { ...initialState };
  const listeners = {};

  return {
    get() {
      return Object.freeze({ ...state });
    },
    update(patch) {
      state = { ...state, ...patch };
      (listeners['change'] || []).forEach(fn => fn(state));
    },
    on(event, callback) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    },
    off(event, callback) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(fn => fn !== callback);
    }
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add js/state.js
git commit -m "feat: create state.js — centralized pub/sub state store"
```

---

### Task 6: Create `js/auto-id.js`

Extract and upgrade auto-ID with the new 5-step verification pipeline (spec section 3.5).

**Files:**
- Create: `js/auto-id.js`

- [ ] **Step 1: Create `js/auto-id.js` with `buildCatalogHash` and `hashLookup`**

Extract `buildCatalogHash` (lines 443-463) and `hashLookup` (lines 464-471). Import `angSep` from `math.js` and `CAT_ENTRIES` from `catalog.js`.

```js
import { angSep } from './math.js';
import { CAT, CAT_ENTRIES } from './catalog.js';

let CAT_HASH = null;

export function buildCatalogHash() {
  if (CAT_HASH) return CAT_HASH;
  // ... (existing hash build logic from lines 443-463)
  return CAT_HASH;
}

function hashLookup(r1, r2, tol) {
  // ... (existing lookup logic from lines 464-471)
}
```

- [ ] **Step 2: Add `runAutoID` with verification pipeline**

New pure function replacing the old `_runAutoID` (lines 484-548). Takes `(candidates, existingSightings, opts)` as args, returns `{matches, rejected, plateResult, message}`. Implements all 5 spec steps:

```js
import { plateSolve, projectToPixel } from './plate-solve.js';

export function runAutoID(candidates, existingSightings, opts = {}) {
  const topN = [...candidates].sort((a,b) => b.v - a.v).slice(0, opts.maxCandidates || 12);
  if (topN.length < 3) return { matches: [], rejected: [], plateResult: null,
    message: 'Need >= 3 detected candidates.' };

  // Step 1: Triangle hash matching (tolerance 0.03, was 0.045)
  const TOL = opts.hashTolerance || 0.03;
  const votes = {};
  topN.forEach(c => { votes[c.id] = {}; });
  // ... (triangle loop from lines 494-517, using TOL instead of 0.045)

  // Step 2: Winner selection (vote threshold 6, was 4)
  const VOTE_THRESH = opts.voteThreshold || 6;
  const assignments = [];
  for (const [cidStr, starVotes] of Object.entries(votes)) {
    const best = Object.entries(starVotes).sort((a,b) => b[1] - a[1]);
    if (best.length && best[0][1] >= VOTE_THRESH) {
      assignments.push({ candId: parseInt(cidStr), star: best[0][0], score: best[0][1] });
    }
  }
  // Greedy non-conflicting assignment
  assignments.sort((a,b) => b.score - a.score);
  const usedStars = new Set(), usedCands = new Set();
  const existingCands = new Set(existingSightings.map(s => s.candId).filter(Boolean));
  let proposed = [];
  for (const a of assignments) {
    if (usedStars.has(a.star) || usedCands.has(a.candId) || existingCands.has(a.candId)) continue;
    if (!CAT[a.star]) continue;
    proposed.push(a);
    usedStars.add(a.star); usedCands.add(a.candId);
  }

  // Step 3: Pairwise consistency check [NEW]
  if (proposed.length >= 2) {
    const scales = [];
    for (let i = 0; i < proposed.length - 1; i++) {
      for (let j = i + 1; j < proposed.length; j++) {
        const ci = topN.find(c => c.id === proposed[i].candId);
        const cj = topN.find(c => c.id === proposed[j].candId);
        if (!ci || !cj) continue;
        const pxDist = Math.hypot(ci.px - cj.px, ci.py - cj.py);
        if (pxDist < 0.001) continue;
        const catI = CAT[proposed[i].star], catJ = CAT[proposed[j].star];
        const angDist = angSep(catI[0], catI[1], catJ[0], catJ[1]);
        scales.push({ i, j, scale: angDist / pxDist });
      }
    }
    if (scales.length > 0) {
      scales.sort((a,b) => a.scale - b.scale);
      const median = scales[Math.floor(scales.length / 2)].scale;
      const reject = new Set();
      for (const s of scales) {
        if (Math.abs(s.scale - median) / median > 0.2) {
          reject.add(s.i); reject.add(s.j);
        }
      }
      proposed = proposed.filter((_, idx) => !reject.has(idx));
    }
    if (proposed.length < 2) {
      return { matches: [], rejected: proposed, plateResult: null,
        message: 'Pairwise consistency check rejected all matches.' };
    }
  }

  // Step 4: Plate-solve verification [NEW]
  const solveStars = proposed.map(a => {
    const cand = topN.find(c => c.id === a.candId);
    const cat = CAT[a.star];
    return { ra_h: cat[0], dec_d: cat[1], px: cand.px, py: cand.py };
  });
  const plateResult = plateSolve(solveStars);
  if (!plateResult || plateResult.rmsResidual > 0.03) {
    return { matches: [], rejected: proposed, plateResult,
      message: `Plate solve ${!plateResult ? 'failed' : 'rmsResidual ' + plateResult.rmsResidual.toFixed(4) + ' > 0.03'}.` };
  }

  // Verify each match position against projection
  const clusterPx = opts.clusterPx || 0.02; // fractional coords
  const verified = [], rejected = [];
  for (const a of proposed) {
    const cand = topN.find(c => c.id === a.candId);
    const cat = CAT[a.star];
    const proj = projectToPixel(cat[0], cat[1], plateResult);
    if (proj && Math.hypot(proj.px - cand.px, proj.py - cand.py) < clusterPx * 2) {
      verified.push({ ...a, verified: true });
    } else {
      rejected.push(a);
    }
  }

  // Step 5: Output
  return {
    matches: verified,
    rejected,
    plateResult,
    message: verified.length
      ? `Verified ${verified.length} star${verified.length > 1 ? 's' : ''}: ${verified.map(m => m.star).join(', ')}`
      : 'No matches survived verification.'
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add js/auto-id.js
git commit -m "feat: extract auto-id.js — triangle hash matching with 5-step verification pipeline"
```

---

### Task 7: Create `js/altitude.js`

New module with alt/az conversions, altitude fix, photo altitude, device orientation, and altitude resolution.

**Files:**
- Create: `js/altitude.js`

- [ ] **Step 1: Create `js/altitude.js` with alt/az conversions and altitude fix**

Extract `equatorialToAltAz` (lines 745-753), `altazToEquatorial` (lines 755-764), and `altitudeFix` (lines 1110-1144).

```js
import { D2R, R2D, nrm, clamp, gmst } from './math.js';

export function equatorialToAltAz(ra_h, dec_d, lat_d, lon_d, date) {
  // ... (existing code from lines 745-753)
}

export function altazToEquatorial(alt_d, az_d, lat_d, lon_d, date) {
  // ... (existing code from lines 755-764)
}

export function altitudeFix(altStars, utcDate, ap) {
  // ... (existing code from lines 1110-1144)
  // Input uses alt_obs (Marcq St-Hilaire convention)
  // Caller maps sighting.alt_manual → alt_obs
}
```

- [ ] **Step 2: Add `computePhotoAltitude` (new — spec B2 fix)**

Implements the horizon great-circle method from the spec:

```js
import { pixelToSky } from './plate-solve.js';
import { angSep } from './math.js';

export function computePhotoAltitude(starRa_h, starDec_d, horizonLine, solve) {
  if (!horizonLine || !solve) return null;

  // Sample two well-separated points on the horizon line
  const { x1, y1, x2, y2 } = horizonLine;
  const dx = x2 - x1, dy = y2 - y1;
  // Use points at 20% and 80% along the line for good separation
  const h1 = pixelToSky(x1 + dx * 0.2, y1 + dy * 0.2, solve);
  const h2 = pixelToSky(x1 + dx * 0.8, y1 + dy * 0.8, solve);
  if (!h1 || !h2) return null;

  // Convert to unit vectors on celestial sphere
  const toVec = (ra_h, dec_d) => {
    const ra = ra_h * 15 * D2R, dec = dec_d * D2R;
    return [Math.cos(dec)*Math.cos(ra), Math.cos(dec)*Math.sin(ra), Math.sin(dec)];
  };
  const v1 = toVec(h1.ra_h, h1.dec_d);
  const v2 = toVec(h2.ra_h, h2.dec_d);
  const vs = toVec(starRa_h, starDec_d);

  // Horizon great-circle normal: n = normalize(v1 x v2)
  const nx = v1[1]*v2[2] - v1[2]*v2[1];
  const ny = v1[2]*v2[0] - v1[0]*v2[2];
  const nz = v1[0]*v2[1] - v1[1]*v2[0];
  const nlen = Math.sqrt(nx*nx + ny*ny + nz*nz);
  if (nlen < 1e-10) return null;
  let nnx = nx/nlen, nny = ny/nlen, nnz = nz/nlen;

  // Determine sign: "above horizon" should be positive
  // Check which side the image center falls on
  const center = pixelToSky(0.5, 0.5, solve);
  if (center) {
    const vc = toVec(center.ra_h, center.dec_d);
    const dotCenter = vc[0]*nnx + vc[1]*nny + vc[2]*nnz;
    // Stars above horizon should have same sign as image center (center is above horizon)
    // If center dot n is negative, flip n
    if (dotCenter < 0) { nnx = -nnx; nny = -nny; nnz = -nnz; }
  }

  // Altitude = angular distance from star to horizon great circle
  const dotStar = vs[0]*nnx + vs[1]*nny + vs[2]*nnz;
  return R2D * Math.asin(clamp(dotStar, -1, 1));
}
```

- [ ] **Step 3: Add `resolvedAltitude` and `DeviceAltitudeCapture`**

```js
export function resolvedAltitude(sighting) {
  if (sighting.alt_manual != null) return { value: sighting.alt_manual, source: 'manual' };
  if (sighting.alt_device != null) return { value: sighting.alt_device, source: 'device' };
  if (sighting.alt_photo  != null) return { value: sighting.alt_photo,  source: 'photo' };
  return null;
}

export class DeviceAltitudeCapture {
  constructor() {
    this._pitch = null;
    this._handler = null;
    this._callback = null;
    this._active = false;
  }

  isAvailable() {
    return typeof DeviceOrientationEvent !== 'undefined';
  }

  start() {
    if (this._active) return;
    this._handler = (e) => {
      if (e.beta != null) {
        this._pitch = 90 - Math.abs(e.beta); // beta=0 is flat, 90 is vertical
        if (this._callback) this._callback(this._pitch);
      }
    };
    window.addEventListener('deviceorientation', this._handler);
    this._active = true;
  }

  stop() {
    if (this._handler) window.removeEventListener('deviceorientation', this._handler);
    this._active = false;
  }

  capture() { return this._pitch; }

  onUpdate(callback) { this._callback = callback; }
}
```

- [ ] **Step 4: Commit**

```bash
git add js/altitude.js
git commit -m "feat: create altitude.js — alt/az conversions, intercept fix, computePhotoAltitude, device capture"
```

---

### Task 8: Create `js/overlay.js`

Extract all SVG overlay drawing into a pure function of state.

**Files:**
- Create: `js/overlay.js`

- [ ] **Step 1: Create `js/overlay.js` with `drawOverlay`**

Extract `drawOverlay` (lines 769-797) and `drawCelestialGrid` (lines 802-913) into a single module. Instead of accessing globals, receive the full state as parameter.

```js
import { R2D } from './math.js';
import { CAT, CAT_ENTRIES, CONST_LINES } from './catalog.js';
import { projectToPixel } from './plate-solve.js';
import { altazToEquatorial } from './altitude.js';

export function drawOverlay(svg, state) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const ns = 'http://www.w3.org/2000/svg';
  function el(tag, attrs) { /* ... */ }
  function pct(v) { return (v * 100).toFixed(3) + '%'; }

  // Horizon dots/line (from state.horizonPts, state.horizonLine)
  // ... (existing horizon drawing logic from lines 778-791)

  // Celestial grid (requires state.solveResult)
  if (state.solveResult && state.solveResult.cx) {
    drawCelestialGrid(svg, state, pct, el);
  }
}

function drawCelestialGrid(svg, state, pct, el) {
  const solve = state.solveResult;
  const sightings = state.sightings;

  // ... (existing grid logic from lines 802-913)
  // Uses state.overlayFlags.radec, .stars, .const, .altaz
  // Uses state.fix and state.utcDate for Alt/Az grid
  // Replace lastFix with state.fix
  // Replace overlayFlags with state.overlayFlags
}
```

- [ ] **Step 2: Commit**

```bash
git add js/overlay.js
git commit -m "feat: extract overlay.js — SVG overlay as pure function of state"
```

---

### Task 9: Create `js/ui.js`

Extract all DOM manipulation, event handlers, and rendering logic. This is the largest module (~600 lines). All state access goes through the store. The `computePipeline` callback (provided by `app.js`) is called after any state change that affects sightings, horizon, or time — it handles plate solve, photo altitudes, and fix computation, then calls `store.update()` with results. UI rendering is driven by `store.on('change', ...)`.

**Important design boundary:** `ui.js` owns DOM reads/writes and user interaction. `app.js` owns the computation pipeline. `ui.js` calls `computePipeline()` when it knows computation-relevant state changed. `app.js`'s `store.on('change')` listener handles overlay redraw only — it does NOT call `computePipeline` to avoid infinite loops.

**Removed functions:** `distToLine`, `updateAltitudeScale`, `altitudeForCandidate` — these are replaced by `computePhotoAltitude` in `altitude.js` (requires plate solve; no altitude estimates until 2+ stars identified, which is acceptable since photo altitude is one of three sources).

**Renamed field:** `alt_obs` → `alt_manual` in all sighting objects.

**Files:**
- Create: `js/ui.js`

- [ ] **Step 1: Create `js/ui.js` — imports and `initUI` skeleton**

```js
import { CAT, CAT_BY_MAG, CAT_ENTRIES } from './catalog.js';
import { detectBrightSpots, DEFAULT_DETECTION_OPTS } from './detection.js';
import { runAutoID } from './auto-id.js';
import { resolvedAltitude } from './altitude.js';
import { nrm } from './math.js';

export function initUI(store, computePipeline) {
  let nextId = 1;
  let leafMap = null, leafMk = null;

  // ── Utility ──────────────────────────────────────────────
  function fmtC(deg, t) {
    const a = Math.abs(deg), d = Math.floor(a);
    const m = ((a - d) * 60).toFixed(1);
    const h = t === 'lat' ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
    return `${d}&deg;&thinsp;${m}&prime;&thinsp;${h}`;
  }

  // ── File handling ────────────────────────────────────────
  const dzEl = document.getElementById('dz');
  dzEl.addEventListener('dragover', e => { e.preventDefault(); dzEl.classList.add('over'); });
  dzEl.addEventListener('dragleave', () => dzEl.classList.remove('over'));
  dzEl.addEventListener('drop', e => {
    e.preventDefault(); dzEl.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
  });
  document.getElementById('fi').addEventListener('change', function () {
    if (this.files[0]) handleFile(this.files[0]);
  });

  async function handleFile(file) {
    store.update({ sightings: [], candidates: [], horizonPts: [], horizonLine: null,
                   solveResult: null, fix: null, imageLoaded: false });
    clearMarkers();
    const url = URL.createObjectURL(file);
    const imgEl = document.getElementById('pi');
    imgEl.src = url;
    await new Promise(r => imgEl.onload = r);
    store.update({ imageLoaded: true, imageUrl: url });
    ['pv-section', 'orient-card', 'tc', 'sc'].forEach(id =>
      document.getElementById(id).style.display = '');
    document.getElementById('democard').style.display = 'none';
    document.getElementById('autoid-bar').className = 'autoid-bar';
    // EXIF time extraction
    if (window.EXIF) {
      EXIF.getData(file, function () {
        const dt = EXIF.getTag(this, 'DateTimeOriginal') || EXIF.getTag(this, 'DateTime');
        const n = document.getElementById('exifnote');
        const timeInput = document.getElementById('ui');
        if (dt) {
          timeInput.value = dt.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
          n.textContent = 'Time from EXIF — confirm UTC.';
        } else {
          timeInput.value = new Date().toISOString().slice(0, 19);
          n.textContent = 'No EXIF — defaulting to current UTC.';
        }
        store.update({ utcDate: new Date(timeInput.value + 'Z') });
      });
    }
    document.getElementById('pvwrap').addEventListener('click', handlePhotoClick);
    redetect();
  }

  // ── Detection ────────────────────────────────────────────
  function redetect() {
    const imgEl = document.getElementById('pi');
    if (!imgEl.src || imgEl.src === location.href) return;
    const state = store.get();
    const ids = new Set(state.sightings.map(s => s.candId).filter(Boolean));
    const kept = state.candidates.filter(c => ids.has(c.id));
    clearUnidentifiedMarkers(state);
    const found = detectBrightSpots(imgEl, state.detectionOpts);
    const cW = Math.min(imgEl.naturalWidth, 800);
    const cH = Math.round(imgEl.naturalHeight * cW / imgEl.naturalWidth);
    const clPx = state.detectionOpts.clusterPx || 18;
    const newCands = [...kept];
    let added = 0;
    for (const f of found) {
      const nearCand = newCands.some(c => Math.hypot((c.px-f.px)*cW, (c.py-f.py)*cH) < clPx);
      const nearSight = state.sightings.some(s =>
        s.px != null && Math.hypot((s.px-f.px)*cW, (s.py-f.py)*cH) < clPx);
      if (nearCand || nearSight) continue;
      const id = nextId++;
      newCands.push({ id, px: f.px, py: f.py, v: f.v, radius: f.radius });
      renderCandidateDot(id, f.px, f.py, 'candidate');
      added++;
    }
    store.update({ candidates: newCands });
    document.getElementById('det-note').textContent =
      found.length ? `${added} candidates detected` : 'No bright spots — click to place manually';
  }

  function detSettingsChanged() {
    const pct = parseInt(document.getElementById('det-pct').value);
    const maxStars = parseInt(document.getElementById('det-max').value);
    const clusterPx = parseInt(document.getElementById('det-cluster').value);
    document.getElementById('det-pct-val').textContent = pct + '%ile';
    if (isFinite(pct) && isFinite(maxStars) && isFinite(clusterPx)) {
      store.update({ detectionOpts: { pct, maxStars, clusterPx } });
      redetect();
    }
  }

  // ── Mode management ──────────────────────────────────────
  function setMode(m) {
    store.update({ mode: m });
    document.getElementById('btn-identify').className = 'mode-btn' + (m === 'identify' ? ' active' : '');
    document.getElementById('btn-horizon').className = 'mode-btn' + (m === 'horizon' ? ' active-horizon' : '');
    document.getElementById('mode-hint').textContent = m === 'horizon' ? 'Click 2 points on the visible horizon' : '';
    if (m === 'horizon') store.update({ horizonPts: [] });
  }

  // ── Photo click (identify + horizon) ─────────────────────
  function handlePhotoClick(e) {
    if (e._handled) return; e._handled = true;
    const img = document.getElementById('pi'), rect = img.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width, py = (e.clientY - rect.top) / rect.height;
    if (px < 0 || px > 1 || py < 0 || py > 1) return;
    const state = store.get();

    if (state.mode === 'horizon') {
      const pts = [...state.horizonPts, { px, py }];
      store.update({ horizonPts: pts });
      if (pts.length >= 2) { finalizeHorizon(pts); setMode('identify'); }
      return;
    }

    // Identify mode
    const W = rect.width, H = rect.height;
    const near = state.candidates.find(c => Math.hypot((c.px-px)*W, (c.py-py)*H) < 18);
    if (near) { openPicker(near.id); return; }
    const id = nextId++;
    store.update({ candidates: [...state.candidates, { id, px, py, v: 0, radius: 0 }] });
    renderCandidateDot(id, px, py, 'manual-pt');
    openPicker(id);
  }

  // ── Horizon ──────────────────────────────────────────────
  function finalizeHorizon(pts) {
    const [p1, p2] = pts;
    const img = document.getElementById('pi'), W = img.offsetWidth, H = img.offsetHeight;
    const angle = Math.atan2((p2.py-p1.py)*H, (p2.px-p1.px)*W) * (180/Math.PI);
    const horizonLine = { x1: p1.px, y1: p1.py, x2: p2.px, y2: p2.py, angle };
    store.update({ horizonLine, orientation: { ...store.get().orientation, roll: -angle } });
    document.getElementById('h-angle').textContent = angle.toFixed(1) + '\u00B0';
    document.getElementById('horizon-info').style.display = '';
    document.getElementById('o-roll').value = (-angle).toFixed(1);
    computePipeline();
  }

  function clearHorizon(silent) {
    store.update({ horizonPts: [], horizonLine: null });
    document.getElementById('horizon-info').style.display = 'none';
    if (!silent && store.get().mode === 'horizon') setMode('identify');
    computePipeline();
  }

  // ── Marker rendering ────────────────────────────────────
  function renderCandidateDot(id, px, py, cls) {
    const wrap = document.getElementById('pvwrap');
    const dot = document.createElement('div');
    dot.id = `cand-${id}`; dot.className = `cmarker ${cls}`;
    dot.style.left = `${(px*100).toFixed(3)}%`; dot.style.top = `${(py*100).toFixed(3)}%`;
    dot.title = 'Click to identify';
    dot.addEventListener('click', e => { e.stopPropagation(); e._handled = true; openPicker(id); });
    wrap.appendChild(dot);
  }

  function updateCandidateMarker(id, cls, label, isAuto) {
    const dot = document.getElementById(`cand-${id}`); if (!dot) return;
    dot.className = `cmarker ${cls}`; dot.title = label || '';
    const old = document.getElementById(`lbl-${id}`); if (old) old.remove();
    if (label) {
      const lbl = document.createElement('div');
      lbl.id = `lbl-${id}`; lbl.className = 'cmk-lbl' + (isAuto ? ' auto' : '');
      lbl.textContent = label; lbl.style.left = dot.style.left; lbl.style.top = dot.style.top;
      document.getElementById('pvwrap').appendChild(lbl);
    }
  }

  function clearMarkers() { document.querySelectorAll('.cmarker,.cmk-lbl').forEach(e => e.remove()); }

  function clearUnidentifiedMarkers(state) {
    const ids = new Set(state.sightings.map(s => s.candId).filter(Boolean));
    state.candidates.forEach(c => {
      if (!ids.has(c.id)) {
        document.getElementById(`cand-${c.id}`)?.remove();
        document.getElementById(`lbl-${c.id}`)?.remove();
      }
    });
  }

  // ── Picker ───────────────────────────────────────────────
  function openPicker(candId) {
    store.update({ pickerCandId: candId });
    const state = store.get();
    const existing = state.sightings.find(s => s.candId === candId);
    document.getElementById('picker-title').textContent = existing
      ? `Replace: ${existing.name}`
      : (candId !== null ? 'Identify star' : 'Add star (no pixel position)');
    document.getElementById('psearch').value = '';
    ['mra', 'mdec', 'mname'].forEach(id => document.getElementById(id).value = '');
    // Hide altitude hint (photo altitude requires plate solve now)
    document.getElementById('picker-alt-hint').style.display = 'none';
    filterStars();
    document.getElementById('picker-wrap').style.display = 'flex';
    setTimeout(() => document.getElementById('psearch').focus(), 50);
    document.getElementById('picker-wrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closePicker() {
    document.getElementById('picker-wrap').style.display = 'none';
    store.update({ pickerCandId: null });
  }

  function filterStars() {
    const q = document.getElementById('psearch').value.toLowerCase().trim();
    const pl = document.getElementById('plist');
    pl.innerHTML = '';
    const state = store.get();
    const existing = state.sightings.find(s => s.candId === state.pickerCandId);
    // Show current identification at top when replacing
    if (existing && !q) {
      const catEntry = CAT[existing.name];
      if (catEntry) {
        const [ra_h, dec_d, mag] = catEntry;
        const row = document.createElement('div'); row.className = 'pstar';
        row.style.cssText = 'background:#0a1e10;border-bottom:.5px solid #0f3820';
        row.onclick = () => confirmStar(existing.name, ra_h, dec_d);
        row.innerHTML = `<span class="pstar-name" style="color:var(--teal2)">${existing.name} \u2713</span><span class="pstar-coords">${ra_h.toFixed(2)}h ${(dec_d>=0?'+':'')+dec_d.toFixed(1)}\u00B0</span><span class="pstar-mag ${mag<1?'bright':''}">${mag>=0?'+':''}${mag.toFixed(1)}</span>`;
        pl.appendChild(row);
      }
    }
    CAT_BY_MAG.filter(([n]) => !q || n.toLowerCase().includes(q)).slice(0, 30).forEach(([name, [ra_h, dec_d, mag]]) => {
      const row = document.createElement('div'); row.className = 'pstar';
      row.onclick = () => confirmStar(name, ra_h, dec_d);
      row.innerHTML = `<span class="pstar-name">${name}</span><span class="pstar-coords">${ra_h.toFixed(2)}h ${(dec_d>=0?'+':'')+dec_d.toFixed(1)}\u00B0</span><span class="pstar-mag ${mag<1?'bright':''}">${mag>=0?'+':''}${mag.toFixed(1)}</span>`;
      pl.appendChild(row);
    });
  }

  function confirmStar(name, ra_h, dec_d) {
    const state = store.get();
    const cand = state.candidates.find(c => c.id === state.pickerCandId);
    const px = cand ? cand.px : null, py = cand ? cand.py : null;
    const cls = cand?.v === 0 ? 'manual-pt identified' : 'identified';
    addSighting({ name, ra_h, dec_d, px, py, candId: state.pickerCandId, autoID: false });
    if (state.pickerCandId !== null) updateCandidateMarker(state.pickerCandId, cls, name, false);
    closePicker();
  }

  function confirmManual() {
    const ra_h = parseFloat(document.getElementById('mra').value);
    const dec_d = parseFloat(document.getElementById('mdec').value);
    const name = document.getElementById('mname').value.trim() || `Star ${nextId}`;
    if (!isFinite(ra_h) || !isFinite(dec_d)) return;
    const state = store.get();
    const cand = state.candidates.find(c => c.id === state.pickerCandId);
    const px = cand ? cand.px : null, py = cand ? cand.py : null;
    addSighting({ name, ra_h, dec_d, px, py, candId: state.pickerCandId, autoID: false });
    if (state.pickerCandId !== null) updateCandidateMarker(state.pickerCandId, cand?.v === 0 ? 'manual-pt identified' : 'identified', name, false);
    closePicker();
  }

  // ── Sightings ────────────────────────────────────────────
  function addSighting(s) {
    const state = store.get();
    let sightings = [...state.sightings];
    if (s.candId !== null) {
      sightings = sightings.filter(x => x.candId !== s.candId);
    }
    sightings.push({ id: nextId++, ...s, alt_manual: null, alt_device: null, alt_photo: null });
    store.update({ sightings });
    ['sc', 'tc'].forEach(id => document.getElementById(id).style.display = '');
    computePipeline();
  }

  function removeSighting(id) {
    const state = store.get();
    const s = state.sightings.find(x => x.id === id);
    if (s?.candId != null) {
      const cand = state.candidates.find(c => c.id === s.candId);
      updateCandidateMarker(s.candId, cand?.v === 0 ? 'manual-pt' : 'candidate', null, false);
    }
    store.update({ sightings: state.sightings.filter(x => x.id !== id) });
    computePipeline();
  }

  function clearSightings() {
    store.update({ sightings: [], solveResult: null, fix: null });
    ['fc', 'nfc', 'mc'].forEach(id => document.getElementById(id).style.display = 'none');
    const state = store.get();
    state.candidates.forEach(c => updateCandidateMarker(c.id, c.v === 0 ? 'manual-pt' : 'candidate', null, false));
  }

  // ── Sighting rendering ──────────────────────────────────
  function renderSightings(state) {
    const sl = document.getElementById('sl');
    if (!state.sightings.length) {
      sl.innerHTML = '<div class="fnote" style="padding:3px 0">No stars identified yet.</div>';
      return;
    }
    sl.innerHTML = '';
    state.sightings.forEach(s => {
      const wrap = document.createElement('div'); wrap.className = 'srow-wrap';
      const row = document.createElement('div'); row.className = 'srow';
      const hasPx = s.px !== null, isAuto = s.autoID;
      const resolved = resolvedAltitude(s);
      const altBadge = resolved
        ? `<span style="font-size:10px;color:${resolved.source==='manual'?'#6ab0c8':resolved.source==='device'?'#b090d0':'#50a060'};font-family:var(--mono);margin-left:4px">[${resolved.source[0].toUpperCase()}] ${resolved.value.toFixed(1)}&deg;</span>`
        : '';
      row.innerHTML = `<span class="spip${isAuto?' auto':hasPx?'':' nopx'}"></span><span class="sname">${s.name}${isAuto?' &#9889;':''}</span><span class="scoord">RA ${s.ra_h.toFixed(3)}h&nbsp; Dec ${(s.dec_d>=0?'+':'')+s.dec_d.toFixed(2)}&deg;</span>${hasPx?`<span class="salt">${(s.px*100).toFixed(1)}%,${(s.py*100).toFixed(1)}%</span>`:`<span class="snopx">no pixel pos</span>`}${altBadge}<span style="font-size:10px;color:#4a7890;cursor:pointer;padding:1px 5px;border-radius:3px;margin-left:2px" data-edit="${s.id}">edit</span><span class="srmv" data-remove="${s.id}">&#x2715;</span>`;

      // Inline edit panel
      const edit = document.createElement('div'); edit.className = 'sedit'; edit.id = `sedit-${s.id}`;
      const hasManual = s.alt_manual != null && isFinite(s.alt_manual);
      edit.innerHTML = `
        <div class="sedit-row"><span class="sedit-lbl">Star</span><span class="sedit-val">${s.name}</span></div>
        <div class="sedit-row"><span class="sedit-lbl">Alt (photo)</span><span class="sedit-val">${s.alt_photo != null ? s.alt_photo.toFixed(1)+'\u00B0' : '\u2014'}</span></div>
        <div class="sedit-row"><span class="sedit-lbl">Alt (device)</span><span class="sedit-val">${s.alt_device != null ? s.alt_device.toFixed(1)+'\u00B0' : '\u2014'}</span></div>
        <div class="sedit-row">
          <span class="sedit-lbl">Observed Ho</span>
          <input type="number" class="sedit-inp" id="altinp-${s.id}" placeholder="degrees" step="0.1" min="-2" max="90" value="${hasManual?s.alt_manual.toFixed(1):''}">
          <span class="sedit-note">&deg; \u2014 manual override</span>
        </div>
        <div class="sedit-row">
          <button class="btn btn-teal" style="font-size:10px;padding:3px 8px" data-savealt="${s.id}">Save</button>
          <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" data-canceledit="${s.id}">Cancel</button>
          ${hasManual?`<button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--red)" data-clearalt="${s.id}">Clear Ho</button>`:''}
        </div>`;
      wrap.appendChild(row); wrap.appendChild(edit);
      sl.appendChild(wrap);
    });

    // Bind edit/remove click handlers via event delegation
    sl.onclick = e => {
      const t = e.target;
      if (t.dataset.edit) toggleSightingEdit(parseInt(t.dataset.edit));
      if (t.dataset.remove) removeSighting(parseInt(t.dataset.remove));
      if (t.dataset.savealt) saveAltManual(parseInt(t.dataset.savealt));
      if (t.dataset.canceledit) toggleSightingEdit(parseInt(t.dataset.canceledit));
      if (t.dataset.clearalt) clearAltManual(parseInt(t.dataset.clearalt));
    };
  }

  function toggleSightingEdit(id) {
    const el = document.getElementById(`sedit-${id}`);
    if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
  }

  function saveAltManual(id) {
    const state = store.get();
    const v = parseFloat(document.getElementById(`altinp-${id}`)?.value);
    const sightings = state.sightings.map(s =>
      s.id === id ? { ...s, alt_manual: isFinite(v) ? v : null } : s);
    store.update({ sightings });
    toggleSightingEdit(id);
    computePipeline();
  }

  function clearAltManual(id) {
    const state = store.get();
    const sightings = state.sightings.map(s =>
      s.id === id ? { ...s, alt_manual: null } : s);
    store.update({ sightings });
    computePipeline();
  }

  // ── Fix card rendering ───────────────────────────────────
  function renderFixCard(state) {
    if (!state.fix || !isFinite(state.fix.lat) || !isFinite(state.fix.lon)) {
      if (state.sightings.length) {
        document.getElementById('fc').style.display = 'none';
        document.getElementById('nfc').style.display = '';
        document.getElementById('nfm').textContent = 'Add \u22652 identified stars with pixel positions for a fix.';
      } else {
        ['fc', 'nfc', 'mc'].forEach(id => document.getElementById(id).style.display = 'none');
      }
      return;
    }
    document.getElementById('fc').style.display = '';
    document.getElementById('nfc').style.display = 'none';
    document.getElementById('mc').style.display = '';
    const fix = state.fix;
    document.getElementById('fm').innerHTML = `<div class="met"><div class="mv">${fmtC(fix.lat,'lat')}</div><div class="ml">Latitude</div></div><div class="met"><div class="mv">${fmtC(fix.lon,'lon')}</div><div class="ml">Longitude</div></div><div class="met"><div class="mv">${state.sightings.filter(s=>s.px!=null).length}</div><div class="ml">Stars used</div></div>`;
    document.getElementById('fd').innerHTML = `Method: ${state.fixMethod || 'Plate solve'}<div class="poc-note">Plate solve: field centre RA/Dec = zenith &rarr; lat/lon. Altitude intercept: Marcq St-Hilaire method refines fix using observed altitudes (Ho).</div>`;
    showMap(fix.lat, fix.lon, `${fmtC(fix.lat,'lat')} ${fmtC(fix.lon,'lon')}`);
  }

  // ── Overlay toggles ─────────────────────────────────────
  function toggleOverlay(flag) {
    const state = store.get();
    const flags = { ...state.overlayFlags, [flag]: !state.overlayFlags[flag] };
    store.update({ overlayFlags: flags });
    const btn = document.getElementById('ovl-' + flag);
    if (btn) btn.className = 'mode-btn' + (flags[flag] ? ' active' : '');
  }

  // ── Orientation ──────────────────────────────────────────
  function orientChanged() {
    const az = parseFloat(document.getElementById('o-az').value);
    const tilt = parseFloat(document.getElementById('o-tilt').value);
    const roll = parseFloat(document.getElementById('o-roll').value);
    store.update({ orientation: {
      az: isFinite(az) ? az : null,
      tilt: isFinite(tilt) ? tilt : null,
      roll: isFinite(roll) ? roll : null
    }});
  }

  function clearOrientation() {
    store.update({ orientation: { az: null, tilt: null, roll: null } });
    ['o-az', 'o-tilt', 'o-roll'].forEach(id => document.getElementById(id).value = '');
  }

  // ── Auto-ID ──────────────────────────────────────────────
  function doAutoID() {
    const bar = document.getElementById('autoid-bar');
    bar.textContent = 'Running pattern match\u2026'; bar.className = 'autoid-bar visible';
    setTimeout(() => {
      const state = store.get();
      const result = runAutoID(state.candidates, state.sightings,
        { clusterPx: state.detectionOpts.clusterPx / 1000 });
      bar.textContent = result.message;
      if (result.matches.length) {
        let sightings = [...state.sightings];
        for (const m of result.matches) {
          const cat = CAT[m.star]; if (!cat) continue;
          const cand = state.candidates.find(c => c.id === m.candId); if (!cand) continue;
          sightings = sightings.filter(s => s.candId !== m.candId);
          sightings.push({ id: nextId++, name: m.star, ra_h: cat[0], dec_d: cat[1],
            px: cand.px, py: cand.py, candId: m.candId, autoID: true,
            alt_manual: null, alt_device: null, alt_photo: null });
          updateCandidateMarker(m.candId, 'auto-id', m.star, true);
        }
        store.update({ sightings });
        computePipeline();
      }
    }, 10);
  }

  // ── Map ──────────────────────────────────────────────────
  function showMap(lat, lon, label) {
    if (!window.L) return;
    if (!leafMap) {
      leafMap = L.map('map', { zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { attribution: '\u00A9 OSM', maxZoom: 18 }).addTo(leafMap);
    }
    if (leafMk) { leafMap.removeLayer(leafMk); leafMk = null; }
    setTimeout(() => leafMap.invalidateSize(), 80);
    if (lat !== null) {
      leafMap.setView([lat, lon], 5);
      leafMk = L.circleMarker([lat, lon], { radius: 9, fillColor: '#1a9e7a',
        color: '#0a3828', weight: 2, fillOpacity: 0.88 }).addTo(leafMap);
      if (label) leafMk.bindPopup(`<b>Celestial fix</b><br>${label}`).openPopup();
    } else leafMap.setView([20, 0], 2);
  }

  // ── Demo ─────────────────────────────────────────────────
  const DEMO = [
    { name: 'Alphecca', px: 0.445, py: 0.734 },
    { name: 'Kochab',   px: 0.456, py: 0.288 },
    { name: 'Arcturus', px: 0.235, py: 0.798 }
  ];

  function loadDemo() {
    store.update({ sightings: [], candidates: [], solveResult: null, fix: null });
    clearMarkers();
    ['tc', 'sc', 'orient-card'].forEach(id => document.getElementById(id).style.display = '');
    document.getElementById('ui').value = '2025-01-23T21:00:00';
    document.getElementById('exifnote').textContent = 'Demo time \u2014 synthetic test data.';
    const sightings = DEMO.map(d => {
      const e = CAT[d.name]; if (!e) return null;
      return { id: nextId++, name: d.name, ra_h: e[0], dec_d: e[1], px: d.px, py: d.py,
        candId: null, autoID: false, alt_manual: null, alt_device: null, alt_photo: null };
    }).filter(Boolean);
    store.update({ sightings, utcDate: new Date('2025-01-23T21:00:00Z') });
    computePipeline();
  }

  // ── Time input handler ───────────────────────────────────
  document.getElementById('ui').addEventListener('input', () => {
    const v = document.getElementById('ui').value;
    if (v) { store.update({ utcDate: new Date(v + 'Z') }); computePipeline(); }
  });

  // ── Bind inline-handler replacements (from HTML) ─────────
  // These replace the onclick="..." attributes removed from index.html
  document.getElementById('btn-identify').addEventListener('click', () => setMode('identify'));
  document.getElementById('btn-horizon').addEventListener('click', () => setMode('horizon'));
  document.querySelector('[data-action="auto-id"]').addEventListener('click', doAutoID);
  document.querySelector('[data-action="clear-horizon"]').addEventListener('click', () => clearHorizon());
  document.querySelector('[data-action="redetect"]').addEventListener('click', redetect);
  document.querySelector('[data-action="clear-sightings"]').addEventListener('click', clearSightings);
  document.querySelector('[data-action="load-demo"]').addEventListener('click', loadDemo);
  document.querySelector('[data-action="confirm-manual"]').addEventListener('click', confirmManual);
  document.querySelector('[data-action="close-picker"]').addEventListener('click', closePicker);
  document.getElementById('psearch').addEventListener('input', filterStars);
  document.getElementById('det-pct').addEventListener('input', detSettingsChanged);
  document.getElementById('det-max').addEventListener('input', detSettingsChanged);
  document.getElementById('det-cluster').addEventListener('input', detSettingsChanged);
  ['ovl-radec', 'ovl-stars', 'ovl-const', 'ovl-altaz'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => toggleOverlay(id.replace('ovl-', '')));
  });
  ['o-az', 'o-tilt', 'o-roll'].forEach(id =>
    document.getElementById(id).addEventListener('input', orientChanged));
  document.querySelector('[data-action="clear-orientation"]').addEventListener('click', clearOrientation);

  // ── State change → render ────────────────────────────────
  store.on('change', (state) => {
    renderSightings(state);
    renderFixCard(state);
  });
}
```

This is the complete `ui.js` implementation. All state mutations go through `store.update()`. Computation is triggered via the `computePipeline` callback (not via store listener, to avoid infinite loops).

- [ ] **Step 2: Commit**

```bash
git add js/ui.js
git commit -m "feat: create ui.js — all DOM manipulation, rendering, event handlers"
```

---

### Task 10: Create `js/app.js` and `index.html`

Wire everything together. Build the computation pipeline.

**Design boundary:** `computePipeline` is called explicitly by `ui.js` (via callback) when sightings, horizon, or time change. The `store.on('change')` listener in `app.js` only redraws the overlay — it does NOT call `computePipeline`, avoiding infinite loops since `computePipeline` itself calls `store.update()`.

**Files:**
- Create: `js/app.js`
- Create: `index.html`

- [ ] **Step 1: Create `js/app.js`**

```js
import { createStore } from './state.js';
import { initUI } from './ui.js';
import { plateSolve } from './plate-solve.js';
import { computePhotoAltitude, altitudeFix, resolvedAltitude,
         DeviceAltitudeCapture } from './altitude.js';
import { drawOverlay } from './overlay.js';
import { zenithFix } from './math.js';
import { DEFAULT_DETECTION_OPTS } from './detection.js';

const store = createStore({
  imageLoaded: false,
  imageUrl: null,
  imageDimensions: null,
  detectionOpts: { ...DEFAULT_DETECTION_OPTS },
  candidates: [],
  sightings: [],
  pickerCandId: null,
  horizonPts: [],
  horizonLine: null,
  orientation: { az: null, tilt: null, roll: null },
  solveResult: null,
  fix: null,
  fixMethod: '',
  utcDate: null,
  overlayFlags: { radec: true, stars: true, const: false, altaz: false },
  mode: 'identify',
});

// ── Computation pipeline ─────────────────────────────────
// Called explicitly by ui.js when computation-relevant state changes.
// NOT called from store.on('change') to avoid infinite loops.
function computePipeline() {
  const state = store.get();
  const utcDate = state.utcDate;
  if (!utcDate || !isFinite(utcDate)) return;

  const solvable = state.sightings.filter(s =>
    isFinite(s.ra_h) && isFinite(s.dec_d) && s.px != null && s.py != null);
  const anyValid = state.sightings.filter(s =>
    isFinite(s.ra_h) && isFinite(s.dec_d));
  let solveResult = null, fix = null, method = '';

  // Plate solve from pixel positions (≥2 stars)
  if (solvable.length >= 2) {
    const ps = plateSolve(solvable.map(s =>
      ({ ra_h: s.ra_h, dec_d: s.dec_d, px: s.px, py: s.py })));
    if (ps && isFinite(ps.ra_h) && isFinite(ps.dec_d)) {
      solveResult = ps;
      fix = zenithFix(ps.ra_h, ps.dec_d, utcDate);
      method = `Plate solve (${solvable.length} stars)`;
    }
  }

  // Fallback: single star (approximate image centre = zenith)
  if (!fix && solvable.length === 1) {
    fix = zenithFix(solvable[0].ra_h, solvable[0].dec_d, utcDate);
    method = 'Single star (approx. image centre)';
  }

  // Fallback: mean RA/Dec (very coarse, no pixel positions needed)
  if (!fix && anyValid.length >= 1) {
    const mRa = anyValid.reduce((s, x) => s + x.ra_h, 0) / anyValid.length;
    const mDec = anyValid.reduce((s, x) => s + x.dec_d, 0) / anyValid.length;
    fix = zenithFix(mRa, mDec, utcDate);
    method = `Mean RA/Dec (${anyValid.length} stars, very coarse)`;
  }

  // Compute photo altitudes if horizon + solve available
  let updatedSightings = state.sightings;
  if (state.horizonLine && solveResult) {
    updatedSightings = state.sightings.map(s => ({
      ...s,
      alt_photo: (s.px != null && isFinite(s.ra_h) && isFinite(s.dec_d))
        ? computePhotoAltitude(s.ra_h, s.dec_d, state.horizonLine, solveResult)
        : s.alt_photo
    }));
  }

  // Altitude intercept refinement (Marcq St-Hilaire)
  const withAlt = updatedSightings
    .filter(s => isFinite(s.ra_h) && isFinite(s.dec_d) && resolvedAltitude(s) != null)
    .map(s => ({
      ra_h: s.ra_h, dec_d: s.dec_d,
      alt_obs: resolvedAltitude(s).value,  // mapped from alt_manual per spec B5
      name: s.name
    }));

  if (withAlt.length >= 1 && fix) {
    const altResult = altitudeFix(withAlt, utcDate, fix);
    if (isFinite(altResult.lat) && isFinite(altResult.lon)) {
      if (withAlt.length >= 2) {
        fix = { lat: altResult.lat, lon: altResult.lon };
        method += ` + altitude intercept (${withAlt.length} Ho obs)`;
      } else {
        method += ' + 1 Ho obs (LOP only)';
      }
    }
  }

  store.update({ solveResult, fix, fixMethod: method, sightings: updatedSightings });
}

// ── Overlay redraw on any state change ───────────────────
// This is the ONLY store listener in app.js. It does not call computePipeline.
store.on('change', (state) => {
  const svg = document.getElementById('ovl');
  if (svg) drawOverlay(svg, state);
});

// ── Initialize UI ────────────────────────────────────────
initUI(store, computePipeline);

// ── Device orientation (progressive enhancement) ─────────
const deviceCapture = new DeviceAltitudeCapture();
if (deviceCapture.isAvailable()) {
  deviceCapture.start();
  deviceCapture.onUpdate(pitch => {
    // Store latest pitch; ui.js can use it when identifying a star
    store.update({ devicePitch: pitch });
  });
}
```

**Note on `plateSolve` tangent-point values:** The existing `plateSolve` returns `ra0_deg: lastRa0, dec0_deg: lastDe0` which are the tangent-point values from the previous iteration (not the final `ra0`/`de0`). This is intentional — `lastCx`/`lastCy` are the coefficients computed with respect to `lastRa0`/`lastDe0`, so they must be used together. The returned `ra_h`/`dec_d` (from the final `ra0`/`de0`) is the field center. Do not "fix" this apparent mismatch.

- [ ] **Step 2: Create `index.html`**

Copy the HTML structure and CSS from `celestial-nav-v3.html` (lines 1-318). Remove the entire `<script>` block (lines 322-1227). Replace with:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/exif-js/2.3.0/exif.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script type="module" src="js/app.js"></script>
```

Remove all `onclick="..."` inline handlers from the HTML. These will be bound programmatically by `ui.js`.

- [ ] **Step 3: Verify the app loads and basic flow works**

Run: `python3 -m http.server 8888`

Open in browser. Verify:
1. Page loads without console errors
2. Image upload triggers detection
3. Clicking candidates opens picker
4. Identifying 2+ stars triggers plate solve
5. Overlay renders with RA/Dec grid
6. Auto-ID runs with verification pipeline
7. Demo data still works

- [ ] **Step 4: Commit**

```bash
git add js/app.js index.html
git commit -m "feat: create app.js and index.html — full modular app wired up"
```

---

### Task 11: Create `test.html` for pure-function verification

Lightweight browser-based tests for math, plate-solve, and auto-id modules.

**Files:**
- Create: `test.html`

- [ ] **Step 1: Create `test.html`**

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Celestial Tests</title></head>
<body>
<pre id="log"></pre>
<script type="module">
import { D2R, R2D, nrm, gmst, angSep, solve3x3, zenithFix } from './js/math.js';
import { CAT } from './js/catalog.js';
import { plateSolve, projectToPixel, pixelToSky } from './js/plate-solve.js';
import { resolvedAltitude } from './js/altitude.js';

const log = document.getElementById('log');
let pass = 0, fail = 0;

function assert(cond, msg) {
  if (cond) { pass++; log.textContent += `  PASS: ${msg}\n`; }
  else { fail++; log.textContent += `  FAIL: ${msg}\n`; }
}
function approx(a, b, tol = 0.01) { return Math.abs(a - b) < tol; }

// math.js tests
log.textContent += 'math.js\n';
assert(approx(nrm(-10), 350), 'nrm(-10) = 350');
assert(approx(nrm(370), 10), 'nrm(370) = 10');
assert(approx(angSep(0, 0, 6, 0), 90, 0.1), 'angSep 0h,0d to 6h,0d ~ 90 deg');
assert(approx(angSep(CAT['Dubhe'][0], CAT['Dubhe'][1], CAT['Merak'] ? CAT['Merak'][1] : CAT['Dubhe'][1], CAT['Dubhe'][1]), 0, 90), 'angSep returns reasonable value');

// plate-solve round-trip test
log.textContent += '\nplate-solve.js\n';
const testStars = [
  { ra_h: 15.578, dec_d: 26.71, px: 0.445, py: 0.734 },
  { ra_h: 14.845, dec_d: 74.16, px: 0.456, py: 0.288 },
  { ra_h: 14.261, dec_d: 19.18, px: 0.235, py: 0.798 },
];
const solve = plateSolve(testStars);
assert(solve !== null, 'plateSolve returns result');
assert(solve.rmsResidual != null, 'rmsResidual is computed');
assert(solve.rmsResidual < 0.05, 'rmsResidual < 0.05');

if (solve) {
  // pixelToSky round-trip
  const sky = pixelToSky(0.445, 0.734, solve);
  assert(sky !== null, 'pixelToSky returns result');
  if (sky) {
    assert(approx(sky.ra_h, 15.578, 0.5), 'pixelToSky ra_h round-trip');
    assert(approx(sky.dec_d, 26.71, 2), 'pixelToSky dec_d round-trip');
  }

  // projectToPixel round-trip
  const px = projectToPixel(14.261, 19.18, solve);
  assert(px !== null, 'projectToPixel returns result');
  if (px) {
    assert(approx(px.px, 0.235, 0.02), 'projectToPixel px round-trip');
    assert(approx(px.py, 0.798, 0.02), 'projectToPixel py round-trip');
  }
}

// altitude.js tests
log.textContent += '\naltitude.js\n';
assert(resolvedAltitude({ alt_manual: 45 }).source === 'manual', 'manual takes priority');
assert(resolvedAltitude({ alt_device: 30, alt_photo: 25 }).source === 'device', 'device over photo');
assert(resolvedAltitude({ alt_photo: 20 }).source === 'photo', 'photo fallback');
assert(resolvedAltitude({}) === null, 'null when none set');

log.textContent += `\n${pass} passed, ${fail} failed\n`;
</script>
</body></html>
```

- [ ] **Step 2: Open `test.html` in browser and verify all tests pass**

- [ ] **Step 3: Commit**

```bash
git add test.html
git commit -m "feat: add test.html — lightweight browser tests for pure-function modules"
```

---

### Task 12: Cleanup — remove monolith

**Files:**
- Delete: `celestial-nav-v3.html`

- [ ] **Step 1: Final integration test**

Load the new `index.html` and run through the complete workflow:
1. Upload a photo → candidates detected
2. Click candidate → picker opens → identify star
3. Identify 2+ stars → plate solve runs → overlay renders
4. Run Auto-ID → verification pipeline executes
5. Set horizon → photo altitudes computed
6. Enter manual Ho → altitude intercept fix
7. Toggle overlay layers
8. Demo data works

- [ ] **Step 2: Delete `celestial-nav-v3.html`**

```bash
git rm celestial-nav-v3.html
```

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: remove monolithic celestial-nav-v3.html — replaced by modular js/ structure"
```
