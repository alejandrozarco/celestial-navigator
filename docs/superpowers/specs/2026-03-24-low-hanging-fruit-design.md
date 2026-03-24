# Low-Hanging Fruit: Nutation, Moon Phase, Body Rise/Set

**Date:** 2026-03-24
**Status:** Approved

## Overview

Three self-contained features that improve accuracy and add practical planning data to the celestial navigator and almanac. All build on existing position functions with minimal new code.

---

## Feature 1: Nutation Correction (Top 5 IAU 1980 Terms)

### Purpose
Reduce star position residuals from ~8' to ~1-2' by adding nutation to the precession pipeline.

### Implementation

**New function: `nutation(T)`**
- Input: T = Julian centuries from J2000.0
- Output: `{ dpsi, deps }` — nutation in longitude and obliquity (degrees)
- Uses the 5 largest terms from the IAU 1980 nutation series:

| # | Argument | Dpsi coeff | Deps coeff |
|---|----------|-----------|-----------|
| 1 | Omega (lunar node) | -17.20" | 9.20" |
| 2 | 2(F - D + Omega) | -1.32" | 0.57" |
| 3 | 2(F + Omega) | -0.23" | 0.10" |
| 4 | 2*Omega | 0.21" | -0.09" |
| 5 | L_sun (Sun mean anomaly) | 0.14" | 0.00" |

Fundamental arguments (Meeus Ch. 22):
- Omega = 125.04452 - 1934.136261*T (lunar ascending node)
- L_sun = 280.4665 + 36000.7698*T (Sun mean longitude)
- L_moon = 218.3165 + 481267.8813*T (Moon mean longitude)
- F = L_moon - Omega (Moon argument of latitude)
- D = L_moon - L_sun (Moon mean elongation)

### Integration Points

**precessStar() in index.html and almanac.html:**
After the precession rotation matrix produces (RA, Dec), apply nutation:
- eps = mean obliquity + deps
- RA_apparent = RA + dpsi * cos(eps)
- Dec_apparent = Dec + dpsi * sin(eps) * sin(RA) + deps * cos(RA)

**solarPosition(), moonPosition(), planetPosition():**
Replace existing ad-hoc nutation snippets with the shared `nutation(T)` function for consistency. The existing nutation in these functions only uses the dominant Omega term; this upgrade adds 4 more terms.

### Expected Accuracy Improvement
- Capella Dec: ~8' -> ~1-2' residual vs Skyfield
- Aldebaran Dec: ~8' -> ~1-2' residual vs Skyfield
- Most stars: <1' in both SHA and Dec

### Testing
- Update benchmark.js tolerances (star Dec can tighten from 0.15 deg to ~0.05 deg)
- Run bench.py reference data comparison
- Verify test-almanac.js and test-almanac-page.js still pass with tighter star tolerances

---

## Feature 2: Moon Phase & Illumination

### Purpose
Show the Moon's phase visually on the sky map and in the almanac.

### Implementation

**New function: `moonPhase(date)`**
- Input: Date object
- Output: `{ phase, illumination, age, name }`
  - `phase`: 0-1 cycle (0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter)
  - `illumination`: 0-100 (percent of disk illuminated)
  - `age`: 0-29.53 (days since last new moon)
  - `name`: one of "New", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full", "Waning Gibbous", "Last Quarter", "Waning Crescent"

**Algorithm:**
Uses Sun and Moon RA already computed by `solarPosition()` and `moonPosition()`:
- Elongation D = Moon RA - Sun RA (normalized to 0-360)
- illumination = (1 - cos(D * pi/180)) / 2 * 100
- phase = D / 360
- age = phase * 29.53059 (mean synodic month)
- name from 8 bins of 45 deg each

### UI: Sky Map (index.html)

- Replace the Moon's plain dot marker with a CSS phase icon:
  - Use a circular element with a CSS radial-gradient or box-shadow to render the illuminated/dark portions
  - No images — pure CSS crescent based on the illumination percentage and waxing/waning state
- Add illumination % and phase name to the body info popup that appears on tap/hover

### UI: Almanac (almanac.html)

- Add a Moon info line in the metadata block (next to "Eq. of Time" and "Sun SD"):
  - "Moon: [phase icon] Waxing Gibbous, 78% illuminated, age 10.2d"

### Testing
- Verify known phase dates (e.g., full moon dates from USNO)
- Verify illumination = 0% at new moon, 100% at full moon
- Verify phase name transitions at correct elongation boundaries

---

## Feature 3: Moon & Planet Rise/Set Times

### Purpose
Show when the Moon and navigational planets are above the horizon, for observation planning.

### Implementation

**New function: `bodyRiseSet(date, lat, positionFn, h0)`**
- Input: date, observer latitude, a function that returns {dec} for a given date, and the standard altitude h0
- Output: `{ rise, set, transit, alwaysUp, neverUp }` (times in LMT hours, same format as sunTimes)

**Algorithm — two strategies:**

*Planets (single-pass, like Sun):*
- Compute position at noon UTC
- Use existing `riseSet(dec, lat, h0)` formula
- Standard altitude h0 = -0.5667 deg (atmospheric refraction)

*Moon (iterative):*
- Compute Moon position at 0h, 12h, 24h UTC
- Initial rise/set estimate from noon position using riseSet formula
- Iterate 2-3 times: recompute Moon position at estimated time, recalculate
- Standard altitude h0 = +0.125 deg (mean parallax 57' minus refraction 34')
- Moon can have 0, 1, or 2 rise/set events per day; handle gracefully

**Bodies:** Moon, Venus, Mars, Jupiter, Saturn

### UI: Almanac (almanac.html)

New table section below the existing Sunrise/Sunset table:
- Header: "Moon & Planet Rise / Set (LMT)"
- Rows: Moon, Venus, Mars, Jupiter, Saturn
- Columns: same latitude set as the Sun table (72, 68, 66, ... -55, -60)
- Each cell: rise time / set time (or polar symbols)
- Moon row includes transit time

### UI: Sky Map (index.html)

- In the body info popup (shown on tap/hover), add "Rises HH:MM / Sets HH:MM" for planets and Moon
- Computed on demand from the observer's current DR position — no new persistent UI element

### Testing
- Cross-check Moon rise/set times against USNO data for a few dates and locations
- Verify polar behavior at high latitudes during appropriate seasons
- Verify planet rise/set times are reasonable (within ~5 min of USNO)

---

## Implementation Order

1. **Nutation** first — it's the foundation; improved positions benefit all other features
2. **Moon phase** second — depends on existing position functions, small and self-contained
3. **Body rise/set** third — largest feature, benefits from nutation being in place

## Files Modified

- `index.html` — nutation(), moonPhase(), bodyRiseSet(), sky map UI updates
- `almanac.html` — same computation functions, almanac table additions
- `test-almanac.js` — tighter star tolerances, new phase/rise-set tests
- `test-almanac-page.js` — same
- `benchmark.js` — tighter star tolerances after nutation
