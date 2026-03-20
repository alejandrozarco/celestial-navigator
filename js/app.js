import { createStore, INITIAL_STATE } from './state.js';
import { createNavChart } from './nav-chart.js';
import { sightReduce } from './sight-reduction.js';
import { leastSquaresFix } from './fix.js';
import { initUI, renderObsTable } from './ui.js';
import { CAT } from './catalog.js';

const store = createStore(INITIAL_STATE);
const chart = createNavChart(document.getElementById('navChart'));

function computePipeline() {
  const state = store.get();
  if (state.mode !== 'sights') return;

  const lops = [];
  const updatedObs = state.observations.map(obs => {
    const catEntry = CAT[obs.starName];
    if (!catEntry) return obs;
    const [ra_h, dec_d, mag] = catEntry;
    const star = { name: obs.starName, ra: ra_h * 15, dec: dec_d };
    const Ho_deg = obs.Ho_deg + obs.Ho_min / 60;
    const utc = obs.utc || state.utc;
    const result = sightReduce(star, Ho_deg, utc, state.ap, state.magDecl, obs.magBearing);
    lops.push({
      intercept_nm: result.intercept_nm,
      Zn: result.Zn,
      Ho: Ho_deg,
      starDec: dec_d,
      starName: obs.starName
    });
    return { ...obs, Hc: result.Hc, intercept_nm: result.intercept_nm, Zn: result.Zn };
  });

  const fix = lops.length >= 2 ? leastSquaresFix(lops, state.ap) : null;
  store.update({ observations: updatedObs, lops, fix });
  chart.update({ ap: state.ap, lops, fix });
  renderObsTable(store, computePipeline);
}

// Wire up UI
initUI(store, computePipeline);

// Handle resize
window.addEventListener('resize', () => chart.resize());

// Initial chart render
chart.update({ ap: store.get().ap, lops: [], fix: null });
