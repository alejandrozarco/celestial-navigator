# Photo Nav Improvements — Design Spec
**Date:** 2026-03-20
**Scope:** Photo mode — bug fixes, auto-ID improvement, catalog expansion, overlay enhancements

---

## 1. Pipeline trigger fixes (bugs A & E)

### Problem
In `js/ui.js:renderSightingsList`, the `change` handlers on `.sho-deg` and `.sho-min` inputs mutate the sighting object directly but never call `_onPhotoPipeline`. As a result, the plate solve, position fix, and sky overlay do not update when the user edits an observed altitude (Ho) value.

### Fix
After updating the sighting's Ho fields, call `_onPhotoPipeline(_photoState)`. This single change fixes both the "update on Ho edit" bug and the "recompute on any star edit" requirement — they are the same missing call.

**File:** `js/ui.js` — `renderSightingsList` change handler for `.sho-deg` / `.sho-min`

---

## 2. Auto-ID improvement (bug B)

### Problem
`runAutoID` produces wrong star matches. Root causes:
1. `buildCatalogHash` builds triangles from all ~90 catalog entries (alphabetically sorted), producing ~117,000 triangles. With tolerance TOL=0.045, many false positive votes accumulate.
2. After voting, there is no geometric consistency check — a handful of false positive triangles can override correct matches.

### Fix — Part 1: Brightness-only hash subset
Change `buildCatalogHash` to accept an optional `nStars` parameter (default 40). Build triangles only from the top N stars in `CAT_BY_MAG`. This reduces the triangle count from ~117,000 to ~9,880 (12× fewer), dramatically reducing false positive votes.

Tighten default `TOL` from 0.045 → 0.025.

**File:** `js/auto-id.js` — `buildCatalogHash(nStars = 40)`

### Fix — Part 2: Geometric verification
After voting produces assignments, verify them geometrically:
1. Take the two highest-scoring assignments.
2. Using the known catalog angular separation between those two stars and the pixel distance between their detections, estimate the plate scale (deg/px) and rough rotation.
3. For every other assignment, project the catalog star's expected pixel position using this transform and check that it falls within ~3px of the detected candidate.
4. Reject assignments that fail this check.

Add `verifyAssignments(assignments, detections, catalogHash)` to `js/auto-id.js`, called after deduplication in `runAutoID`.

**File:** `js/auto-id.js` — new `verifyAssignments` function, called at end of `runAutoID`

---

## 3. Catalog expansion (item F)

### Target
Expand from ~90 to ~130+ stars covering:
- All stars with apparent magnitude < 2.5 not yet in catalog
- All stars needed to complete stick figures for major constellations

### New bright stars to add
| Name | RA (h) | Dec (°) | Mag | Notes |
|------|--------|---------|-----|-------|
| Regor (γ Vel) | 8.159 | -47.336 | 1.72 | brightest unlisted |
| Al Na'ir (α Gru) | 22.137 | -46.961 | 1.73 | Grus |
| Aspidiske (ι Car) | 9.285 | -59.275 | 2.21 | Carina |
| Delta Vel | 8.745 | -54.709 | 1.96 | Vela |
| Naos (ζ Pup) | 8.059 | -40.003 | 2.25 | Puppis |
| Epsilon Cen | 13.665 | -53.466 | 2.30 | Centaurus |
| Eta Cen | 14.592 | -42.158 | 2.31 | Centaurus |
| Alpha Lupi | 14.699 | -47.388 | 2.30 | Lupus |
| Epsilon Sco (Wei) | 16.836 | -34.293 | 2.29 | Scorpius |
| Kappa Sco (Girtab) | 17.708 | -39.030 | 2.41 | Scorpius tail |
| Zeta Cen | 13.926 | -47.288 | 2.55 | Centaurus |
| Kraz (β Crv) | 12.573 | -23.397 | 2.65 | Corvus |
| Zubeneschamali (β Lib) | 15.284 | -9.383 | 2.61 | Libra |
| Algorab (δ Crv) | 12.498 | -16.515 | 2.95 | Corvus |

### Constellation completions
Stars to add and lines to draw for each constellation:

**Hercules (Keystone)**
- Add: Kornephoros (β Her, 16.503h, +21.49°, 2.77), Zeta Her (16.688h, +31.60°, 2.81), Pi Her (17.251h, +36.81°, 3.16), Eta Her (16.714h, +38.92°, 3.48)
- Lines: Kornephoros–Zeta Her, Zeta Her–Eta Her, Pi Her–Eta Her, Pi Her–Rasalhague

**Aquarius**
- Add: Sadalsuud (β Aqr, 21.526h, -5.57°, 2.91), Sadalmelik (α Aqr, 22.096h, -0.32°, 2.95)
- Lines: Sadalsuud–Sadalmelik, Sadalmelik–Enif (bridge to Pegasus area)

