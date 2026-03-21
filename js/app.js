import { createStore, INITIAL_STATE } from './state.js';
import { createNavChart } from './nav-chart.js';
import { sightReduce } from './sight-reduction.js';
import { leastSquaresFix } from './fix.js';
import { initUI, renderObsTable, initPhotoUI, updatePhotoFix, propagateAltAz, getManualGridSolve, showGridControls } from './ui.js';
import { CAT } from './catalog.js';
import { plateSolve, pixelToSky, manualSolve } from './plate-solve.js';
import { zenithFix, horizonFix, angSep } from './math.js';
import { drawOverlay } from './overlay.js';

const store = createStore(INITIAL_STATE);
const chart = createNavChart(document.getElementById('navChart'));

// ─── Sights mode pipeline ─────────────────────────────────────────────────────

function computePipeline() {
  const state = store.get();
  if (state.mode !== 'sights') return;

  function computeLops(ap) {
    return state.observations.map(obs => {
      const catEntry = CAT[obs.starName];
      if (!catEntry) return null;
      const [ra_h, dec_d] = catEntry;
      const star = { name: obs.starName, ra: ra_h * 15, dec: dec_d };
      const Ho_deg = obs.Ho_deg + obs.Ho_min / 60;
      const utc = obs.utc || state.utc;
      const result = sightReduce(star, Ho_deg, utc, ap, state.magDecl, obs.magBearing);
      const Zn = result.trueBearing != null ? result.trueBearing : result.Zn;
      return { intercept_nm: result.intercept_nm, Zn, Hc: result.Hc, Ho: Ho_deg, starDec: dec_d, starName: obs.starName };
    }).filter(Boolean);
  }

  // Iterate to converge even if AP is far from true position
  let fix = null, ap = state.ap;
  const initialLops = computeLops(ap);
  if (initialLops.length >= 2) {
    for (let iter = 0; iter < 10; iter++) {
      const iterLops = computeLops(ap);
      const iterFix = leastSquaresFix(iterLops, ap);
      if (!iterFix) break;
      fix = iterFix;
      const shift = Math.hypot(iterFix.dLat_nm, iterFix.dLon_nm);
      ap = { lat: iterFix.lat, lon: iterFix.lon };
      if (shift < 0.1) break;
    }
  }

  // Recompute LOPs from the converged AP for display
  const finalLops = fix ? computeLops(ap) : initialLops;
  const updatedObs = state.observations.map((obs, i) => {
    const lop = finalLops[i];
    if (!lop) return obs;
    return { ...obs, Hc: lop.Hc, intercept_nm: lop.intercept_nm, Zn: lop.Zn };
  });

  store.update({ observations: updatedObs, lops: finalLops, fix });
  // Chart shows LOPs relative to the converged AP (or original if no fix)
  chart.update({ ap: fix ? { lat: fix.lat, lon: fix.lon } : state.ap, lops: finalLops, fix });
  renderObsTable(store, computePipeline);
}

// ─── Photo mode pipeline ──────────────────────────────────────────────────────

