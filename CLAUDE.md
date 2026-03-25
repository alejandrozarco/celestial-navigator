# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Celestial Navigator — a browser-based celestial navigation tool. Single-file architecture with no build step, no frameworks, no ES modules. All JavaScript and CSS are inline in HTML files.

## Commands

```bash
node test-navigator.js            # Run navigator (index.html) test suite
node test-almanac-page.js         # Run almanac page tests
```

No build, lint, or compile steps. Open `index.html` directly in a browser.

## Architecture

**Two self-contained HTML files with intentionally duplicated computation code:**

- `index.html` (~3800 lines) — Main app: sight entry, fix computation, LOP plot, Leaflet map, sky chart. All JS/CSS inline.
- `almanac.html` — Companion page: generates daily almanac tables (GHA, Dec, rise/set times). Duplicates core astronomical functions from index.html by design.

**Computation pipeline (both files share these functions):**
- `julianDate()` → `solarPosition()` / `moonPosition()` / `planetPosition()` / `ghaStar()` — Ephemeris computation (VSOP87 Sun, Standish planetary elements, lunar theory, J2000 star catalog with proper motion + precession)
- `correct()` — Sextant Hs→Ho correction pipeline (refraction, dip, IE, parallax, semi-diameter)
- `reduce()` — Sight reduction (Pub. 229: computed altitude + azimuth from AP)
- `lsFix()` / `directFix()` — Position fix (least-squares intercept or Gauss-Newton COP iteration)

**Supporting files:**
- `sw.js` — Service worker (cache-first PWA, version `celnav-v15`)
- `manifest.json` — PWA manifest
- `test-navigator.js` — Node.js test harness: extracts `<script>` from index.html, creates browser stubs, runs in VM sandbox. Tests validate against JPL Horizons, Air Almanac 2026, and Nautical Almanac reference data.

## Testing

Tests run in Node.js using `vm` module — no test framework dependency. The harness stubs out DOM/Leaflet/localStorage to run browser code in Node. Reference data sources: NASA/JPL Horizons (apparent positions), Air Almanac 2026, Nautical Almanac tables.

When modifying astronomical computation functions, run the full suite and verify arc-minute tolerances haven't regressed.

## Key Conventions

- **No build step.** Everything stays as plain inline JS/CSS in HTML files.
- **Duplicated code between index.html and almanac.html is intentional.** Both pages are self-contained. Update both when modifying shared computation functions.
- **58 navigational stars** stored in `STARS` array (Hipparcos J2000.0 coords + proper motion). Precessed to observation date at runtime.
- **Commit format:** `<type>: <description>` (feat/fix/docs/test/chore). Keep messages neutral and professional — no internal process details.
- **Design:** Dark theme (#06091a bg, #c8a84b gold accent), Cinzel headers, Share Tech Mono for data, Crimson Pro body text.
