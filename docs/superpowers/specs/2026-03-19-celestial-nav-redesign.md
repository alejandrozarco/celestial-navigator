# Celestial Nav App Redesign

**Date**: 2026-03-19
**Status**: Draft
**Goal**: Modular phone-based sextant with plate solving, verified auto-ID, and three-source altitude pipeline.

---

## 1. Overview

Redesign the monolithic `celestial-nav-v3.html` (1230 lines, single `<script>` block) into a modular ES-module app. Three core improvements:

1. **Verified auto-ID** — triangle matching with geometric consistency checks and plate-solve verification to eliminate false positives.
2. **Three-source altitude pipeline** — photo-derived (horizon + plate solve), device sensors (DeviceOrientation API), and manual entry, with manual override always taking priority.
3. **Clean module decomposition** — centralized state, event-driven rendering, pure-function math modules.

---

## 2. File Structure

```
celestial/
  index.html                — HTML shell + CSS (no inline JS)
  js/
    catalog.js              — star catalog, constellation lines, catalog queries
    math.js                 — constants, angular math, GMST, gnomonic projection
    plate-solve.js          — iterative plate solve, projectToPixel, residual computation
    detection.js            — bright-spot detection with centroiding
    auto-id.js              — triangle hash, vote matching, geometric verification
    altitude.js             — horizon geometry, device orientation capture, alt/az conversions, intercept fix
    overlay.js              — SVG overlay: RA/Dec grid, catalog stars, constellation lines, alt/az grid
    state.js                — centralized state store with event dispatch
    ui.js                   — all DOM manipulation: rendering, picker, sighting list, mode bar, detection settings
    app.js                  — entry point: imports all modules, wires event listeners, initializes
```

No build step. Served via `<script type="module" src="js/app.js"></script>`. Works from any static HTTP server.

---

## 3. Module Specifications

### 3.1 `catalog.js`

**Exports:**
- `CAT` — `{name: [ra_h, dec_d, mag]}` object, 58 navigational stars (J2000.0)
- `CAT_ENTRIES` — `Object.entries(CAT)` sorted by name
- `CAT_BY_MAG` — sorted by magnitude (brightest first)
- `CONST_LINES` — `[[star1, star2], ...]` pairs for constellation stick figures

**Changes from current:**
- Remove broken `['Mirfak','Algol']` line (Algol not in catalog).
- Add more constellation lines where the catalog supports them.

### 3.2 `math.js`

**Exports:**
- `D2R`, `R2D` — conversion constants
- `nrm(degrees)` — normalize to [0, 360)
- `clamp(v, lo, hi)`
- `gmst(date)` — Greenwich Mean Sidereal Time in degrees
- `zenithFix(ra_h, dec_d, date)` — returns `{lat, lon}` assuming RA/Dec is observer's zenith
- `solve3x3(M, b)` — 3x3 linear system solver (used by plate solve)
- `angSep(ra1_h, dec1_d, ra2_h, dec2_d)` — angular separation in degrees using the spherical law of cosines: `acos(sin(d1)*sin(d2) + cos(d1)*cos(d2)*cos(ra1-ra2))`. Pure spherical geometry, not catalog-specific.

### 3.3 `plate-solve.js`

**Exports:**
- `plateSolve(stars)` — iterative tangent-plane fit. Input: `[{ra_h, dec_d, px, py}]`. Returns `{ra_h, dec_d, cx, cy, ra0_deg, dec0_deg, rmsResidual}` or `null`.
  - **New**: computes and returns `rmsResidual` (RMS of pixel residuals in fractional coords). Used by auto-ID verification and UI confidence display.
- `projectToPixel(ra_h, dec_d, solve)` — gnomonic forward projection. Returns `{px, py}` (fractional 0-1) or `null`.
- `pixelToSky(px, py, solve)` — gnomonic inverse projection. Returns `{ra_h, dec_d}` or `null`. **New** — needed for photo-derived altitude (given a pixel on the horizon, what RA/Dec does it correspond to?).

**Changes from current:**
- `plateSolve` computes `rmsResidual` before returning (see formula below).
- Add `pixelToSky` (inverse of `projectToPixel`).

**`pixelToSky` inversion formula:**

`projectToPixel` maps tangent-plane coords `(xi, eta)` to fractional pixel coords `(px, py)` via the affine transform from the plate solve:
```
px_centered = cx[0]*xi + cx[1]*eta + cx[2]
py_centered = cy[0]*xi + cy[1]*eta + cy[2]
px = px_centered + 0.5
py = -py_centered + 0.5    ← note: py is NEGATED (image y-axis points down, eta points up)
```

