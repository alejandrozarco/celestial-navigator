# Photo Nav Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix photo-mode pipeline trigger bug, improve auto-ID accuracy, expand the star catalog to ~130 stars with complete major constellation stick figures, add a north meridian overlay, and auto-enable the RA/Dec grid when Ho values are present.

**Architecture:** Five targeted changes across five files. No new files. Each task is self-contained and commits independently. Tasks 1 and 5 are trivial single-line fixes; Task 2 (auto-ID) and Task 4 (overlay) are the meaty algorithmic changes; Task 3 (catalog) is data-only.

**Tech Stack:** Vanilla ES modules, no build step. Tests run in Node.js (`node --input-type=module`). Browser testing at http://192.168.178.124:8042/

**Spec:** `docs/superpowers/specs/2026-03-20-photo-nav-improvements-design.md`

---

## File Map

| File | What changes |
|------|-------------|
| `js/ui.js` | Add `_onPhotoPipeline` call in Ho change handler |
| `js/auto-id.js` | `buildCatalogHash(nStars=40)` with `CAT_BY_MAG`; TOL→0.025; add `verifyAssignments` |
| `js/catalog.js` | Add ~29 stars; extend `CONST_LINES` with ~20 segments |
| `js/overlay.js` | Add `drawMeridian(svgEl, solve, sightings, horizonY)` |
| `js/app.js` | Build `effectiveFlags` with auto-`radec` in `photoPipeline` |
| `tests/auto-id.test.js` | New test file for `buildCatalogHash` and `verifyAssignments` |

---

## Task 1: Fix Ho pipeline trigger

**Files:**
- Modify: `js/ui.js` (in `renderSightingsList`, the `.sho-deg`/`.sho-min` change handler)

- [ ] **Step 1: Locate the handler**

In `js/ui.js`, find the block starting at line ~446:
```js
el.querySelectorAll('.sho-deg, .sho-min').forEach(inp => {
  inp.addEventListener('change', () => {
    const id = parseInt(inp.dataset.id);
    const s = _photoState.sightings.find(x => x.id === id);
    if (!s) return;
    if (inp.classList.contains('sho-deg')) s.Ho_deg = parseFloat(inp.value) || 0;
    if (inp.classList.contains('sho-min')) s.Ho_min = parseFloat(inp.value) || 0;
  });
});
```

- [ ] **Step 2: Add the pipeline call**

Replace the handler body to add the pipeline call after updating:
```js
el.querySelectorAll('.sho-deg, .sho-min').forEach(inp => {
  inp.addEventListener('change', () => {
    const id = parseInt(inp.dataset.id);
    const s = _photoState.sightings.find(x => x.id === id);
    if (!s) return;
    if (inp.classList.contains('sho-deg')) s.Ho_deg = parseFloat(inp.value) || 0;
    if (inp.classList.contains('sho-min')) s.Ho_min = parseFloat(inp.value) || 0;
    if (_onPhotoPipeline) _onPhotoPipeline(_photoState);
  });
});
```

- [ ] **Step 3: Verify manually**

Open http://192.168.178.124:8042/, load a photo, identify a star, and change its Ho value. The photo-fix display and overlay should update immediately.

- [ ] **Step 4: Commit**
```bash
git add js/ui.js
git commit -m "fix: trigger photo pipeline when Ho value changes"
```

---

## Task 2: Improve auto-ID accuracy

**Files:**
- Modify: `js/auto-id.js`
- Create: `tests/auto-id.test.js`

### Step group A — update buildCatalogHash

- [ ] **Step 1: Update the import in auto-id.js**

Change the first line from:
```js
import { angSep } from './math.js';
import { CAT, CAT_ENTRIES } from './catalog.js';
```
To:
```js
import { angSep } from './math.js';
import { CAT, CAT_ENTRIES, CAT_BY_MAG } from './catalog.js';
```

- [ ] **Step 2: Change TOL constant**

Change:
```js
const TOL = 0.045;
```
To:
```js
const TOL = 0.025;
```

- [ ] **Step 3: Update buildCatalogHash signature and body**

