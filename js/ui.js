import { visibleStars } from './altitude.js';

export function initUI(store, computePipeline) {
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const mode = tab.dataset.mode;
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.querySelector(`.${mode}-panel`).classList.add('active');
      store.update({ mode });
    });
  });

  // Star selector
  const addBtn = document.getElementById('addStar');
  const dropdown = document.getElementById('starDropdown');

  addBtn.addEventListener('click', () => {
    const state = store.get();
    const stars = visibleStars(state.ap, state.utc);
    dropdown.innerHTML = '<option value="">— select star —</option>';
    const existing = state.observations.map(o => o.starName);
    stars.filter(s => !existing.includes(s.name)).forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = `${s.name} (mag ${s.mag.toFixed(1)}, alt ${s.alt.toFixed(0)}°)`;
      dropdown.appendChild(opt);
    });
    dropdown.style.display = 'inline-block';
    dropdown.focus();
  });

  dropdown.addEventListener('change', () => {
    const name = dropdown.value;
    if (!name) return;
    const state = store.get();
    const obs = [...state.observations, {
      starName: name,
      Ho_deg: 0, Ho_min: 0,
      utc: state.utc,
      magBearing: null,
      Hc: 0, intercept_nm: 0, Zn: 0
    }];
    store.update({ observations: obs });
    dropdown.style.display = 'none';
    renderObsTable(store, computePipeline);
    computePipeline();
  });

  // Global inputs
  const utcInput = document.getElementById('utcInput');
  utcInput.value = new Date().toISOString().slice(0, 16);
  utcInput.addEventListener('change', () => {
    store.update({ utc: new Date(utcInput.value + 'Z') });
    computePipeline();
  });

  document.getElementById('apLat').addEventListener('change', (e) => {
    const lat = parseDM(e.target.value, 'lat');
    if (lat != null) {
      const state = store.get();
      store.update({ ap: { ...state.ap, lat } });
      computePipeline();
    }
  });

  document.getElementById('apLon').addEventListener('change', (e) => {
    const lon = parseDM(e.target.value, 'lon');
    if (lon != null) {
      const state = store.get();
      store.update({ ap: { ...state.ap, lon } });
      computePipeline();
    }
  });

  document.getElementById('magDecl').addEventListener('change', (e) => {
    store.update({ magDecl: parseFloat(e.target.value) || 0 });
    computePipeline();
  });

  document.getElementById('computeFix').addEventListener('click', () => {
    computePipeline();
  });

  // Initial render
  renderObsTable(store, computePipeline);
  store.on('change', () => updateFixReadout(store.get()));
}

export function renderObsTable(store, computePipeline) {
  const state = store.get();
  const container = document.getElementById('obsTable');
  container.innerHTML = '';

  state.observations.forEach((obs, i) => {
    const row = document.createElement('div');
    row.className = 'obs-row';
    const obsUtcVal = (obs.utc instanceof Date ? obs.utc : new Date(obs.utc)).toISOString().slice(0, 16);
    row.innerHTML = `
      <span class="obs-name">${obs.starName}</span>
      <label>Ho:</label>
      <input type="number" class="finput obs-ho-deg" data-i="${i}" value="${obs.Ho_deg}" min="0" max="90" style="width:40px">°
      <input type="number" class="finput obs-ho-min" data-i="${i}" value="${obs.Ho_min}" min="0" max="59.9" step="0.1" style="width:50px">'
      <label>UTC:</label>
      <input type="datetime-local" class="finput obs-utc" data-i="${i}" value="${obsUtcVal}" style="width:140px">
      <label>Brg:</label>
      <input type="number" class="finput obs-brg" data-i="${i}" value="${obs.magBearing || ''}" placeholder="—" style="width:50px">°
      <span class="obs-computed">
        Hc ${obs.Hc.toFixed(1)}° | a=${obs.intercept_nm > 0 ? '+' : ''}${obs.intercept_nm.toFixed(1)}' | Zn ${obs.Zn.toFixed(0)}°
      </span>
      <button class="srmv" data-i="${i}">✕</button>
    `;
    container.appendChild(row);
  });

  // Event delegation
  container.querySelectorAll('.obs-ho-deg,.obs-ho-min,.obs-brg,.obs-utc').forEach(inp => {
    inp.addEventListener('change', () => {
      const idx = parseInt(inp.dataset.i);
      const obs = [...state.observations];
      obs[idx] = { ...obs[idx] };
      if (inp.classList.contains('obs-ho-deg')) obs[idx].Ho_deg = parseFloat(inp.value) || 0;
      if (inp.classList.contains('obs-ho-min')) obs[idx].Ho_min = parseFloat(inp.value) || 0;
      if (inp.classList.contains('obs-brg')) obs[idx].magBearing = inp.value ? parseFloat(inp.value) : null;
      if (inp.classList.contains('obs-utc')) obs[idx].utc = inp.value ? new Date(inp.value + 'Z') : state.utc;
      store.update({ observations: obs });
      computePipeline();
    });
  });

  container.querySelectorAll('.srmv').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.i);
      const obs = state.observations.filter((_, j) => j !== idx);
      store.update({ observations: obs });
      renderObsTable(store, computePipeline);
      computePipeline();
    });
  });

  // Show/hide compute fix button
  document.getElementById('computeFix').style.display = state.observations.length >= 2 ? 'inline-block' : 'none';
}

function updateFixReadout(state) {
  const el = document.getElementById('fixReadout');
  if (state.fix) {
    el.textContent = `Fix: ${formatDM(state.fix.lat, 'lat')} ${formatDM(state.fix.lon, 'lon')} (±${state.fix.confidence.toFixed(1)}nm)`;
    el.style.color = '#ff3';
  } else {
    el.textContent = '—';
    el.style.color = '';
  }
}

function parseDM(str, type) {
  // Parse "34° 12.5' N" or "118° 30.0' W" or plain number
  const m = str.match(/(\d+)[°\s]+(\d+\.?\d*)['\s]*(N|S|E|W)?/i);
  if (m) {
    let val = parseInt(m[1]) + parseFloat(m[2]) / 60;
    if (m[3] && /[SW]/i.test(m[3])) val = -val;
    return val;
  }
  const n = parseFloat(str);
  return isFinite(n) ? n : null;
}

function formatDM(d, type) {
  const abs = Math.abs(d);
  const deg = Math.floor(abs);
  const min = ((abs - deg) * 60).toFixed(1);
  const dir = type === 'lat' ? (d >= 0 ? 'N' : 'S') : (d >= 0 ? 'E' : 'W');
  return `${deg}°${min}'${dir}`;
}
