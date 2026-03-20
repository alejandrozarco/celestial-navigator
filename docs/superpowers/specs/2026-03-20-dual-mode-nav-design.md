# Dual-Mode Celestial Navigation App — Design Spec

## Overview

Two-mode celestial navigation web app: **Photo Nav** (image-based star identification + plate solve) and **Sight Reduction** (manual sextant observations via Marcq St. Hilaire intercept method). Both modes share a d3 Mercator nav chart, 58-star catalog, and least-squares fix calculation.

Built as vanilla ES modules (no build step). iPad-friendly layout. Replaces Leaflet map with purpose-built d3 nav chart.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Nav chart | d3 Mercator, replacing Leaflet | Purpose-built for LOPs/CoEA/fix; no CDN dependency |
| Workflow modes | Both Photo Nav + Sight Reduction, tab switch | Different use cases (camera vs sextant); shared fix pipeline |
| Layout | Tab switch in top-left panel | Simple, iPad-friendly; nav chart always visible on right |
| Star selection | Visible-now filter (AP + UTC) | Eliminates confusion; sorted by altitude, brightest first |
| UTC | User-settable globally + per-sight override | Observations may be taken at different times |

## Architecture

### Module Structure

```
celestial/
├── index.html              # Shell + CSS + tab UI
├── js/
│   ├── math.js             # D2R, R2D, nrm, clamp, gmst, zenithFix, solve3x3, angSep
│   ├── catalog.js          # 58 nav stars + constellation stick figures
│   ├── plate-solve.js      # Plate solve, projectToPixel, pixelToSky, rmsResidual
│   ├── detection.js        # detectBrightSpots with FWHM radius output
│   ├── auto-id.js          # buildCatalogHash, runAutoID with 5-step verification
│   ├── sight-reduction.js  # NEW: GHA, LHA, Hc, Zn, intercept calculation
│   ├── fix.js              # NEW: Least-squares fix from N LOPs
│   ├── nav-chart.js        # NEW: d3 Mercator chart rendering
│   ├── altitude.js         # Alt/az conversions, photo altitude, device capture
│   ├── overlay.js          # SVG overlay on sky image (Photo Nav mode)
│   ├── state.js            # Centralized pub/sub store
│   ├── ui.js               # DOM events, rendering, tab switching
│   └── app.js              # Entry point, wiring
└── test.html               # Browser-based tests for pure functions
```

### New Modules (vs existing modular redesign plan)

- **`sight-reduction.js`** — Marcq St. Hilaire intercept method
- **`fix.js`** — Least-squares fix solver
- **`nav-chart.js`** — d3 Mercator nav chart

All other modules carry over from the existing redesign spec (`2026-03-19-celestial-nav-redesign.md`), with these changes:

### Changes to March 19 Spec Modules

- **`altitude.js`**: `altitudeFix()` is **removed** — superseded by `sightReduce()` + `leastSquaresFix()` in the new modules. Retains `equatorialToAltAz()`, `computePhotoAltitude()`, and `DeviceAltitudeCapture` (Photo mode only). Adds `visibleStars()` filter function.
- **`overlay.js`**: Active in **Photo mode only**. `nav-chart.js` handles all chart rendering in both modes.
- **`state.js`**: State shape updated to the dual-mode schema below (replaces March 19 `sightings[]` with `observations[]`, adds `lops[]`/`fix`, changes mode enum to `'photo' | 'sights'`). The March 19 three-source altitude pipeline (`alt_manual`, `alt_device`, `alt_photo`) is retained in Photo mode but not used in Sights mode (sextant users always provide manual Ho).

### Coordinate Conventions

All modules use these conventions consistently:
- **Latitude**: degrees, north positive, south negative (-90 to +90)
- **Longitude**: degrees, east positive, west negative (-180 to +180)
- **Azimuth (Zn)**: degrees, clockwise from north (0-360)
- **All trig functions** receive radians internally; public APIs accept/return degrees. Use `D2R`/`R2D` from `math.js` at module boundaries.

## Module APIs

### sight-reduction.js

Pure functions, no DOM dependency.