Replace the entire `buildCatalogHash` function:
```js
export function buildCatalogHash(nStars = 40) {
  const entries = CAT_BY_MAG.slice(0, nStars);
  const hash = [];
  const n = entries.length;
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        const [na, [ra_a, dec_a]] = entries[i];
        const [nb, [ra_b, dec_b]] = entries[j];
        const [nc, [ra_c, dec_c]] = entries[k];
        const edges = [
          { d: angSep(ra_a, dec_a, ra_b, dec_b), u: na, v: nb, opp: nc },
          { d: angSep(ra_b, dec_b, ra_c, dec_c), u: nb, v: nc, opp: na },
          { d: angSep(ra_c, dec_c, ra_a, dec_a), u: nc, v: na, opp: nb }
        ].sort((a, b) => a.d - b.d);
        const r1 = edges[0].d / edges[2].d;
        const r2 = edges[1].d / edges[2].d;
        hash.push({ r1, r2, apex: edges[2].opp, far1: edges[2].u, far2: edges[2].v });
      }
    }
  }
  hash.sort((a, b) => a.r1 - b.r1);
  return hash;
}
```

### Step group B — add verifyAssignments

- [ ] **Step 4: Write the failing test**

Create `tests/auto-id.test.js`:
```js
import { buildCatalogHash, runAutoID } from '../js/auto-id.js';
import { CAT_BY_MAG } from '../js/catalog.js';

test('buildCatalogHash uses top N brightest stars', () => {
  const hash40 = buildCatalogHash(40);
  const hash10 = buildCatalogHash(10);
  // C(40,3) = 9880 triangles; C(10,3) = 120
  assert(hash40.length === 9880, `expected 9880, got ${hash40.length}`);
  assert(hash10.length === 120, `expected 120, got ${hash10.length}`);
});

test('buildCatalogHash entries come from brightest stars', () => {
  const top5names = new Set(CAT_BY_MAG.slice(0, 5).map(([n]) => n));
  const hash = buildCatalogHash(5);
  // Every triangle references only stars from the top 5
  for (const t of hash) {
    assert(top5names.has(t.apex), `apex ${t.apex} not in top 5`);
    assert(top5names.has(t.far1), `far1 ${t.far1} not in top 5`);
    assert(top5names.has(t.far2), `far2 ${t.far2} not in top 5`);
  }
});

test('verifyAssignments with 2 assignments always returns both', async () => {
  // With only 2 assignments the reference pair is returned unchanged
  const { verifyAssignments } = await import('../js/auto-id.js');
  const assignments = [
    { candId: 1, star: 'Sirius',  score: 20 },
    { candId: 2, star: 'Canopus', score: 18 },
  ];
  const detections = [
    { id: 1, px: 0.3, py: 0.5, v: 100 },
    { id: 2, px: 0.7, py: 0.5, v: 90 },
  ];
  const result = verifyAssignments(assignments, detections, 1);
  assert(result.length === 2, `expected 2, got ${result.length}`);
});
```

- [ ] **Step 5: Run test to confirm it fails**
```bash
node --input-type=module << 'EOF'
let pass=0,fail=0;
global.test=(n,f)=>{try{f();pass++;console.log('✓',n);}catch(e){fail++;console.log('✗',n,e.message);}};
global.assert=(c,m)=>{if(!c)throw new Error(m||'failed')};
global.assertNear=(a,b,t,m)=>{if(Math.abs(a-b)>(t||0.001))throw new Error(`${m||''} expected ${b}, got ${a}`)};
await import('./tests/auto-id.test.js');
console.log(`\n─── ${pass} passed, ${fail} failed ───`);
EOF
```
Expected: first two tests fail (function signature wrong), third may error.

- [ ] **Step 6: Add verifyAssignments to auto-id.js**

