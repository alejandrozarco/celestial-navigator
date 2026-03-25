# Celestial Navigator

A browser-based celestial navigation tool for computing position fixes from sextant observations. No server required — runs entirely in the browser as a single HTML file.

**[Live App](https://alexanderkeur-del.github.io/celestial-navigator/)** | **[Almanac Generator](https://alexanderkeur-del.github.io/celestial-navigator/almanac.html)**

![Celestial Navigator — Strait of Magellan Fix](screenshots/demo-fix-map.png)

## Features

### Sight Reduction
- **Intercept Method** (Marcq St. Hilaire) — computed altitude, azimuth, and intercept from assumed position
- **Direct COP Fix** — AP-free Gauss-Newton iteration on circles of position
- **Polaris Latitude** — direct latitude from Polaris with a0/a1/a2 corrections
- **Meridian Transit** — longitude from star transit observations
- **Lunar Distance** — determine GMT from Moon-body angular distance (clearing + interpolation)
- **Sight Averaging** — average multiple sights of the same body to reduce random error

### Celestial Bodies
- **58 Navigational Stars** — Hipparcos J2000.0 coordinates with proper motion, IAU 1976 precession matrix, and IAU 1980 nutation correction
- **Sun** — Meeus Ch.25 solar position (~1' accuracy)
- **Moon** — Meeus Ch.45 lunar theory with parallax, semi-diameter, and phase display (illumination, age, terminator rendering on sky chart)
- **Planets** — Venus, Mars, Jupiter, Saturn via Standish orbital elements (~1-5')
- **Rise/Set Times** — body rise/set for Sun, Moon, and planets with polar disambiguation

### Sextant Corrections
- Index Error (IE)
- Dip correction (height of eye)
- Atmospheric refraction (Bennett formula)
- Moon parallax (HP &times; cos Ha) and semi-diameter (upper/lower limb)
- Full Hs &rarr; Ho pipeline with step-by-step workings

### Navigation Features
- **Running Fix (DR)** — advance LOPs for vessel motion (course + speed)
- **Fix Quality** — RMS residual labels (Good / Moderate / Poor) with per-sight diagnostics
- **Confidence Ellipse** — 95% error ellipse from covariance matrix on both LOP plot and map
- **Interactive LOP Plot** — pan, zoom (toward cursor), azimuth lines, intercept lines, fix markers
- **Residual Error Heatmap** — toggleable overlay visualizing RMS error across the LOP plot (blue = low, red = high)
- **COP Fix on Map** — direct circle-of-position fix shown as a green diamond on the Leaflet map
- **Leaflet Map** — dark/satellite/standard tiles with nautical chart overlay, LOPs, and body labels
- **Live AP Recalculation** — all sights update when assumed position changes

### Star Finder
- **Polar Stereographic Chart** — interactive sky plot centered on NCP or SCP (toggle)
- **Azimuthal and Equatorial Grids** — switchable coordinate overlays
- **Sight Planning** — suggests 5-7 optimal bodies with best azimuth spread for your position and time
- **Zoom and Pan** — scroll to zoom, drag to reposition, double-click to reset

### Save / Load
- **Auto-save** — session persists in localStorage, restored on next visit
- **JSON export/import** — save and load full sessions
- **CSV export** — sight log as spreadsheet-compatible CSV
- **GPX export** — fix position as waypoint for mapping apps

### Offline
- Progressive Web App (PWA) with service worker
- Works offline after first visit (except map tiles)

## Getting Started

Open `index.html` in any modern browser. No build step, no dependencies to install. Or visit the **[live app](https://alexanderkeur-del.github.io/celestial-navigator/)** directly.

### Quick Tutorial

**1. Load the demo session**

The fastest way to see the tool in action is to click **LOAD DEMO** at the bottom of the page. This loads a pre-built evening twilight session over Florence with Polaris, Venus, Jupiter, and four stars. You'll see the computed fix, LOPs on the map, the confidence ellipse, and sight workings immediately.

**2. Take your first manual sight**

1. Set your **Assumed Position** (latitude and longitude) in the top panel, or leave the default.
2. Set the **UTC date and time** of your observation. You can toggle **LIVE UTC** to auto-fill the current time.
3. Choose a celestial body from the dropdown — the **Suggested Bodies** list shows the best picks for your position and time.
4. Enter your **sextant altitude** (Hs) in degrees and minutes. Set the **Index Error** and **Height of Eye** if known.
5. For Moon sights, select the **limb** (upper or lower) — parallax and semi-diameter are applied automatically.
6. Click **ADD SIGHT**. The app computes the observed altitude (Ho), computed altitude (Hc), azimuth (Zn), and intercept.

**3. Get a fix**

After adding two or more sights, the app computes a position fix. The fix appears as a red cross on both the **LOP plot** and the **Leaflet map**. A 95% confidence ellipse shows the fix uncertainty.

- Toggle between **LS Intercept** (least-squares intercept method) and **Direct COP** (circle-of-position iteration) using the radio buttons.
- Use **Show Workings** on any sight to see the full Hs &rarr; Ho correction pipeline.
- Enable the **Residual Heatmap** on the LOP plot to visualize where the fix has the lowest error.

**4. Running fix**

If you're underway, enter your **course** and **speed** in the Running Fix panel. The app advances earlier LOPs for vessel motion so they can be combined with later sights.

**5. Star finder**

Open the **Star Finder** panel to see a north polar stereographic sky chart for your position and time. It shows all 58 navigational stars, planets, the Sun, and Moon, with the horizon circle for your latitude. Use it to plan which bodies to observe.

**6. Save your work**

Sessions auto-save to localStorage and restore on next visit. Use **Export JSON** to save a full session file, **Export CSV** for a spreadsheet-compatible sight log, or **Export GPX** to get the fix as a waypoint.

## Almanac Generator

The included [almanac page](https://alexanderkeur-del.github.io/celestial-navigator/almanac.html) generates daily almanac data for any date, similar to the official Air Almanac or Nautical Almanac. Use it to:

- **Verify computations** &mdash; cross-check GHA and Dec values used by the navigator
- **Plan observations** &mdash; find sunrise/sunset and twilight times for your latitude
- **Study celestial nav** &mdash; see how GHA Aries, Sun position, and star coordinates change through the day

The almanac includes:
- Sun GHA and Dec at 10-minute intervals (AM/PM layout)
- 58 navigational stars precessed to the selected year
- Sunrise, sunset, civil and nautical twilight for 27 latitudes
- Moon and planet rise/set times for 14 latitudes
- Moon phase (name, illumination, age)
- Equation of Time
- Validation against Air Almanac 2026 reference data

## Testing

The project includes `test-navigator.js` (203 tests) and `test-almanac-page.js` (97 tests), Node.js test suites that validate the core celestial computations against tabulated reference data (Air Almanac 2026, Nautical Almanac, JPL Horizons). They extract JavaScript from their respective HTML files, run in sandboxed VMs, and check:

- **GHA Aries** — against Air Almanac 2026 Day 001 values (tolerance: 1.2'), multi-date consistency, and 6-hour interval rate checks
- **Sun GHA and Dec** — position at multiple dates including solstices and equinoxes (tolerance: 1-3'), hourly rate verification
- **Moon** — distance, horizontal parallax, semi-diameter, declination, and GHA at 8 dates spanning the year, plus hourly rate check
- **Planets** — ecliptic range, GHA sanity, and 6-month motion checks for Venus, Mars, Jupiter, Saturn across 4 quarterly dates each
- **Sight reduction (Pub. 229)** — 10 computed altitude cases verified against exact spherical trigonometry, including zenith, horizon, pole, southern hemisphere, and below-horizon cases
- **Azimuth (Pub. 229)** — cardinal direction checks, east/west sky placement, and LHA symmetry verification with 360°/0° wrap handling
- **Sextant corrections** — Nautical Almanac refraction table (1° through 90°), dip table (1m through 20m), IE, Moon parallax and semi-diameter
- **Star catalog** — 58 stars present, spot-checks on SHA and Dec for 7 key stars against catalog epoch

Run with:

```bash
node test-navigator.js       # Navigator (index.html) — 203 tests
node test-almanac-page.js    # Almanac (almanac.html) — 97 tests
node benchmark.js            # Run Skyfield/DE440s benchmark (5000 cases)
.venv/bin/python bench.py    # Regenerate Skyfield reference data (requires skyfield)
```

### Current status

**300 tests passing** (203 + 97).

### Skyfield/DE440s Benchmark

5000 cases across 10 categories, validated against Skyfield with JPL DE440s ephemeris. Reference data spans **2000&ndash;2050** with random dates and globally randomized observer positions (lat &plusmn;70&deg;, lon &plusmn;180&deg;).

#### Core accuracy

| Category | Cases | Pass Rate | Mean Error | P90 | Max |
|----------|------:|----------:|-----------:|----:|----:|
| Star SHA/Dec | 500 | 100% | 0.27' | 0.34' | 0.38' |
| Sight Reduction | 500 | 99.2% | 1.4' | 0.51' | 57' |
| Lunar Distance | 500 | 97.2% | 5.4' | 17.1' | 94' |
| Moon Phase | 500 | 100% | 0.006% | 0.01% | 0.02% |

**Stars** &mdash; 58 navigational stars hold sub-arcminute accuracy across the full 50-year range (mean sky separation 0.27', max 0.38'). Proper motion + IAU 1976 precession + nutation keeps all stars within 0.4' of Skyfield/DE440s.

**Sight reduction** &mdash; computed altitude and azimuth match Skyfield to a median of 0.16' (P90: 0.51'). Outliers are driven by planetary ephemeris error, not the reduction itself. 97% of cases fall within 7.2'.

**Lunar distance** &mdash; clearing and angular distance computation matches Skyfield to a median of 0.8'. Accuracy degrades for Venus (Standish mean elements) at dates far from J2000; 84% of cases are within 12'.

**Moon phase** &mdash; illumination fraction matches Skyfield to within 0.02% across all 500 cases.

#### Position fix accuracy

| Category | Cases | Pass Rate | Mean Error | P90 | Max |
|----------|------:|----------:|-----------:|----:|----:|
| End-to-End Fix (LS) | 500 | 99.8% | 2.3 nm | 9.1 nm | 30.4 nm |
| Direct COP Fix | 500 | 99.8% | 1.5 nm | 0.6 nm | 30.9 nm |
| Running Fix (DR) | 500 | 99.8% | 2.1 nm | 6.5 nm | 41.3 nm |

**LS intercept fix** &mdash; full pipeline (ephemeris &rarr; sight reduction &rarr; least-squares fix) tested with up to 6 random sights per case at randomized global positions. 89% of fixes land within 6 nm.

**Direct COP fix** &mdash; Gauss-Newton circle-of-position iteration on the same cases. Lower mean error (1.5 nm vs 2.3 nm) with tighter distribution. Both solvers achieve 99.8% pass rate at 30 nm tolerance.

**Running fix (DR)** &mdash; observer moves along a random course (4&ndash;12 kn) over 30-minute sight windows. Tests `advanceLops()` DR correction pipeline. Accuracy matches the stationary fix, confirming DR advancement works correctly.

#### Sextant noise sensitivity

| Noise Level | Mean Error | P90 | Max |
|-------------|----------:|---------:|--------:|
| Clean (no noise) | 2.3 nm | 9.1 nm | 30.4 nm |
| &sigma; = 0.5' | 2.4 nm | 8.7 nm | 30.4 nm |
| &sigma; = 1.0' | 2.7 nm | 9.1 nm | 29.4 nm |
| &sigma; = 2.0' | 3.3 nm | 8.7 nm | 28.5 nm |

Simulated Gaussian sextant error added to reference altitudes. Even at &sigma; = 2.0' (rough conditions), mean fix error only increases by ~1 nm, demonstrating the least-squares solver's robustness to random observation noise.

#### Per-decade accuracy (mean error)

| Decade | Stars | Sight Red. | Lunar Dist. | LS Fix | DR Fix |
|--------|------:|-----------:|------------:|-------:|-------:|
| 2000s | 0.28' | 1.8' | 1.6' | 1.5 nm | 1.3 nm |
| 2010s | 0.28' | 0.4' | 3.7' | 2.5 nm | 1.6 nm |
| 2020s | 0.27' | 1.5' | 3.9' | 2.7 nm | 2.0 nm |
| 2030s | 0.27' | 1.1' | 7.2' | 3.3 nm | 3.2 nm |
| 2040s | 0.27' | 1.8' | 8.5' | 2.2 nm | 2.9 nm |

Star accuracy remains stable across all decades. Lunar distance and fix accuracy degrade at the edges of the date range due to Standish mean orbital elements (especially Venus), which are optimized for dates near J2000.

### Possible future refinements

- **Planet accuracy** — Standish orbital elements give ~5-16' SHA accuracy; perturbation terms (especially for Jupiter-Saturn interaction and Venus) could improve this to sub-arcminute.

## Screenshots

| Map with LOPs | LOP Plot | Star Finder |
|---|---|---|
| ![Map LOPs](screenshots/map-lops.png) | ![LOP Plot](screenshots/lop-plot.png) | ![Star Finder](screenshots/star-finder.png) |

| Sanlúcar de Barrameda | Strait of Magellan | Mid-Pacific | Guam |
|---|---|---|---|
| ![Sanlúcar](screenshots/sanlucar.png) | ![Strait](screenshots/magellan-strait.png) | ![Pacific](screenshots/magellan-pacific.png) | ![Guam](screenshots/magellan-guam.png) |

| Fix Result | Workings | Almanac |
|---|---|---|
| ![Fix Result](screenshots/fix-result.png) | ![Workings](screenshots/workings.png) | ![Almanac](screenshots/almanac.png) |

## File Structure

```
index.html              Main app (self-contained, no build step)
almanac.html            Daily almanac page generator
test-navigator.js       Navigator test suite (203 tests)
test-almanac-page.js    Almanac test suite (97 tests)
bench.py                Skyfield/DE440s reference data generator
benchmark.js            Benchmark runner (5000 cases, 10 categories)
manifest.json           PWA manifest
sw.js                   Service worker for offline support
screenshots/            README screenshots
CHANGELOG.md            Version history
```

## License

MIT