**Corvus**
- Add: Kraz (β Crv), Algorab (δ Crv) — Gienah (γ Crv) already present
- Lines: Gienah–Kraz, Kraz–Algorab, Algorab–Gienah (quadrilateral)

**Libra**
- Add: Zubeneschamali (β Lib)
- Lines: Zubenelgenubi–Zubeneschamali

**Ophiuchus (completing)**
- Add: Yed Prior (δ Oph, 16.241h, -3.69°, 2.74), Cebalrai (β Oph, 17.722h, +4.57°, 2.77)
- Lines: Rasalhague–Cebalrai, Cebalrai–Sabik, Yed Prior–Sabik

**Leo (sickle)**
- Add: Adhafera (ζ Leo, 10.167h, +23.42°, 3.44), Eta Leo (10.122h, +16.76°, 3.49)
- Lines: Regulus–Eta Leo, Eta Leo–Algieba, Algieba–Adhafera (sickle curve)

**Taurus (completing V)**
- Add: Zeta Tau (Tianguan, 5.627h, +21.14°, 3.0)
- Lines: Aldebaran–Zeta Tau, Aldebaran–Elnath (closes the V-shape)

**Draco (fuller body)**
- Add: Thuban (α Dra, 14.073h, +64.38°, 3.65), Edasich (ι Dra, 15.415h, +58.97°, 3.29)
- Lines: Eltanin–Edasich, Edasich–Thuban, Aldibain–Edasich

**Cygnus (complete cross)**
- Add: Delta Cyg (19.750h, +45.13°, 2.87)
- Lines: Sadr–Delta Cyg (west arm of cross)

**Centaurus (body/legs)**
- Add: Epsilon Cen, Eta Cen, Zeta Cen
- Lines: Hadar–Epsilon Cen, Rigil Kentaurus–Zeta Cen, Epsilon Cen–Eta Cen

**Hydra (extending)**
- Add: Gamma Hya (13.315h, -23.17°, 2.99)
- Lines: Alphard–Gamma Hya

**Scorpius (completing tail)**
- Add: Epsilon Sco, Kappa Sco (Girtab)
- Lines: Shaula–Kappa Sco, Sargas–Epsilon Sco, Epsilon Sco–Antares (completing the body arc)

**Auto-ID hash** remains built from top 40 by brightness — additional stars do not pollute triangle matching but do improve overlay rendering.

---

## 4. North meridian overlay (item C)

### Trigger
When the sightings list contains a star named `'Polaris'` with `Ho_deg + Ho_min/60 > 0` AND a plate solution exists.

### Rendering
1. Project the true NCP (dec = 90°, RA = plate solution center RA) to pixel space using the plate solution.
2. Project the image centre (px = 0.5, py = 0.5) as the zenith proxy.
3. Draw a line extending from below the zenith through the NCP and continuing to the image edge — a full great-circle meridian arc.
4. Draw a small circle and label "N (true)" at the NCP pixel position.
5. Color: `rgba(200, 220, 255, 0.85)` (pale blue-white) to distinguish from the alt/az grid (red) and RA/Dec grid (green).

**Key detail:** The NCP is ~0.74° offset from Polaris (Polaris dec = 89.26°). The meridian line passes through the true pole, not through the Polaris dot. This is intentional — the visible offset calibrates the user's understanding of Polaris's true polar distance.

**File:** `js/overlay.js` — new `drawMeridian(svgEl, solve, sightings)` called from `drawCelestialGrid` (or from `drawOverlay` before the grid call).

---

## 5. Auto-enable RA/Dec grid (item D)

### Trigger
In `app.js:photoPipeline`, after assembling the overlay state, check whether any sighting has `s.Ho_deg + s.Ho_min / 60 > 0`. If so, set `overlayFlags.radec = true` in the overlay call (without mutating `_photoState.overlayFlags`, so the user's explicit toggle still works).

### Effect
As soon as the user enters any observed altitude, the celestial RA/Dec grid auto-appears, calibrated to the plate solution, giving an immediate visual sense of how well the position estimate aligns with the sky.

**File:** `js/app.js` — `photoPipeline` function, before the `drawOverlay` call.

---

## File change summary

| File | Changes |
|------|---------|
| `js/ui.js` | Add `_onPhotoPipeline(_photoState)` call in Ho change handler |
| `js/auto-id.js` | `buildCatalogHash(nStars=40)`, tighten TOL to 0.025, add `verifyAssignments` |
| `js/catalog.js` | Add ~40 new stars, extend `CONST_LINES` for 12 constellations |
| `js/overlay.js` | Add `drawMeridian` function, call from `drawOverlay` |
| `js/app.js` | Auto-enable `radec` flag when sightings have Ho values |