Add this function after `hashLookup` and before `runAutoID`:
```js
export function verifyAssignments(assignments, detections, ar = 1) {
  if (assignments.length < 2) return assignments;

  // Use top 2 as reference pair to derive scale + rotation
  const ref0 = assignments[0], ref1 = assignments[1];
  const det0 = detections.find(d => d.id === ref0.candId);
  const det1 = detections.find(d => d.id === ref1.candId);
  if (!det0 || !det1) return assignments;

  const cat0 = CAT[ref0.star], cat1 = CAT[ref1.star];
  if (!cat0 || !cat1) return assignments;

  // Pixel vector ref0→ref1
  const dpxX = (det1.px - det0.px) * ar;
  const dpxY = det1.py - det0.py;
  const dpxLen = Math.hypot(dpxX, dpxY);
  if (dpxLen < 0.001) return assignments;

  // Sky vector ref0→ref1 (degrees, small-angle approx with cos(dec) correction)
  const avgDec = (cat0[1] + cat1[1]) / 2;
  const cosDec = Math.cos(avgDec * Math.PI / 180);
  const dSkyX = (cat1[0] - cat0[0]) * 15 * cosDec; // RA in deg, east-positive
  const dSkyY = cat1[1] - cat0[1];                  // Dec in deg
  const dSkyLen = Math.hypot(dSkyX, dSkyY);
  if (dSkyLen < 0.001) return assignments;

  // Scale (normalized-px per degree) and rotation from sky→pixel frame
  const scale = dpxLen / dSkyLen;
  const ux = dpxX / dpxLen, uy = dpxY / dpxLen; // pixel unit vec (ref0→ref1)
  const sx = dSkyX / dSkyLen, sy = dSkyY / dSkyLen; // sky unit vec (ref0→ref1)
  // Rotation angle α: R·[sx,sy]=[ux,uy]
  const cosA = ux * sx + uy * sy;
  const sinA = uy * sx - ux * sy;

  const THRESHOLD = 0.015; // normalized px (~12px for 800px image)

  return assignments.filter((a, idx) => {
    if (idx < 2) return true; // always keep reference pair
    const det = detections.find(d => d.id === a.candId);
    const cat = CAT[a.star];
    if (!det || !cat) return false;

    // Sky offset from ref0 to this star
    const oSkyX = (cat[0] - cat0[0]) * 15 * cosDec;
    const oSkyY = cat[1] - cat0[1];

    // Expected pixel offset from ref0 (rotate + scale)
    const expPxX = scale * (oSkyX * cosA - oSkyY * sinA);
    const expPxY = scale * (oSkyX * sinA + oSkyY * cosA);

    // Actual pixel offset from ref0
    const actPxX = (det.px - det0.px) * ar;
    const actPxY = det.py - det0.py;

    return Math.hypot(expPxX - actPxX, expPxY - actPxY) < THRESHOLD;
  });
}
```

- [ ] **Step 7: Update runAutoID to call verifyAssignments**

At the end of `runAutoID`, replace:
```js
  return result;
```
With:
```js
  return verifyAssignments(result, topN, ar);
```

- [ ] **Step 8: Run tests to confirm they pass**
```bash
node --input-type=module << 'EOF'
let pass=0,fail=0;
global.test=async(n,f)=>{try{await f();pass++;console.log('✓',n);}catch(e){fail++;console.log('✗',n,e.message);}};
global.assert=(c,m)=>{if(!c)throw new Error(m||'failed')};
global.assertNear=(a,b,t,m)=>{if(Math.abs(a-b)>(t||0.001))throw new Error(`${m||''} expected ${b}, got ${a}`)};
await import('./tests/auto-id.test.js');
console.log(`\n─── ${pass} passed, ${fail} failed ───`);
EOF
```
Expected: all 3 pass.

- [ ] **Step 9: Commit**
```bash
git add js/auto-id.js tests/auto-id.test.js
git commit -m "feat: improve auto-ID with brightness subset and geometric verification"
```

---

## Task 3: Expand catalog

**Files:**
- Modify: `js/catalog.js`

No tests needed — pure data, verified visually in the overlay.

- [ ] **Step 1: Add new bright stars to CAT**

In `js/catalog.js`, add the following entries to the `CAT` object (add after the `'Nekkar'` entry, before the closing `}`):

