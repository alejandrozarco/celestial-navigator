import { createStore, INITIAL_STATE } from './state.js';
import { createNavChart } from './nav-chart.js';
import { sightReduce } from './sight-reduction.js';
import { leastSquaresFix } from './fix.js';
import { initUI, renderObsTable, initPhotoUI, updatePhotoFix } from './ui.js';
import { CAT } from './catalog.js';
import { plateSolve, pixelToSky } from './plate-solve.js';
import { zenithFix, horizonFix } from './math.js';
import { drawOverlay } from './overlay.js';

const store = createStore(INITIAL_STATE);
const chart = createNavChart(document.getElementById('navChart'));

// ─── Sights mode pipeline ─────────────────────────────────────────────────────

function computePipeline() {
  const state = store.get();
  if (state.mode !== 'sights') return;

  const lops = [];
  const updatedObs = state.observations.map(obs => {
    const catEntry = CAT[obs.starName];
    if (!catEntry) return obs;
    const [ra_h, dec_d] = catEntry;
    const star = { name: obs.starName, ra: ra_h * 15, dec: dec_d };
    const Ho_deg = obs.Ho_deg + obs.Ho_min / 60;
    const utc = obs.utc || state.utc;
    const result = sightReduce(star, Ho_deg, utc, state.ap, state.magDecl, obs.magBearing);
    const Zn = result.trueBearing != null ? result.trueBearing : result.Zn;
    lops.push({
      intercept_nm: result.intercept_nm,
      Zn,
      Ho: Ho_deg,
      starDec: dec_d,
      starName: obs.starName
    });
    return { ...obs, Hc: result.Hc, intercept_nm: result.intercept_nm, Zn };
  });

  const fix = lops.length >= 2 ? leastSquaresFix(lops, state.ap) : null;
  store.update({ observations: updatedObs, lops, fix });
  chart.update({ ap: state.ap, lops, fix });
  renderObsTable(store, computePipeline);
}

// ─── Photo mode pipeline ──────────────────────────────────────────────────────

function photoPipeline(photoState) {
  if (!photoState) return;
  const { sightings, overlayFlags, horizonY } = photoState;
  const state = store.get();
  const svgEl = document.getElementById('ovl');

  // Plate solve from sightings with pixel positions
  const solvable = sightings.filter(s => isFinite(s.ra_h) && isFinite(s.dec_d) && s.px != null && s.py != null);
  let solve = null, fix = null, method = '';

  if (solvable.length >= 2) {
    solve = plateSolve(solvable.map(s => ({ ra_h: s.ra_h, dec_d: s.dec_d, px: s.px, py: s.py })));
    if (solve && isFinite(solve.ra_h) && isFinite(solve.dec_d)) {
      // If a horizon is set, use it for a position fix; otherwise assume image-centre = zenith
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
    fix = zenithFix(solvable[0].ra_h, solvable[0].dec_d, state.utc);
    method = 'Single star (approx. image centre)';
  } else if (sightings.length >= 1) {
    const mRa = sightings.reduce((s, x) => s + x.ra_h, 0) / sightings.length;
    const mDec = sightings.reduce((s, x) => s + x.dec_d, 0) / sightings.length;
    fix = zenithFix(mRa, mDec, state.utc);
    method = `Mean RA/Dec (${sightings.length} stars, coarse)`;
  }

  // Update fix display
  updatePhotoFix(solve, fix, method);

  // Update nav chart with fix
  if (fix) store.update({ fix });
  chart.update({ ap: state.ap, lops: store.get().lops, fix });

  // Draw overlay — auto-enable RA/Dec grid when any sighting has an observed altitude
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
}

// ─── Export bridge ────────────────────────────────────────────────────────────

function exportToSights(sightings) {
  const state = store.get();
  const newObs = sightings
    .filter(s => CAT[s.name])
    .map(s => ({
      starName: s.name,
      Ho_deg: s.Ho_deg || 0, Ho_min: s.Ho_min || 0,
      utc: state.utc,
      magBearing: null,
      Hc: 0, intercept_nm: 0, Zn: 0
    }));

  store.update({ observations: newObs });
  // Switch to sights tab
  document.querySelector('.tab[data-mode="sights"]').click();
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