To invert, solve for `(xi, eta)` from `(px, py)`:
```
px_c = px - 0.5
py_c = -(py - 0.5)         ← undo the negation
// Now: px_c = cx[0]*xi + cx[1]*eta + cx[2]
//      py_c = cy[0]*xi + cy[1]*eta + cy[2]
// Subtract the offsets:
u = px_c - cx[2]
v = py_c - cy[2]
// Solve 2x2 system: [cx[0] cx[1]; cy[0] cy[1]] * [xi; eta] = [u; v]
det = cx[0]*cy[1] - cx[1]*cy[0]
xi  = (u*cy[1] - v*cx[1]) / det
eta = (v*cx[0] - u*cy[0]) / det
```

Then deproject from tangent plane to celestial coords:
```
ra0  = solve.ra0_deg * D2R
dec0 = solve.dec0_deg * D2R
rho  = sqrt(xi*xi + eta*eta)
c    = atan(rho)
dec  = asin(cos(c)*sin(dec0) + eta*sin(c)*cos(dec0)/rho)
ra   = ra0 + atan2(xi*sin(c), rho*cos(dec0)*cos(c) - eta*sin(dec0)*sin(c))
```
Return `{ra_h: ra*R2D/15, dec_d: dec*R2D}`, or `null` if `det ≈ 0` (degenerate solve) or `rho = 0` (return field center directly).

**`rmsResidual` computation:**

After the final plate-solve iteration converges, compute the RMS of residuals across all input stars:
```
for each star i:
  project (ra_h_i, dec_d_i) → (px_pred, py_pred) using projectToPixel with the final coefficients
  dx = px_pred - px_observed_i    (fractional image coords, range [0,1])
  dy = py_pred - py_observed_i
  sumSq += dx*dx + dy*dy
rmsResidual = sqrt(sumSq / N)
```
Units are fractional image coordinates. A value of 0.03 means the average star position error is 3% of the image dimension — about 30 pixels on a 1000px image. This threshold (used by auto-ID step 4) was chosen because: (a) phone camera star photos typically have 2-5px centroid uncertainty on a ~1000px image (0.002-0.005), (b) 0.03 allows for moderate lens distortion and centroiding noise while still catching gross misidentifications, (c) a single swapped star in a 4-star solve typically produces rmsResidual > 0.05.

### 3.4 `detection.js`

**Exports:**
- `detectBrightSpots(imgEl, opts)` — returns `[{px, py, v, radius}]`. `opts = {pct, maxStars, clusterPx}`.
  - **Change**: also return `radius` — estimated FWHM of each spot in pixels (from the centroid computation). Useful for filtering (real stars have consistent radii; noise/hot pixels are typically 1px).
- `DEFAULT_DETECTION_OPTS` — `{pct: 96, maxStars: 30, clusterPx: 18}`

**Changes from current:**
- Add FWHM radius output.
- Consider adding a minimum-radius filter (reject spots with radius < 1.5 canvas pixels — likely hot pixels).

### 3.5 `auto-id.js`

**Exports:**
- `buildCatalogHash()` — precompute triangle hash from catalog. Returns hash array. Cached.
- `runAutoID(candidates, existingSightings, opts)` — pure function. Returns `{matches: [{candId, star, score, verified}], rejected: [...], plateResult, message}`.

**Verification pipeline (the core improvement):**

```
Step 1: Triangle hash matching
  - Hash tolerance: 0.03 (was 0.045)
  - Use top 12 candidates by brightness
  - Collect votes per candidate → star name

Step 2: Winner selection
  - Vote threshold: 6 (was 4)
  - Greedy non-conflicting assignment (existing logic)
  - Output: proposed matches [{candId, star}]

Step 3: Pairwise consistency check  [NEW]
  - For every pair (i, j) in proposed matches:
    - Compute pixel separation: pxDist = hypot(dx, dy)
    - Compute catalog angular separation: angDist = angSep(...)
    - Derive implied pixel scale: scale_ij = angDist / pxDist
  - Compute median pixel scale across all pairs
  - Reject any match where its pairwise scales deviate >20% from median
  - If fewer than 2 matches survive, reject all

Step 4: Plate-solve verification  [NEW]
  - Run plateSolve on surviving matches
  - If solve fails or rmsResidual > 0.03 (3% of image), reject all
  - Project all 58 catalog stars using the solve
  - For each detected candidate within clusterPx of a projected catalog star:
    mark as "confirmed" (even if not in the original vote winners)
  - For each proposed match: if its candidate is >2x clusterPx from
    the projected position of its assigned star, reject that match

Step 5: Output
  - Return verified matches, rejected matches, the plate solve result, and a message
  - The caller (app.js) decides whether to apply them to state
```

**Why this works:** Steps 3-4 ensure that accepted matches are geometrically self-consistent AND agree with the full catalog. A false positive (e.g., a noise spot labeled "Sirius") would need to be in exactly the right position relative to all other matches — extremely unlikely.

### 3.6 `altitude.js`