```js
  // ─── Bright stars not in original 58 ──────────────────────────────────────
  'Regor':           [8.159,  -47.336, 1.72],  // γ Vel
  'Al Na\'ir':       [22.137, -46.961, 1.73],  // α Gru
  'Delta Vel':       [8.745,  -54.709, 1.96],  // δ Vel
  'Aspidiske':       [9.285,  -59.275, 2.21],  // ι Car
  'Naos':            [8.059,  -40.003, 2.25],  // ζ Pup
  'Epsilon Cen':     [13.665, -53.466, 2.30],  // ε Cen
  'Eta Cen':         [14.592, -42.158, 2.31],  // η Cen
  'Alpha Lupi':      [14.699, -47.388, 2.30],  // α Lup
  'Epsilon Sco':     [16.836, -34.293, 2.29],  // ε Sco / Wei
  'Girtab':          [17.708, -39.030, 2.41],  // κ Sco
  'Zeta Cen':        [13.926, -47.288, 2.55],  // ζ Cen
  'Kraz':            [12.573, -23.397, 2.65],  // β Crv
  'Zubeneschamali':  [15.284,  -9.383, 2.61],  // β Lib
  'Algorab':         [12.498, -16.515, 2.95],  // δ Crv
  'Sadalsuud':       [21.526,  -5.571, 2.91],  // β Aqr
  'Sadalmelik':      [22.096,  -0.320, 2.95],  // α Aqr

  // ─── Constellation fill-in stars ──────────────────────────────────────────
  'Kornephoros':     [16.503,  21.490, 2.77],  // β Her
  'Zeta Her':        [16.688,  31.603, 2.81],  // ζ Her
  'Pi Her':          [17.251,  36.809, 3.16],  // π Her
  'Eta Her':         [16.714,  38.922, 3.48],  // η Her
  'Adhafera':        [10.167,  23.417, 3.44],  // ζ Leo
  'Eta Leo':         [10.122,  16.763, 3.49],  // η Leo
  'Tianguan':        [5.627,   21.143, 3.00],  // ζ Tau
  'Delta Cyg':       [19.750,  45.131, 2.87],  // δ Cyg
  'Thuban':          [14.073,  64.376, 3.65],  // α Dra (former pole star)
  'Edasich':         [15.415,  58.966, 3.29],  // ι Dra
  'Gamma Hya':       [13.315, -23.171, 2.99],  // γ Hya
  'Yed Prior':       [16.241,  -3.694, 2.74],  // δ Oph
  'Cebalrai':        [17.722,   4.567, 2.77],  // β Oph
```

- [ ] **Step 2: Add new CONST_LINES**

In `js/catalog.js`, append to the `CONST_LINES` array (before the final `]`):

```js
  // ─── Hercules (Keystone) ─────────────────────────────────────────────────
  ['Kornephoros', 'Zeta Her'],
  ['Zeta Her',    'Eta Her'],
  ['Eta Her',     'Pi Her'],
  ['Pi Her',      'Rasalhague'],

  // ─── Aquarius ────────────────────────────────────────────────────────────
  ['Sadalsuud',   'Sadalmelik'],
  ['Sadalmelik',  'Enif'],

  // ─── Corvus ──────────────────────────────────────────────────────────────
  ['Gienah',  'Kraz'],
  ['Kraz',    'Algorab'],
  ['Algorab', 'Gienah'],

  // ─── Libra ───────────────────────────────────────────────────────────────
  ['Zubenelgenubi', 'Zubeneschamali'],

  // ─── Ophiuchus (completing) ───────────────────────────────────────────────
  ['Rasalhague', 'Cebalrai'],
  ['Cebalrai',   'Sabik'],
  ['Yed Prior',  'Sabik'],

  // ─── Leo (Sickle) ────────────────────────────────────────────────────────
  ['Regulus',  'Eta Leo'],
  ['Eta Leo',  'Algieba'],
  ['Algieba',  'Adhafera'],

  // ─── Taurus (completing V) ───────────────────────────────────────────────
  ['Aldebaran', 'Tianguan'],

  // ─── Draco (fuller body) ─────────────────────────────────────────────────
  ['Eltanin',  'Edasich'],
  ['Edasich',  'Thuban'],
  ['Aldibain', 'Edasich'],

  // ─── Cygnus (west arm of cross) ──────────────────────────────────────────
  ['Sadr', 'Delta Cyg'],

  // ─── Centaurus (body/legs) ───────────────────────────────────────────────
  ['Hadar',          'Epsilon Cen'],
  ['Epsilon Cen',    'Eta Cen'],
  ['Rigil Kentaurus','Zeta Cen'],

  // ─── Hydra (extending) ───────────────────────────────────────────────────
  ['Alphard', 'Gamma Hya'],

  // ─── Scorpius (completing tail arc) ──────────────────────────────────────
  ['Shaula',  'Girtab'],
  ['Sargas',  'Epsilon Sco'],
```

- [ ] **Step 3: Verify no broken references**

