# Photo Nav Improvements — Design Spec
**Date:** 2026-03-20
**Scope:** Photo mode — bug fixes, auto-ID improvement, catalog expansion, overlay enhancements

---

## 1. Pipeline trigger fix

### Problem
In `js/ui.js:renderSightingsList`, the `change` handlers on `.sho-deg` and `.sho-min` inputs update `_photoState.sightings[x].Ho_deg` / `.Ho_min` but never call `_onPhotoPipeline`. The plate solve, position fix, and sky overlay therefore never update when the user edits an observed altitude (Ho) value.

### Fix
In the same `change` handler, after updating the Ho field, add:
```js
if (_onPhotoPipeline) _onPhotoPipeline(_photoState);
```

This single change makes the overlay and position estimate recompute on every Ho edit.

**File:** `js/ui.js` — `.sho-deg` / `.sho-min` change handler inside `renderSightingsList`

---

## 2. Auto-ID improvement

### Problem
`runAutoID` produces wrong star matches. Root causes:
1. `buildCatalogHash` builds triangles from all ~90 catalog entries (alphabetical), producing ~117,000 triangles. With TOL=0.045, many false positive votes accumulate.
2. No geometric consistency check after voting — a handful of false-positive triangles can override correct matches.

### Fix — Part 1: Brightness-only hash subset
Change `buildCatalogHash` signature to `buildCatalogHash(nStars = 40)`. Internally, take the first `nStars` entries from `CAT_BY_MAG` (which is sorted ascending by magnitude value, so index 0 = brightest). Build triangles only from those stars. The caller in `ui.js:getCatalogHash()` already calls `buildCatalogHash()` with no arguments, so the default of 40 keeps that call valid.

Tighten the module-level constant `TOL` from `0.045` to `0.025`.

**File:** `js/auto-id.js` — `buildCatalogHash(nStars = 40)`, `TOL = 0.025`

**Import change required:** `auto-id.js` currently imports `CAT` and `CAT_ENTRIES` from `catalog.js`. Add `CAT_BY_MAG` to that import: `import { CAT, CAT_ENTRIES, CAT_BY_MAG } from './catalog.js';`

### Fix — Part 2: Geometric verification
After the existing deduplication loop in `runAutoID`, call `verifyAssignments(result, topN)` to filter out geometrically inconsistent assignments.

**`verifyAssignments(assignments, detections)`** — add this function to `auto-id.js`:
- **Input:** `assignments` — the deduplicated result array `[{candId, star, score}]`; `detections` — the `topN` array used in the vote phase `[{id, px, py, v}]`
- **Returns:** filtered `assignments` array (same shape, only consistent entries)
- **Algorithm:**
  1. If fewer than 2 assignments, return as-is (cannot verify).
  2. Take the two highest-scoring assignments (index 0 and 1 after sort-by-score).
  3. Look up their pixel positions in `detections` (match by `candId === id`) and their catalog positions in `CAT` (RA hours → degrees: `ra_deg = ra_h * 15`).
  4. Compute pixel distance `dpx = hypot(dx_px * ar, dy_py)` and sky angular separation `dsky = angSep(ra_a_deg, dec_a, ra_b_deg, dec_b)` (in degrees).
  5. If `dsky < 0.01` or `dpx < 0.001` (degenerate), return all assignments unchanged.
  6. Derive scale: `scale = dsky / dpx` (degrees per pixel-unit).
  7. For each remaining assignment (index ≥ 2): compute expected pixel offset from reference candidate 0 using the same scale and the catalog angular offsets; check that the actual pixel position is within `0.015` normalized units of expected (≈12px for an 800px-wide image). Reject if outside this fixed threshold.
  8. Always keep assignments 0 and 1 (the reference pair).
- **Note:** `ar` (aspect ratio) is not available inside `verifyAssignments`; pass it as a third parameter `verifyAssignments(assignments, detections, ar = 1)` and use it when computing pixel distances (same as the vote phase: `Math.hypot(dx * ar, dy)`).

Update the `runAutoID` signature to pass `ar` through: `verifyAssignments(result, topN, ar)`.

**File:** `js/auto-id.js` — new `verifyAssignments(assignments, detections, ar)` function; called at end of `runAutoID` before `return result`

---

## 3. Catalog expansion

### Target
Expand from ~90 to ~130+ stars covering: all stars with apparent magnitude ≤ 2.5 not yet present, plus all stars needed to complete stick figures for major constellations.