function photoPipeline(photoState) {
  if (!photoState) return;
  const { sightings, overlayFlags, horizonY, manualGrid } = photoState;
  const state = store.get();
  const svgEl = document.getElementById('ovl');

  // Plate solve from sightings with pixel positions
  const solvable = sightings.filter(s => isFinite(s.ra_h) && isFinite(s.dec_d) && s.px != null && s.py != null);
  let solve = null, fix = null, method = '';

  if (solvable.length >= 2) {
    solve = plateSolve(solvable.map(s => ({ ra_h: s.ra_h, dec_d: s.dec_d, px: s.px, py: s.py })));
    if (solve && isFinite(solve.ra_h) && isFinite(solve.dec_d)) {
      if (horizonY != null) {
        const hPts = [0.1, 0.25, 0.5, 0.75, 0.9]
          .map(fx => pixelToSky(fx, horizonY, solve))
          .filter(Boolean);
        const abovePt = pixelToSky(0.5, Math.max(horizonY - 0.1, 0.02), solve);
        if (hPts.length >= 2 && abovePt) {
          fix = horizonFix(hPts, abovePt, state.utc);
          method = `Horizon fix (${solvable.length} stars)`;
        }
      }
      if (!fix) {
        fix = zenithFix(solve.ra_h, solve.dec_d, state.utc);
        method = `Plate solve centre (${solvable.length} stars)`;
      }
    }
  } else if (solvable.length === 1) {
    // Single star: create a synthetic solve centered on the star's RA/Dec
    // Always use manualGrid FOV/rotation so sliders work without enabling Manual Grid
    const s0 = solvable[0];
    const mg = manualGrid || { fovDeg: 60, rotDeg: 0, offsetPx: 0, offsetPy: 0 };
    const ox = (s0.px - 0.5) + (mg.offsetPx || 0);
    const oy = (0.5 - s0.py) + (mg.offsetPy || 0);
    solve = manualSolve(s0.ra_h, s0.dec_d, mg.fovDeg, mg.rotDeg, ox, oy);
    showGridControls(true);
    fix = zenithFix(s0.ra_h, s0.dec_d, state.utc);
    method = `Single star (FOV ${Math.round(mg.fovDeg)}°, rot ${Math.round(mg.rotDeg)}°)`;
  } else if (sightings.length >= 1) {
    const mRa = sightings.reduce((s, x) => s + x.ra_h, 0) / sightings.length;
    const mDec = sightings.reduce((s, x) => s + x.dec_d, 0) / sightings.length;
    fix = zenithFix(mRa, mDec, state.utc);
    method = `Mean RA/Dec (${sightings.length} stars, coarse)`;
  }

  // Sight-reduction fix from confirmed stars (Ho > 0 with optional bearing)
  const confirmed = sightings.filter(s => (s.Ho_deg > 0 || (s.Ho_min || 0) > 0));
  if (confirmed.length >= 2) {
    let ap = state.ap;
    for (let iter = 0; iter < 10; iter++) {
      const lops = [];
      for (const s of confirmed) {
        const catEntry = CAT[s.name];
        if (!catEntry) continue;
        const [ra_h, dec_d] = catEntry;
        const star = { name: s.name, ra: ra_h * 15, dec: dec_d };
        const Ho_deg = s.Ho_deg + (s.Ho_min || 0) / 60;
        const result = sightReduce(star, Ho_deg, state.utc, ap, 0, null);
        const Zn = s.az != null ? s.az : result.Zn;
        lops.push({ intercept_nm: result.intercept_nm, Zn, Ho: Ho_deg, starDec: dec_d, starName: s.name });
      }
      const srFix = leastSquaresFix(lops, ap);
      if (!srFix || !isFinite(srFix.lat) || !isFinite(srFix.lon)) break;
      fix = srFix;
      method = `Sight reduction (${confirmed.length} stars, Ho+Az)`;
      const shift = Math.hypot(srFix.dLat_nm, srFix.dLon_nm);
      ap = { lat: srFix.lat, lon: srFix.lon };
      if (shift < 0.1) break;
    }
  } else if (confirmed.length === 1 && fix) {
    method += ' + 1 Ho observation';
  }

  // Use manual grid solve as overlay if no plate solution
  const mgridSolve = manualGrid && manualGrid.enabled
    ? manualSolve(manualGrid.ra_h, manualGrid.dec_d, manualGrid.fovDeg, manualGrid.rotDeg, manualGrid.offsetPx, manualGrid.offsetPy)
    : null;
  const effectiveSolve = solve || mgridSolve;

  // Update fix display
  updatePhotoFix(effectiveSolve, fix, method);

  // Update nav chart with fix
  if (fix) store.update({ fix });
  chart.update({ ap: state.ap, lops: store.get().lops, fix });

  // Propagate estimated Alt/Az to all sightings if we have a fix
  if (fix && state.utc) {
    propagateAltAz(fix, state.utc);
  }

  // Horizon-based altitude estimation: if horizon is set and we have a solve,
  // compute each star's angular distance from the horizon line
  if (horizonY != null && effectiveSolve) {
    // angSep imported at top level
    for (const s of sightings) {
      if (s.px == null || s.py == null) continue;
      // Sky coords at the horizon directly below/above the star
      const horizonSky = pixelToSky(s.px, horizonY, effectiveSolve);
      if (!horizonSky) continue;
      // Angular distance between star and its horizon projection
      const alt = angSep(s.ra_h, s.dec_d, horizonSky.ra_h, horizonSky.dec_d);
      // Positive if star is above horizon (py < horizonY in image coords)
      s._horizAlt = s.py < horizonY ? alt : -alt;
      // If no user Ho entered, show horizon-based estimate
      if (s.Ho_deg === 0 && (s.Ho_min || 0) === 0) {
        s._estAlt = s._horizAlt;
      }
    }
  }

  // Draw overlay — auto-enable overlays when we have a solve
  const hasSolve = effectiveSolve != null;
  const mgridFlags = hasSolve
    ? { ...overlayFlags, stars: true, const: true, radec: true }
    : overlayFlags;

  drawOverlay(svgEl, {
    plateSolution: effectiveSolve,
    sightings,
    horizonPts: [],
    horizonLine: null,
    horizonY,
    overlayFlags: mgridFlags,
    fix,
    utc: state.utc
  });
}