```js
// Greenwich Hour Angle from UTC + star RA
// GHA_Aries = GMST(utc) converted to degrees
// GHA_star = GHA_Aries - RA (SHA = 360 - RA; GHA increases westward, RA eastward)
// Result normalized to 0-360
export function gha(utc, ra_deg) → number  // degrees 0-360

// Local Hour Angle = GHA + AP longitude (east-positive convention)
// LHA = GHA + lon_east, normalized to 0-360
export function lha(gha_deg, ap_lon) → number  // degrees 0-360

// Computed altitude and true azimuth from AP + star declination + GHA
// Hc = asin(sin(AP_lat)·sin(dec) + cos(AP_lat)·cos(dec)·cos(LHA))
// Z  = atan2(-cos(dec)·sin(LHA), sin(dec)·cos(AP_lat) - cos(dec)·cos(LHA)·sin(AP_lat))
// Zn = Z adjusted to 0-360
export function calcHcZn(ap_lat, ap_lon, dec, gha_deg) → { Hc_deg: number, Zn_deg: number }

// Full sight reduction for one star observation
// star: { name: string, ra: number (degrees), dec: number (degrees) } from catalog
// Computes GHA → LHA → Hc/Zn → intercept
// intercept = Ho - Hc (in arcminutes = nautical miles)
// Positive intercept = observed altitude > computed = actual position is toward the star
// magBearing is stored alongside for display but does NOT replace computed Zn.
// Zn is always computed from the spherical triangle. magBearing is informational
// (user can compare their compass reading against computed Zn to check compass error).
export function sightReduce(star, Ho_deg, utc, ap, magDecl, magBearing?) → {
  intercept_nm: number,
  Zn: number,          // true azimuth 0-360 (computed, not from magBearing)
  Hc: number,          // computed altitude (degrees)
  Ho: number,          // observed altitude (degrees)
  starName: string,
  trueBearing: number | null  // magToTrue(magBearing, magDecl) if magBearing provided
}

// Convert magnetic compass bearing to true azimuth
// true = magnetic + declination (east positive)
export function magToTrue(magBearing, magDecl) → number  // degrees 0-360

// Filter catalog to stars above horizon at given AP/UTC, sorted by altitude descending
// Uses equatorialToAltAz() from altitude.js internally
export function visibleStars(ap, utc) → [{ name, ra, dec, mag, alt, az }]
```

### fix.js

```js
// Least-squares fix from N≥2 Lines of Position
// Each LOP defines equation: dN·cos(Zn_rad) + dE·sin(Zn_rad) = intercept
// where dN = north offset (nm), dE = east offset (nm) from AP
// Zn converted to radians internally before trig
// Solves overdetermined system Ax = b via normal equations (A^T A)x = A^T b
// Converts (dN_nm, dE_nm) offset to absolute lat/lon:
//   fix_lat = ap_lat + dN_nm / 60
//   fix_lon = ap_lon + dE_nm / (60 · cos(ap_lat))
// Returns null if system is near-singular (LOPs with <15° angle of cut)
export function leastSquaresFix(lops, ap) → {
  lat: number,         // fix latitude
  lon: number,         // fix longitude
  dLat_nm: number,     // north offset from AP (nm)
  dLon_nm: number,     // east offset from AP (nm)
  residuals: number[], // per-LOP residual (nm)
  confidence: number   // RMS of residuals (nm)
} | null
```

Input LOP format: `{ intercept_nm: number, Zn: number, starName: string }`

### nav-chart.js

d3 Mercator projection centered on AP, ~200nm radius default. Touch-friendly (d3-zoom for iPad).

```js
// Create chart instance bound to a DOM container
export function createNavChart(container: HTMLElement) → NavChart

// NavChart interface
NavChart.update({
  ap: { lat, lon },
  lops: [{ intercept_nm, Zn, Ho, starDec, starName, color }],
  fix: { lat, lon } | null,
  radius_nm: number     // viewport radius, default 200
})

NavChart.resize()       // call on window resize
NavChart.destroy()      // cleanup
```

**Chart elements rendered:**
- Lat/lon grid with labels
- AP marker (crosshair, yellow)
- Per-star azimuth lines (dashed, from AP toward Zn)
- Per-star LOPs (solid, perpendicular to azimuth at intercept distance, color-coded). Length: extends viewport_radius/3 each direction from intercept point along the perpendicular.
- Per-star CoEA arcs (subtle dashed arc showing circle of equal altitude). Computed from Ho and star declination (both included in LOP input). Rendered as a small arc segment near the LOP.
- Fix marker (⊕ symbol with lat/lon readout, yellow)
- Scale bar
- North indicator

**Color assignment:** Each star gets a unique color from a predefined palette. Colors are consistent across chart updates for the same star.

## UI Layout

```
┌──────────────────────────────┬──────────────────────────┐
│  [📷 Photo] [⚓ Sights]      │                          │
│                              │      d3 Nav Chart        │
│  Photo mode:                 │      LOPs, CoEA,         │
│    Sky image + detections    │      fix, azimuths       │
│    Star picker, plate solve  │                          │
│  -or-                        │      (touch zoom/pan)    │
│  Sights mode:                │                          │
│    Star selector + obs table │                          │
├──────────────────────────────┴──────────────────────────┤
│  AP: lat [___] lon [___]  │  Mag Decl: [___]°         │
│  UTC: [________________]  │  Fix: 33°42.1'N 117°18.3'W│
└─────────────────────────────────────────────────────────┘
```

### Sights Mode — Left Panel