### New bright stars to add to `CAT`
| Name | RA (h) | Dec (°) | Mag | Constellation |
|------|--------|---------|-----|---------------|
| Regor (γ Vel) | 8.159 | -47.336 | 1.72 | Vela |
| Al Na'ir (α Gru) | 22.137 | -46.961 | 1.73 | Grus |
| Delta Vel | 8.745 | -54.709 | 1.96 | Vela |
| Aspidiske (ι Car) | 9.285 | -59.275 | 2.21 | Carina |
| Naos (ζ Pup) | 8.059 | -40.003 | 2.25 | Puppis |
| Epsilon Cen | 13.665 | -53.466 | 2.30 | Centaurus |
| Eta Cen | 14.592 | -42.158 | 2.31 | Centaurus |
| Alpha Lupi | 14.699 | -47.388 | 2.30 | Lupus |
| Epsilon Sco | 16.836 | -34.293 | 2.29 | Scorpius |
| Kappa Sco (Girtab) | 17.708 | -39.030 | 2.41 | Scorpius |
| Zeta Cen | 13.926 | -47.288 | 2.55 | Centaurus |
| Kraz (β Crv) | 12.573 | -23.397 | 2.65 | Corvus |
| Zubeneschamali (β Lib) | 15.284 | -9.383 | 2.61 | Libra |
| Algorab (δ Crv) | 12.498 | -16.515 | 2.95 | Corvus |
| Sadalsuud (β Aqr) | 21.526 | -5.571 | 2.91 | Aquarius |
| Sadalmelik (α Aqr) | 22.096 | -0.320 | 2.95 | Aquarius |

### New constellation stars (dimmer, needed for stick figures)
| Name | RA (h) | Dec (°) | Mag | Constellation |
|------|--------|---------|-----|---------------|
| Kornephoros (β Her) | 16.503 | 21.490 | 2.77 | Hercules |
| Zeta Her | 16.688 | 31.603 | 2.81 | Hercules |
| Pi Her | 17.251 | 36.809 | 3.16 | Hercules |
| Eta Her | 16.714 | 38.922 | 3.48 | Hercules |
| Adhafera (ζ Leo) | 10.167 | 23.417 | 3.44 | Leo |
| Eta Leo | 10.122 | 16.763 | 3.49 | Leo |
| Zeta Tau (Tianguan) | 5.627 | 21.143 | 3.00 | Taurus |
| Delta Cyg | 19.750 | 45.131 | 2.87 | Cygnus |
| Thuban (α Dra) | 14.073 | 64.376 | 3.65 | Draco |
| Edasich (ι Dra) | 15.415 | 58.966 | 3.29 | Draco |
| Gamma Hya | 13.315 | -23.171 | 2.99 | Hydra |
| Yed Prior (δ Oph) | 16.241 | -3.694 | 2.74 | Ophiuchus |
| Cebalrai (β Oph) | 17.722 | 4.567 | 2.77 | Ophiuchus |

### New `CONST_LINES` entries
```
// Hercules (Keystone)
['Kornephoros', 'Zeta Her'],
['Zeta Her', 'Eta Her'],
['Eta Her', 'Pi Her'],
['Pi Her', 'Rasalhague'],

// Aquarius
['Sadalsuud', 'Sadalmelik'],
['Sadalmelik', 'Enif'],

// Corvus
['Gienah', 'Kraz'],
['Kraz', 'Algorab'],
['Algorab', 'Gienah'],

// Libra
['Zubenelgenubi', 'Zubeneschamali'],

// Ophiuchus (completing)
['Rasalhague', 'Cebalrai'],
['Cebalrai', 'Sabik'],
['Yed Prior', 'Sabik'],

// Leo (Sickle)
['Regulus', 'Eta Leo'],
['Eta Leo', 'Algieba'],
['Algieba', 'Adhafera'],

// Taurus (V-shape)
['Aldebaran', 'Zeta Tau'],

// Draco (fuller body)
['Eltanin', 'Edasich'],
['Edasich', 'Thuban'],
['Aldibain', 'Edasich'],

// Cygnus (complete cross — west arm)
['Sadr', 'Delta Cyg'],

// Centaurus (body/legs)
['Hadar', 'Epsilon Cen'],
['Epsilon Cen', 'Eta Cen'],
['Rigil Kentaurus', 'Zeta Cen'],

// Hydra (extending)
['Alphard', 'Gamma Hya'],

// Scorpius (completing tail arc)
['Shaula', 'Kappa Sco'],
['Sargas', 'Epsilon Sco'],
```