// ─── Export bridge ────────────────────────────────────────────────────────────

function exportToSights(sightings) {
  const state = store.get();
  const magDecl = state.magDecl || 0;
  const newObs = sightings
    .filter(s => CAT[s.name])
    .filter(s => (s.Ho_deg > 0 || (s.Ho_min || 0) > 0 || (s._estAlt != null && s._estAlt > 0)))
    .map(s => {
      // Convert true Az to magnetic bearing by subtracting mag declination
      const trueAz = s.az != null ? s.az : (s._estAz != null ? s._estAz : null);
      const magBrg = trueAz != null ? ((trueAz - magDecl + 360) % 360) : null;
      // Use horizon-estimated altitude if user hasn't entered one
      let Ho_deg = s.Ho_deg || 0, Ho_min = s.Ho_min || 0;
      if (Ho_deg === 0 && Ho_min === 0 && s._estAlt != null && s._estAlt > 0) {
        Ho_deg = Math.floor(s._estAlt);
        Ho_min = (s._estAlt - Ho_deg) * 60;
      }
      return {
        starName: s.name, Ho_deg, Ho_min,
        utc: state.utc, magBearing: magBrg,
        Hc: 0, intercept_nm: 0, Zn: 0
      };
    });

  store.update({ observations: newObs });
  // Switch to sights tab — click triggers mode change, then compute
  document.querySelector('.tab[data-mode="sights"]').click();
  // Mode is now 'sights' after the click handler ran synchronously
  computePipeline();
}

// ─── Demo data ────────────────────────────────────────────────────────────────

function loadDemo() {
  const utc = new Date('2025-12-15T04:00:00Z');
  document.getElementById('utcInput').value = utc.toISOString().slice(0, 16);
  store.update({ utc });

  const demoObs = [
    { starName: 'Sirius',   Ho_deg: 30, Ho_min: 0,  utc, magBearing: null, Hc: 0, intercept_nm: 0, Zn: 0 },
    { starName: 'Canopus',  Ho_deg: 20, Ho_min: 0,  utc, magBearing: null, Hc: 0, intercept_nm: 0, Zn: 0 },
    { starName: 'Arcturus', Ho_deg: 45, Ho_min: 12, utc, magBearing: null, Hc: 0, intercept_nm: 0, Zn: 0 },
  ].filter(o => CAT[o.starName]);

  store.update({ observations: demoObs });
  computePipeline();
}

// ─── Wire up ──────────────────────────────────────────────────────────────────

initUI(store, computePipeline);
initPhotoUI(photoPipeline, exportToSights);

document.getElementById('loadDemo').addEventListener('click', loadDemo);

window.addEventListener('resize', () => chart.resize());

// Initial chart render
chart.update({ ap: store.get().ap, lops: [], fix: null });
