# Changelog

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