Run the existing tests to confirm no import errors:
```bash
node --input-type=module << 'EOF'
let pass=0,fail=0;
global.test=(n,f)=>{try{f();pass++;console.log('✓',n);}catch(e){fail++;console.log('✗',n,e.message);}};
global.assert=(c,m)=>{if(!c)throw new Error(m||'failed')};
global.assertNear=(a,b,t,m)=>{if(Math.abs(a-b)>(t||0.001))throw new Error(`${m||''} expected ${b}, got ${a}`)};
await import('./tests/math.test.js');
await import('./tests/altitude.test.js');
await import('./tests/auto-id.test.js');
console.log(`\n─── ${pass} passed, ${fail} failed ───`);
EOF
```
Expected: all pass.

- [ ] **Step 4: Spot-check CONST_LINES references**

Run this quick check to verify every star name in CONST_LINES exists in CAT:
```bash
node --input-type=module << 'EOF'
import { CAT, CONST_LINES } from './js/catalog.js';
let bad = [];
for (const [a, b] of CONST_LINES) {
  if (!CAT[a]) bad.push(`missing: ${a}`);
  if (!CAT[b]) bad.push(`missing: ${b}`);
}
if (bad.length) { console.error('BROKEN REFS:', [...new Set(bad)].join(', ')); process.exit(1); }
else console.log('✓ All CONST_LINES references valid');
EOF
```
Expected: `✓ All CONST_LINES references valid`

- [ ] **Step 5: Commit**
```bash
git add js/catalog.js
git commit -m "feat: expand catalog to 130+ stars with complete major constellation stick figures"
```

---

## Task 4: North meridian overlay

**Files:**
- Modify: `js/overlay.js`

DOM-dependent — no unit tests. Verify visually in browser.

- [ ] **Step 1: Add helper to project without bounds clipping**

In `js/overlay.js`, add this helper after the `project` function (line ~77):
```js
// Project a sky point to pixel coords without bounds clipping (returns {px,py} or null)
function projectUnclamped(ra_h, dec_d, solve) {
  const { D2R, R2D } = { D2R: Math.PI / 180, R2D: 180 / Math.PI };
  if (!solve || !solve.cx || !solve.cy) return null;
  const r0 = solve.ra0_deg * D2R, d0 = solve.dec0_deg * D2R;
  const ra = ra_h * 15 * D2R, de = dec_d * D2R;
  const D = Math.sin(d0) * Math.sin(de) + Math.cos(d0) * Math.cos(de) * Math.cos(ra - r0);
  if (D <= 0) return null;
  const xi = Math.cos(de) * Math.sin(ra - r0) / D;
  const et = (Math.cos(d0) * Math.sin(de) - Math.sin(d0) * Math.cos(de) * Math.cos(ra - r0)) / D;
  const cx = solve.cx, cy = solve.cy;
  const px = cx[0] * xi + cx[1] * et + cx[2] + 0.5;
  const py = -(cy[0] * xi + cy[1] * et + cy[2]) + 0.5;
  return { px, py };
}
```

- [ ] **Step 2: Add drawMeridian function**

Add this function before `drawCelestialGrid`:
```js
function drawMeridian(svgEl, solve, sightings, horizonY) {
  // Only draw when: Polaris identified with Ho > 0, no horizon active
  if (horizonY != null) return;
  const polaris = (sightings || []).find(s => s.name === 'Polaris');
  if (!polaris || !(polaris.Ho_deg > 0 || polaris.Ho_min > 0)) return;

  // Project true NCP (dec=90°). Use unclamped so NCP off-screen still gives a direction.
  const ncp = projectUnclamped(solve.ra_h, 90, solve);
  if (!ncp) return;

  // Zenith is image centre
  const zx = 0.5, zy = 0.5;

  // Direction vector from zenith toward NCP
  let dx = ncp.px - zx, dy = ncp.py - zy;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;
  dx /= len; dy /= len;

  // Clip line to [0,1]×[0,1]: find t for both directions from zenith
  function clipT(ox, oy, vx, vy) {
    const ts = [];
    if (Math.abs(vx) > 1e-9) { ts.push(-ox / vx); ts.push((1 - ox) / vx); }
    if (Math.abs(vy) > 1e-9) { ts.push(-oy / vy); ts.push((1 - oy) / vy); }
    const pos = ts.filter(t => t > 1e-9);
    return pos.length ? Math.min(...pos) : 0;
  }
  const tFwd  = clipT(zx, zy,  dx,  dy);
  const tBack = clipT(zx, zy, -dx, -dy);

  const x1 = zx - dx * tBack, y1 = zy - dy * tBack;
  const x2 = zx + dx * tFwd,  y2 = zy + dy * tFwd;

  svgEl.appendChild(el('line', {
    x1: pct(x1), y1: pct(y1), x2: pct(x2), y2: pct(y2),
    stroke: 'rgba(200,220,255,0.85)', 'stroke-width': '1.5', 'stroke-dasharray': '12 4'
  }));

  // Circle and label at NCP if it's within the image
  if (ncp.px >= 0 && ncp.px <= 1 && ncp.py >= 0 && ncp.py <= 1) {
    svgEl.appendChild(el('circle', {
      cx: pct(ncp.px), cy: pct(ncp.py), r: '4',
      fill: 'rgba(200,220,255,0.85)', stroke: 'none'
    }));
    const lbl = el('text', {
      x: pct(ncp.px + 0.015), y: pct(ncp.py - 0.015),
      fill: 'rgba(200,220,255,0.9)', 'font-size': '10', 'font-family': 'sans-serif'
    });
    lbl.textContent = 'N';
    svgEl.appendChild(lbl);
  }
}
```