**Exports:**
- `equatorialToAltAz(ra_h, dec_d, lat_d, lon_d, date)` — returns `{alt_d, az_d}`
- `altazToEquatorial(alt_d, az_d, lat_d, lon_d, date)` — returns `{ra_h, dec_d}`
- `altitudeFix(altStars, utcDate, ap)` — Marcq St-Hilaire intercept fix. Input: `[{ra_h, dec_d, alt_obs, name}]`, assumed position `{lat, lon}`. Returns `{lat, lon, residuals}`.
- `computePhotoAltitude(starRa_h, starDec_d, horizonLine, solve)` — **NEW**. Given a star's celestial coordinates and a horizon line, compute altitude using the plate solve's projection to define the horizon great circle. Returns degrees or `null`.
- `DeviceAltitudeCapture` — **NEW** class.
  - `.start()` — begin listening to `deviceorientation` events
  - `.stop()` — stop listening
  - `.capture()` — snapshot current pitch angle
  - `.isAvailable()` — check if API exists and permission granted
  - `.onUpdate(callback)` — called with current pitch on each sensor event

**`computePhotoAltitude` algorithm (replaces `altitudeForCandidate`):**

The current code uses a single `pixelScale` value, which is inaccurate for wide-field or distorted images. The new approach uses the plate solve to define a horizon great circle and measures angular distance from the star to that great circle:

1. Take the star's pixel position `(sx, sy)`.
2. Sample two well-separated points on the horizon line in pixel coords (e.g. the endpoints, or at x=0.2 and x=0.8).
3. Project both horizon points to sky coordinates using `pixelToSky` → `(ra_h1, dec_d1)`, `(ra_h2, dec_d2)`.
4. Convert both to unit vectors on the celestial sphere: `v = (cos(dec)*cos(ra), cos(dec)*sin(ra), sin(dec))`.
5. Compute the horizon great-circle normal: `n = normalize(v1 × v2)`.
6. Convert the star's sky coordinates (from its sighting) to a unit vector `vs`.
7. The altitude is the angular distance from the star to the horizon great circle: `alt = asin(dot(vs, n))`.
   - Sign convention: positive means above the horizon (star is on the same side as zenith). If the image is oriented so that "above the horizon line" in pixels maps to the negative-n side, negate n.
8. To determine the correct sign, check which side of the horizon line the image center falls on (above = positive altitude side), and ensure `n` points toward that half-space.

This approach is exact for any gnomonic projection and handles tilted/rotated horizon lines, off-center fields, and non-uniform pixel scales correctly. The naive "closest point" approach fails because angular separation to the nearest horizon point is NOT the same as angular distance to the horizon great circle when the star is far from the perpendicular foot.

**Altitude priority resolution:**

Each sighting has three potential altitude values:
```
sighting.alt_manual   — typed by user (Ho field)
sighting.alt_device   — captured from phone sensors at time of identification
sighting.alt_photo    — computed from horizon + plate solve
```

The resolved altitude used for navigation:
```js
function resolvedAltitude(sighting) {
  if (sighting.alt_manual != null) return { value: sighting.alt_manual, source: 'manual' };
  if (sighting.alt_device != null) return { value: sighting.alt_device, source: 'device' };
  if (sighting.alt_photo  != null) return { value: sighting.alt_photo,  source: 'photo' };
  return null;
}
```

### 3.7 `overlay.js`

**Exports:**
- `drawOverlay(svg, state)` — clears SVG, redraws everything based on state.

**Changes from current:**
- Receives state object instead of reaching into globals.
- Pure function of state — no side effects beyond writing to the SVG element.
- Horizon line drawing moves here (currently in `drawOverlay`, stays here).
- `drawCelestialGrid` becomes internal to this module.

### 3.8 `state.js`

**Exports:**
- `createStore(initialState)` — returns a store object with:
  - `.get()` — returns current state (frozen shallow copy)
  - `.update(patch)` — merges patch into state, emits `'change'` event
  - `.on(event, callback)` — subscribe
  - `.off(event, callback)` — unsubscribe

**State shape:**
```js
{
  // Image
  imageLoaded: false,
  imageUrl: null,
  imageDimensions: null,  // {naturalW, naturalH, displayW, displayH}

  // Detection
  detectionOpts: {pct: 96, maxStars: 30, clusterPx: 18},
  candidates: [],          // [{id, px, py, v, radius}]

  // Identification
  sightings: [],           // [{id, name, ra_h, dec_d, px, py, candId, autoID,
                           //   alt_manual, alt_device, alt_photo}]
  pickerCandId: null,

  // Horizon
  horizonPts: [],
  horizonLine: null,       // {x1, y1, x2, y2, angle}

  // Orientation
  orientation: {az: null, tilt: null, roll: null},

  // Solve results
  solveResult: null,       // from plateSolve
  fix: null,               // {lat, lon, method, altResult}
  utcDate: null,

  // Overlay
  overlayFlags: {radec: true, stars: true, const: false, altaz: false},

  // UI
  mode: 'identify',        // 'identify' | 'horizon'
}
```

