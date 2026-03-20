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

All other modules carry over from the existing redesign spec (`2026-03-19-celestial-nav-redesign.md`).

## Module APIs

### sight-reduction.js

Pure functions, no DOM dependency.

```js
// Greenwich Hour Angle from UTC + star RA
// GHA_Aries = GMST(utc) converted to degrees
// GHA_star = GHA_Aries + RA (adjusted to 0-360)
export function gha(utc, ra_deg) → number  // degrees 0-360

// Local Hour Angle = GHA + AP longitude (west negative convention)
export function lha(gha_deg, ap_lon) → number  // degrees 0-360

// Computed altitude and true azimuth from AP + star declination + GHA
// Hc = asin(sin(AP_lat)·sin(dec) + cos(AP_lat)·cos(dec)·cos(LHA))
// Z  = atan2(-cos(dec)·sin(LHA), sin(dec)·cos(AP_lat) - cos(dec)·cos(LHA)·sin(AP_lat))
// Zn = Z adjusted to 0-360
export function calcHcZn(ap_lat, ap_lon, dec, gha_deg) → { Hc_deg: number, Zn_deg: number }

// Full sight reduction for one star observation
// Computes GHA → LHA → Hc/Zn → intercept
// intercept = Ho - Hc (in arcminutes = nautical miles)
// Positive intercept = observed altitude > computed = actual position is toward the star
export function sightReduce(star, Ho_deg, utc, ap, magDecl, magBearing?) → {
  intercept_nm: number,
  Zn: number,          // true azimuth 0-360
  Hc: number,          // computed altitude (degrees)
  Ho: number,          // observed altitude (degrees)
  starName: string
}

// Convert magnetic compass bearing to true azimuth
// true = magnetic + declination (east positive)
export function magToTrue(magBearing, magDecl) → number  // degrees 0-360
```

### fix.js

```js
// Least-squares fix from N≥2 Lines of Position
// Each LOP defines equation: x·cos(Zn) + y·sin(Zn) = intercept
// where x = north offset (nm), y = east offset (nm) from AP
// Solves overdetermined system Ax = b
// Converts (dx_nm, dy_nm) offset to absolute lat/lon
export function leastSquaresFix(lops, ap) → {
  lat: number,         // fix latitude
  lon: number,         // fix longitude
  dLat_nm: number,     // north offset from AP (nm)
  dLon_nm: number,     // east offset from AP (nm)
  residuals: number[], // per-LOP residual (nm)
  confidence: number   // RMS of residuals (nm)
}
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
  lops: [{ intercept_nm, Zn, starName, color }],
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
- Per-star LOPs (solid, perpendicular to azimuth at intercept distance, color-coded)
- Per-star CoEA arcs (subtle dashed arc showing circle of equal altitude)
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

  // Shared output (computed from either mode)
  lops: [{ intercept_nm, Zn, starName, color }],
  fix: { lat, lon, dLat_nm, dLon_nm, confidence } | null
}
```

**State management:** Centralized store with `get()`, `update(patch)`, `on(event, callback)`. Shallow freeze on reads. UI calls `computePipeline()` explicitly after input changes (not from store listener) to avoid infinite loops. Store listeners only trigger re-renders.

## Data Flow

```
Sights mode:                         Photo mode:
  User edits Ho/UTC/bearing            Upload → detect → identify → plate solve
       ↓                                         ↓
  sightReduce() per observation        "Export to Sights" (optional)
       ↓                                         ↓
  lops[] ←──────────────────────────── lops[]
       ↓
  leastSquaresFix(lops, ap)  [when N≥2]
       ↓
  navChart.update({ ap, lops, fix })
```

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