- [ ] **Step 3: Call drawMeridian from drawOverlay**

In `drawOverlay`, inside the `if (plateSolution && plateSolution.cx && plateSolution.cy)` block, after the `drawCelestialGrid` call, add:
```js
  drawMeridian(svgElement, plateSolution, sightings, horizonY);
```

The full block becomes:
```js
  if (plateSolution && plateSolution.cx && plateSolution.cy) {
    drawCelestialGrid(svgElement, plateSolution, overlayFlags, fix, utc);
    drawMeridian(svgElement, plateSolution, sightings, horizonY);
  }
```

Note: inside `drawOverlay` the SVG element is named `svgElement` (the function parameter). `svgEl` is only the local name used inside `drawCelestialGrid`. Use `svgElement` at the `drawOverlay` level.

- [ ] **Step 4: Verify in browser**

Load a sky photo, manually identify Polaris, enter a non-zero Ho (e.g. `34°`). Confirm:
1. A pale-blue dashed line appears across the sky indicating north.
2. Removing the Ho value (set to 0) makes the line disappear.
3. With Horizon mode active, the line does NOT appear.

- [ ] **Step 5: Commit**
```bash
git add js/overlay.js
git commit -m "feat: add north meridian overlay when Polaris is sighted with Ho"
```

---

## Task 5: Auto-enable RA/Dec grid on Ho entry

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Add effectiveFlags logic in photoPipeline**

In `js/app.js`, inside `photoPipeline`, locate the `drawOverlay` call:
```js
  drawOverlay(svgEl, {
    plateSolution: solve,
    sightings,
    horizonPts: [],
    horizonLine: null,
    horizonY,
    overlayFlags,
    fix,
    utc: state.utc
  });
```

Replace it with:
```js
  const hasHo = sightings.some(s => s.Ho_deg > 0 || s.Ho_min > 0);
  const effectiveFlags = hasHo ? { ...overlayFlags, radec: true } : overlayFlags;

  drawOverlay(svgEl, {
    plateSolution: solve,
    sightings,
    horizonPts: [],
    horizonLine: null,
    horizonY,
    overlayFlags: effectiveFlags,
    fix,
    utc: state.utc
  });
```

- [ ] **Step 2: Verify in browser**

Load a photo, identify a star, enter any Ho value. Confirm the RA/Dec grid appears automatically. Verify the RA/Dec toggle button still works to manually disable it.

- [ ] **Step 3: Run full test suite**
```bash
node --input-type=module << 'EOF'
let pass=0,fail=0;
global.test=async(n,f)=>{try{await f();pass++;console.log('✓',n);}catch(e){fail++;console.log('✗',n,e.message);}};
global.assert=(c,m)=>{if(!c)throw new Error(m||'failed')};
global.assertNear=(a,b,t,m)=>{if(Math.abs(a-b)>(t||0.001))throw new Error(`${m||''} expected ${b}, got ${a}`)};
await import('./tests/math.test.js');
await import('./tests/altitude.test.js');
await import('./tests/sight-reduction.test.js');
await import('./tests/fix.test.js');
await import('./tests/auto-id.test.js');
console.log(`\n─── ${pass} passed, ${fail} failed ───`);
EOF
```
Expected: all pass.

- [ ] **Step 4: Commit**
```bash
git add js/app.js
git commit -m "feat: auto-enable RA/Dec grid overlay when sightings have Ho values"
```