### 3.9 `ui.js`

**Exports:**
- `initUI(store)` — bind all DOM event listeners, set up rendering subscriptions.
- Internally: `renderSightings`, `renderCandidates`, `renderPicker`, `renderFixCard`, `renderDetectionSettings`, `renderModeBar`, etc.

**Changes from current:**
- All DOM reads/writes are in this module.
- Subscribes to `store.on('change', ...)` to re-render affected sections.
- Event handlers call `store.update(...)` or invoke domain functions (plate solve, auto-ID) and then update state with results.
- The `renderSightings` function shows the altitude source badge: `[M]` manual, `[D]` device, `[P]` photo, with the resolved value.
- Edit panel for each sighting shows all three altitude values (where available) and allows manual override.

### 3.10 `app.js`

**Exports:** none (entry point).

**Responsibilities:**
- Import all modules.
- Create the state store.
- Call `initUI(store)`.
- Set up the computation pipeline:
  - On state change where sightings/horizon/time changed: recompute plate solve, photo altitudes, fix.
  - On state change where solveResult changed: recompute overlay.
- Initialize device orientation capture if available.

---

## 4. Computation Flow

```
User loads image
  → detection.detectBrightSpots → state.update({candidates})
  → ui renders candidate markers

User identifies star (click marker → pick from catalog)
  → state.update({sightings: [..., newSighting]})
  → app recomputes:
      if ≥2 sightings with px: plateSolve → state.update({solveResult})
      if horizonLine + solveResult: computePhotoAltitude for each sighting
      if utcDate: computeFix → state.update({fix})
  → ui re-renders sighting list, fix card
  → overlay redraws with updated solveResult

User runs Auto-ID
  → auto-id.runAutoID(candidates, sightings) → verified matches
  → for each match: state.update to add sighting
  → same recomputation cascade as above

User sets horizon
  → state.update({horizonLine})
  → if solveResult exists: recompute photo altitudes for all sightings
  → overlay redraws horizon line

User enters manual altitude
  → state.update sighting's alt_manual
  → recompute fix with new altitude data
```

---

## 5. Migration Strategy

1. **Extract math and catalog first** — zero UI impact, easiest to verify.
2. **Extract plate-solve and detection** — pure functions, testable in isolation.
3. **Build state.js** — simple pub/sub store.
4. **Extract auto-id with new verification pipeline** — the biggest logic change.
5. **Build altitude.js** — new module, includes device orientation.
6. **Extract overlay.js** — moves drawing code, makes it a function of state.
7. **Build ui.js and app.js** — rewire everything, delete old inline script.
8. **Delete `celestial-nav-v3.html`**, replace with `index.html` + `js/` modules.

Each step should produce a working app. No big-bang rewrite.

**Field rename: `alt_obs` → `alt_manual`**

The current `celestial-nav-v3.html` uses `sighting.alt_obs` for the user-entered observed altitude (Ho). In the new module structure, this field is renamed to `alt_manual` to distinguish it from the two new automated altitude sources (`alt_device`, `alt_photo`). Migration steps:

- In step 5 (altitude.js): `altitudeFix` accepts `alt_obs` in its input array (matching the Marcq St-Hilaire convention), but the sighting state uses `alt_manual`. The caller (app.js) maps: `altStars.push({...star, alt_obs: resolvedAltitude(sighting).value})`.
- In step 7 (ui.js): The Ho input field reads/writes `sighting.alt_manual` (was `sighting.alt_obs`). No user-visible change — the label stays "Ho".
- In step 8: The old code is deleted entirely, so no backwards-compatibility shim is needed. There is no persistent storage to migrate (sightings only exist in memory during a session).

---

## 6. Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build tooling | None (native ES modules) | Single-user tool, simplicity over optimization |
| State management | Custom pub/sub store | Tiny, no dependencies, sufficient for this scale |
| Device orientation | Progressive enhancement | Works without sensors; sensors improve accuracy when available |
| Auto-ID verification | Plate-solve + pairwise consistency | Eliminates false positives without requiring user intervention |
| Altitude priority | manual > device > photo | User always has final authority; automated sources pre-fill |
| Pixel scale computation | Per-star via plate solve projection | Replaces inaccurate single-value `pixelScale` global |
| CSS | Stays in `index.html` `<style>` block | Single file of styles is fine at this scale |

---

## 7. Out of Scope

- Offline/PWA caching (future consideration)
- Star catalog expansion beyond 58 navigational stars
- Atmospheric refraction corrections
- Multi-image stacking
- GPS comparison/validation