**Global inputs (top):**
- UTC datetime picker (user-settable, drives visible star filter + GHA)
- AP lat/lon (degrees + minutes + N/S/E/W)
- Magnetic declination (degrees, E/W toggle)

**Star selector:**
- "Add Star" button opens dropdown
- Shows only stars above horizon at current AP/UTC
- Sorted by altitude descending, showing: name, magnitude, current altitude
- Selecting adds row to observations table

**Observations table:**

| Column | Type | Notes |
|--------|------|-------|
| Star | read-only | Name from catalog |
| Ho | input: deg + arcmin | Observed altitude from sextant |
| UTC | input: datetime | Defaults to global UTC, editable per-sight |
| Mag Bearing | input: degrees | Optional. Converted to true azimuth via mag declination |
| Hc | computed | Calculated altitude (read-only) |
| Intercept | computed | Ho - Hc in arcminutes/nm (read-only) |
| Zn | computed | True azimuth (read-only) |
| Remove | button | Removes row |

Computed columns update in real-time as inputs change. Each row's LOP appears on the nav chart immediately.

**"Compute Fix" button:** Appears when 2+ sights entered. Runs `leastSquaresFix()`, plots result on chart.

### Photo Nav Mode — Left Panel

Existing v3 functionality, modularized:
- Image upload (drag-drop or file picker, JPEG/PNG/HEIC)
- Bright spot detection with centroiding
- Star identification (click-to-pick from catalog, or auto-ID)
- Plate solve controls and results
- Horizon baseline tool
- SVG overlay (RA/Dec grid, catalog stars, constellations, alt/az grid)

**Bridge to Sights mode:** When plate solve succeeds, an "Export to Sights" button pre-fills observation rows with identified stars' computed data. User can then add manual Ho readings to refine the fix.

## Shared State

```js
{
  mode: 'photo' | 'sights',

  // Global inputs
  ap: { lat: number, lon: number },
  utc: Date,
  magDecl: number,

  // Sights mode
  observations: [{
    starName: string,
    Ho_deg: number,
    Ho_min: number,
    utc: Date,            // per-sight override
    magBearing: number | null,
    // Computed (read-only in UI):
    Hc: number,
    intercept_nm: number,
    Zn: number
  }],

  // Photo mode
  image: HTMLImageElement | null,
  detections: [{ x, y, brightness, fwhm }],
  identifiedStars: [{ name, px, py, ra, dec }],
  plateSolution: { ra0, dec0, scale, rotation, rms } | null,
  horizon: { p1, p2 } | null,

  // Shared output (computed from observations)
  lops: [{ intercept_nm, Zn, Ho, starDec, starName, color }],
  fix: { lat, lon, dLat_nm, dLon_nm, confidence } | null
}
```

**State management:** Centralized store with `get()`, `update(patch)`, `on(event, callback)`. Shallow freeze on reads. UI calls `computePipeline()` explicitly after input changes (not from store listener) to avoid infinite loops. Store listeners only trigger re-renders.

## Data Flow

```
Photo mode:                          Sights mode:
  Upload → detect → identify           User adds star, edits Ho/UTC/bearing
       ↓                                         ↓
  plate solve → fix (zenith method)    sightReduce() per observation
       ↓                                         ↓
  "Export to Sights" button ──────→   observations[] populated
                                                  ↓
                                      lops[] built from observations
                                                  ↓
                                      leastSquaresFix(lops, ap) [when N≥2]
                                                  ↓
                                      navChart.update({ ap, lops, fix })
```

Photo Nav mode computes its own fix via the plate-solve zenith method (existing v3 logic). It does **not** generate LOPs directly. The "Export to Sights" bridge is the only path from Photo mode into the LOP/intercept pipeline.

**`computePipeline()` in `app.js`** orchestrates the Sights mode flow:
1. For each observation, call `sightReduce()` using the per-sight UTC (falling back to global UTC if not overridden)
2. Build `lops[]` array from results
3. If N≥2, call `leastSquaresFix(lops, ap)`
4. Call `navChart.update()`
5. Update fix readout in bottom bar

## External Dependencies

- **d3 v7** (ESM via CDN) — Mercator projection, scales, zoom, SVG rendering
- **EXIF.js** (CDN) — Photo metadata extraction (Photo Nav mode only)
- No Leaflet. No build step. All vanilla ES modules via `<script type="module">`.

## Testing

`test.html` — browser-based test harness for pure function modules:
- `sight-reduction.js`: Known star/AP/UTC → expected Hc, Zn, intercept values
- `fix.js`: Known LOPs → expected fix position
- `math.js`: GMST, angular separation, coordinate conversions
- `nav-chart.js`: Not unit-tested (visual); verified manually

## Out of Scope

- Offline/PWA support
- Almanac data (using fixed RA/Dec catalog, sufficient for stars)
- Refraction/dip corrections on Ho (user applies these before input)
- Multi-user or cloud sync
- Print/export of nav chart
