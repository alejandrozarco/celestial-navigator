# Low-Hanging Fruit: Nutation, Moon Phase, Body Rise/Set

**Date:** 2026-03-24
**Status:** Approved (rev 2 — post-review fixes)

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
| 5 | L_sun (Sun mean longitude) | 0.14" | 0.00" |

Fundamental arguments (Meeus Ch. 22, direct polynomials):
- Omega = 125.04452 - 1934.136261*T (lunar ascending node)
- L_sun = 280.4665 + 36000.7698*T (Sun mean longitude)
- L_moon = 218.3165 + 481267.8813*T (Moon mean longitude)
- F = 93.2721 + 483202.0175*T (Moon argument of latitude — direct polynomial, not derived)
- D = 297.8502 + 445267.1115*T (Moon mean elongation — direct polynomial)

### Integration Points

**precessStar() in index.html and almanac.html:**
After the precession rotation matrix produces (RA, Dec), apply nutation using Meeus Eq. 23.1:
- eps = mean obliquity + deps
- dRA = dpsi * (cos(eps) + sin(eps) * sin(RA) * tan(Dec)) - deps * cos(RA) * tan(Dec)
- dDec = dpsi * sin(eps) * cos(RA) + deps * sin(RA)
- RA_apparent = RA + dRA
- Dec_apparent = Dec + dDec

Note: For Polaris (Dec ~89°), the tan(Dec) terms in dRA become large. This is expected — it reflects the physical reality that nutation causes larger RA shifts near the poles. The SHA tolerance for polar stars should remain relaxed (~40').

**solarPosition(), moonPosition(), planetPosition():**
Replace existing ad-hoc nutation snippets with the shared `nutation(T)` function for consistency. Current inconsistencies:
- `solarPosition()` uses Omega term for both dpsi and obliquity correction
- `planetPosition()` uses Omega + 2*L_sun terms for longitude nutation
- `moonPosition()` uses Omega + 2*L_moon terms (non-standard second term)

All three will be unified to use the same 5-term `nutation(T)`.

**ghaAries():**
Apply dpsi * cos(eps) correction to GHA Aries for full consistency. Currently GHA Aries uses GMST without nutation ("mean" sidereal time); adding the equation of the equinoxes (dpsi * cos(eps)) gives "apparent" sidereal time.

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
Use ecliptic longitude difference (more accurate than RA difference, avoids errors from Moon's ecliptic latitude):
- Both `solarPosition()` and `moonPosition()` compute ecliptic longitude internally (`lambda`). Expose these in return values.
- Elongation D = Moon ecliptic longitude - Sun ecliptic longitude (normalized to 0-360)
- illumination = (1 - cos(D * pi/180)) / 2 * 100
- phase = D / 360
- age = phase * 29.53059 (mean synodic month)
- name from 8 bins of 45 deg each

### UI: Sky Map (index.html)

- Replace the Moon's plain dot/circle on the canvas sky plot with a rendered phase icon:
  - Draw two arcs: one for the full circle edge, one for the terminator (an ellipse whose x-radius varies with illumination)
  - Waxing: illuminated from the right; waning: illuminated from the left
  - Rendered directly in the canvas `drawSkyPlot()` function, not CSS (since the sky map is canvas-based)
- Add moon phase info to the **existing info panel** that shows when bodies are selected for sight entry. No new popup needed.

### UI: Almanac (almanac.html)

- Add a Moon info line in the metadata block (next to "Eq. of Time" and "Sun SD"):
  - "Moon: [phase icon] Waxing Gibbous, 78% illuminated, age 10.2d"
- Phase icon rendered as a small inline SVG or Unicode moon symbol

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
- Input: date, observer latitude, a function that returns {ra, dec} for a given date, and the standard altitude h0
- Output: `{ rise, set, transit, alwaysUp, neverUp }` (times in LMT hours, same format as sunTimes)

**Fix riseSet() polar ambiguity:**
The existing `riseSet()` returns null for both "never rises" and "never sets". Modify to return distinct values:
- cosH > 1: return `{ neverRises: true }`
- cosH < -1: return `{ neverSets: true }`
This fixes the upstream bug and benefits `sunTimes()` as well.

**Algorithm — two strategies:**

*Planets (single-pass, like Sun):*
- Compute position at noon UTC
- Use modified `riseSet(dec, lat, h0)` formula
- Standard altitude h0 = -0.5667 deg (atmospheric refraction)

*Moon (altitude sampling + refinement):*
Rather than iterating from a noon estimate (which can miss events), use the USNO approach:
1. Sample Moon altitude at 2-hour intervals (0h, 2h, 4h, ... 24h) — 13 evaluations
2. Detect sign changes (altitude crossing h0) — these are rise/set events (Moon can have 0, 1, or 2 of each per day)
3. Refine each zero-crossing with bisection (3-4 steps gives ~1-minute accuracy)
4. Transit = time of maximum altitude among samples, refined similarly
- Standard altitude h0 = +0.125 deg (mean parallax 57' minus refraction 34')
- Polar case: if all 13 samples are above h0 → alwaysUp; all below → neverUp

**Bodies:** Moon, Venus, Mars, Jupiter, Saturn

**Performance note:** The almanac table computes rise/set for 5 bodies × ~27 latitudes. Moon requires ~13 position evaluations per latitude (sampling) plus ~4 per event (refinement), totaling ~500 moonPosition() calls. This may cause a brief delay on mobile. Mitigation: compute the Moon/planet table asynchronously and fill it in after the Sun/star tables render.

### UI: Almanac (almanac.html)

New table section below the existing Sunrise/Sunset table:
- Header: "Moon & Planet Rise / Set (LMT)"
- Rows: Moon, Venus, Mars, Jupiter, Saturn
- Columns: same latitude set as the Sun table (72, 68, 66, ... -55, -60)
- Each cell: rise time / set time (or polar symbols)
- Moon row includes transit time

### UI: Sky Map (index.html)

- Add rise/set info to the existing body info panel (same panel used for sight entry)
- Computed on demand from the observer's current DR position — no new persistent UI element
- Display: "Rises HH:MM / Sets HH:MM LMT" for planets and Moon

### Testing
- Cross-check Moon rise/set times against USNO data for a few dates and locations
- Verify polar behavior at high latitudes during appropriate seasons
- Verify planet rise/set times are reasonable (within ~5 min of USNO)
- Test Moon days with 0 and 2 rise events

---

## Implementation Order

1. **Nutation** first — it's the foundation; improved positions benefit all other features
2. **Moon phase** second — depends on existing position functions, small and self-contained
3. **Body rise/set** third — largest feature, benefits from nutation being in place

## Files Modified

- `index.html` — nutation(), moonPhase(), bodyRiseSet(), sky map canvas updates
- `almanac.html` — same computation functions, almanac table additions
- `test-almanac.js` — tighter star tolerances, new phase/rise-set tests
- `test-almanac-page.js` — same
- `benchmark.js` — tighter star tolerances after nutation

## Sync Strategy

Both index.html and almanac.html contain duplicated computation functions. The new `nutation()` function and any modifications to existing functions must be applied identically to both files. (Future: consider extracting shared math into a common JS file.)
