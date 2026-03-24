# Changelog

## 2026-03-24 (v0.1.73)

### Added
- **IAU 1980 nutation** — `nutation()` with top 5 terms applied to ghaAries (equation of equinoxes), precessStar (Meeus Eq. 23.1), and all position functions
- **Hipparcos proper motion catalog** — 58 navigational stars upgraded from pre-precessed SHA/Dec to J2000.0 RA/Dec + proper motion (pmR/pmD arcsec/yr)
- **IAU 1976 precession matrix** — Lieske 1979 3-rotation matrix replaces simple linear precession for sub-arcminute star accuracy across decades
- **Moon phase display** — `moonPhase()` from ecliptic elongation with illumination %, age, and phase name
- **Moon phase icon on sky chart** — rendered with lit/dark halves and ellipse terminator curve, replacing the plain dot
- **Moon phase in body selector** — phase name, illumination %, and age shown when Moon is selected
- **Moon phase in almanac** — phase info in daily metadata block alongside Eq. of Time and Sun SD
- **Body rise/set times** — `riseSet()` with polar disambiguation, `bodyRiseSet()` for Sun/planets, `moonRiseSet()` with 13-sample altitude sweep + bisection
- **Moon & Planet Rise/Set table** — new almanac section with rise/set times for Moon, Venus, Mars, Jupiter, Saturn across 14 latitudes
- **Rise/set in body info panel** — rise and set times shown for all bodies in the navigator body selector
- **Planet positions in almanac** — `planetPosition()` and `helioPos()` ported to almanac.html for rise/set computation
- **Skyfield benchmark** — `bench.py` generates random reference data from Skyfield/DE440s, `benchmark.js` compares against our engine (398/400 typical pass rate)
- **Almanac test suite** — `test-almanac-page.js` with 97 tests covering almanac.html functions
- **Version label** — version number and date displayed in both index.html and almanac.html headers

### Fixed
- `riseSet()` polar ambiguity — now returns `{neverRises:true}` vs `{neverSets:true}` instead of both returning `null`
- `sunTimes()` updated to handle new riseSet return format with proper polar day/night detection

### Changed
- `test-almanac.js` renamed to `test-navigator.js` to reflect that it tests index.html, not the almanac
- Star tolerances tightened from 0.3° to 0.05° (except Polaris at 0.3°) after nutation + proper motion improvements
- Nutation computation unified across solarPosition, moonPosition, planetPosition, and ghaAries via shared `nutation()` function

## 2026-03-23

### Added
- **COP fix on map** — green diamond marker showing the direct circle-of-position fix on the Leaflet map, matching the LOP plot overlay
- **Intercept lines** — dashed azimuth lines from AP to each LOP foot on both the LOP plot and map, showing intercept direction and distance
- **Residual error heatmap** — toggleable overlay on the LOP plot visualizing RMS residual error across the plot area (blue = low, red = high), showing why the fix is where it is

### Fixed
- LOP plot perpendicular direction was incorrect at non-cardinal azimuths — sign error in canvas Y component caused lines to not be truly perpendicular to the azimuth bearing
- LOP plot fix marker now matches the map's blended fix position when Polaris or transit sights override LS fix components
- COP fix marker on map now appears on initial load in LS intercept mode
- Map markers (fix, AP, LOPs, confidence ellipse, COP fix) no longer persist after deleting all sights

## 2026-03-22

### Added
- **Moon support** — Meeus Ch.45 lunar ephemeris with horizontal parallax, semi-diameter, and upper/lower limb corrections in the Hs-to-Ho pipeline
- **Save / Load sessions** — auto-save to localStorage, JSON export/import, CSV sight log export, GPX waypoint export
- **Star finder** — interactive north polar stereographic sky chart with zoom, pan, horizon line, and switchable azimuthal/equatorial grid overlays
- **Sight planning** — suggests 5-7 optimal bodies with best azimuth spread for current position and time
- **LOPs on Leaflet map** — intercept lines of position drawn on the nautical chart with celestial body labels
- **Confidence ellipse** — 95% error ellipse from fix covariance matrix, displayed on both LOP plot and Leaflet map
- **Sight averaging** — average multiple sights of the same body to reduce random error, with standard deviation display
- **LOP plot collapsible** — click header to toggle visibility
- **Live UTC toggle** — highlighted button shows active state on desktop and mobile

### Fixed
- Map bottom half not rendering — switched to absolute positioning with ResizeObserver
- Session restore overwriting longitude direction — moved toggle button property setup before autoRestore
- Restore confirm dialog blocking initial page render — deferred after first paint
- Single-sight LOP no longer incorrectly labeled as "FIX"
- showWorkings crash for intercept sights without AP
- editSight preserves negative Hs sign

### Changed
- Reduction workings use plain text labels instead of Unicode symbols
- Body selector dropdown cleaned up (removed star markers)
- Suggested bodies label updated (was "SUGGESTED STARS")
- Duplicate tile layer creation removed from map init
- Sky plot "above horizon" count excludes auxiliary constellation stars

## 2026-03-20

### Added
- Magellan route screenshots
- Sanlúcar de Barrameda screenshot
- PWA manifest and service worker for offline support

## 2026-03-19

### Added
- Sun position (Meeus Ch.25)
- Planet positions (Venus, Mars, Jupiter, Saturn)
- Running fix with dead reckoning
- Fix quality labels (Good / Moderate / Poor)
- Daily almanac page generator
- Leaflet map with dark/satellite/standard tiles and nautical overlay

## 2026-03-18

### Added
- Initial release
- Intercept method (Marcq St. Hilaire)
- Direct COP fix (Gauss-Newton)
- Polaris latitude
- Meridian transit longitude
- 58 navigational stars (J2000.0)
- Sextant corrections (IE, dip, refraction)
- Interactive LOP plot