**Auto-ID hash** continues to use only top 40 by brightness — the additional catalog stars improve overlay rendering without polluting triangle matching.

---

## 4. North meridian overlay

### Trigger conditions (all must be true)
- A plate solution exists (`plateSolution && plateSolution.cx && plateSolution.cy`)
- `sightings` contains an entry with `name === 'Polaris'`
- That Polaris sighting has `Ho_deg > 0 || Ho_min > 0`
- `horizonY` is null (no horizon mode active) — when a horizon is in use the image centre is no longer the zenith, making the meridian line misleading; suppress it in that case

### Placement
`drawMeridian(svgEl, solve, sightings)` is a new private function in `js/overlay.js`. It is called directly from `drawOverlay`, inside the existing `if (plateSolution && plateSolution.cx && plateSolution.cy)` block, after the `drawCelestialGrid` call. It receives `plateSolution` as `solve` and `sightings` from `state`.

The trigger check is done inside `drawMeridian` itself so it can return early cleanly.

### Rendering algorithm
1. Call `project(solve.cx_ra || solve.cx[0] /* center RA */, 90, solve)` to get the NCP pixel position. If `projectToPixel` returns null (NCP outside image FOV), skip drawing — return early.
2. The zenith pixel is `(0.5, 0.5)` (image center — the plate solve centers the solution there).
3. Extend the line: compute direction vector from zenith `(0.5, 0.5)` through NCP `(ncpX, ncpY)`. Extend both ends until they leave the `[0, 1]` unit square (same clipping logic used by `buildPath`).
4. Draw the line: `stroke = 'rgba(200,220,255,0.85)'`, `stroke-width = '1.5'`, `stroke-dasharray = '12 4'`.
5. Draw a small circle (r=4) at the NCP pixel, same color, filled.
6. Draw label "N" offset by `(+0.015, -0.015)` from the NCP pixel.

**Note on NCP RA:** The NCP is at dec=90° for any RA — the RA value passed to `project()` does not affect the result. Use `project(solve.ra_h, 90, solve)` for clarity (the solve object returned by `plateSolve` always has `ra_h` as the image center RA).

**Updated signature:** `drawMeridian(svgEl, solve, sightings, horizonY)` — accepts `horizonY` so it can suppress itself when a horizon is active.

**Call site:** Called from `drawOverlay` inside the existing `if (plateSolution && plateSolution.cx && plateSolution.cy)` block, after `drawCelestialGrid`:
```js
drawMeridian(svgElement, plateSolution, sightings, horizonY);
```
All four values are already destructured from `state` in `drawOverlay`.

**File:** `js/overlay.js` — new `drawMeridian(svgEl, solve, sightings, horizonY)`, called from `drawOverlay`

---

## 5. Auto-enable RA/Dec grid

### Trigger
In `app.js:photoPipeline`, before calling `drawOverlay`, check whether any sighting has Ho > 0:
```js
const hasHo = sightings.some(s => s.Ho_deg > 0 || s.Ho_min > 0);
```

### Implementation
Construct a modified copy of `overlayFlags` for the `drawOverlay` call only — do not mutate `_photoState.overlayFlags`:
```js
const effectiveFlags = hasHo ? { ...overlayFlags, radec: true } : overlayFlags;
```
Pass `effectiveFlags` to `drawOverlay` instead of `overlayFlags`. The user's manual toggle on the `radec` button still works for explicitly disabling it; the auto-enable only forces it on when there is altitude data.

**File:** `js/app.js` — `photoPipeline` function, before the `drawOverlay` call

---

## File change summary

| File | Changes |
|------|---------|
| `js/ui.js` | Add `_onPhotoPipeline(_photoState)` call in `.sho-deg`/`.sho-min` change handler |
| `js/auto-id.js` | `buildCatalogHash(nStars=40)` using `CAT_BY_MAG`; TOL → 0.025; add `verifyAssignments(assignments, detections, ar)` |
| `js/catalog.js` | Add ~29 new stars; extend `CONST_LINES` with ~20 new line segments |
| `js/overlay.js` | Add `drawMeridian(svgEl, solve, sightings)`; call from `drawOverlay` |
| `js/app.js` | Build `effectiveFlags` with `radec: true` when `hasHo`; pass to `drawOverlay` |
