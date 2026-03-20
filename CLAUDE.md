# Celestial Nav — Project Context

## What this is
A browser-based dual-mode celestial navigation app. ES modules, no build step.

**Live site:** http://192.168.178.124:8042/
**Test harness:** http://192.168.178.124:8042/test.html

## Architecture
Two modes share a centralized state store → least-squares fix → d3 Mercator nav chart.

| Mode | Description |
|------|-------------|
| **Sights** | Manual Ho entry → intercept method → LOP fix |
| **Photo** | Drop sky image → detect stars → plate solve → zenith fix |

## File map
```
js/math.js          — D2R, R2D, nrm, clamp, gmst, zenithFix, solve3x3, angSep
js/catalog.js       — 58 navigational stars (CAT, CAT_ENTRIES, CAT_BY_MAG, CONST_LINES)
js/altitude.js      — equatorialToAltAz, visibleStars
js/sight-reduction.js — gha, lha, calcHcZn, sightReduce, magToTrue
js/fix.js           — leastSquaresFix (least-squares LOP intersection)
js/state.js         — createStore, INITIAL_STATE (pub/sub)
js/nav-chart.js     — d3 Mercator chart: LOPs, fix marker, AP, zoom
js/plate-solve.js   — plateSolve, projectToPixel, pixelToSky
js/detection.js     — detectBrightSpots (centroiding)
js/auto-id.js       — buildCatalogHash, runAutoID (triangle pattern matching)
js/overlay.js       — drawOverlay (SVG sky overlay: grid, constellations, stars)
js/ui.js            — initUI (sights), initPhotoUI (photo), renderObsTable
js/app.js           — entry point: wires store → pipeline → chart → UI
index.html          — app shell (d3 + EXIF CDN, dual-mode CSS layout)
test.html           — browser test harness
tests/              — unit tests (math, altitude, sight-reduction, fix)
```

## Service
Served by a systemd user service on port 8042.

```bash
# Status
systemctl --user status celestial-nav

# Restart / stop
systemctl --user restart celestial-nav
systemctl --user stop celestial-nav

# Logs
journalctl --user -u celestial-nav -f
```

Service file: `~/.config/systemd/user/celestial-nav.service`

## Running tests
```bash
# Node (quick)
node --input-type=module << 'EOF'
let pass=0,fail=0;
global.test=(n,f)=>{try{f();pass++;console.log('✓',n);}catch(e){fail++;console.log('✗',n,e.message);}};
global.assert=(c,m)=>{if(!c)throw new Error(m||'failed')};
global.assertNear=(a,b,t,m)=>{if(Math.abs(a-b)>(t||0.001))throw new Error(`${m||''} expected ${b}, got ${a}`)};
await import('./tests/math.test.js');
await import('./tests/altitude.test.js');
await import('./tests/sight-reduction.test.js');
await import('./tests/fix.test.js');
console.log(`\n─── ${pass} passed, ${fail} failed ───`);
EOF

# Browser: open http://192.168.178.124:8042/test.html
```

## Plan / Spec docs
- `docs/superpowers/plans/2026-03-20-dual-mode-nav-implementation.md` — implementation plan (tasks 1-13, all complete)
- `docs/superpowers/specs/2026-03-20-dual-mode-nav-design.md` — design spec
- `docs/superpowers/specs/2026-03-19-celestial-nav-redesign.md` — prior redesign spec

## Key conventions
- `ra` in `sight-reduction.js` is in **degrees** (ra_h × 15). Catalog stores hours.
- AP: `{ lat, lon }` in decimal degrees, west longitude is negative
- Intercept in **nautical miles** (arcmin × 1), positive = toward star
- All angles in degrees in public APIs; radians only internally
- No build step — all imports are relative ESM paths

## What's next (possible)
- Wire photo-mode sightings into sight-reduction pipeline (currently Export to Sights prefills Ho=0)
- Add altitude intercept refinement in photo mode (from monolith `altitudeFix`)
- Responsive layout for mobile
- Persist state to localStorage
