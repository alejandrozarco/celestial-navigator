import { visibleStars } from './altitude.js';
import { CAT, CAT_BY_MAG } from './catalog.js';
import { detectBrightSpots } from './detection.js';
import { buildCatalogHash, runAutoID } from './auto-id.js';

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

// ─── Photo Nav UI ────────────────────────────────────────────────────────────

let _photoState = null; // { candidates, sightings, nextId, overlayFlags, detOpts }
let _pickerCandId = null;
let _catalogHash = null;
let _onPhotoPipeline = null;
let _onExportSights = null;

function getCatalogHash() {
  if (!_catalogHash) _catalogHash = buildCatalogHash();
  return _catalogHash;
}

export function initPhotoUI(onPhotoPipeline, onExportSights) {
  _onPhotoPipeline = onPhotoPipeline;
  _onExportSights = onExportSights;

  _photoState = {
    candidates: [],
    sightings: [],
    nextId: 1,
    overlayFlags: { stars: true, const: true, radec: false, altaz: false },
    detOpts: { pct: 96, maxStars: 30, clusterPx: 18 }
  };

  const dz = document.getElementById('dropzone');
  const fileInput = document.getElementById('photoFile');

  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handlePhotoFile(f);
  });
  dz.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', function () { if (this.files[0]) handlePhotoFile(this.files[0]); });

  // Detection settings
  const detPct = document.getElementById('det-pct');
  const detMax = document.getElementById('det-max');
  const detCluster = document.getElementById('det-cluster');
  function updateDetOpts() {
    const pct = parseInt(detPct.value);
    const maxStars = parseInt(detMax.value);
    const clusterPx = parseInt(detCluster.value);
    document.getElementById('det-pct-val').textContent = pct + '%ile';
    if (isFinite(pct) && isFinite(maxStars) && isFinite(clusterPx)) {
      _photoState.detOpts = { pct, maxStars, clusterPx };
      photoRedetect();
    }
  }
  detPct.addEventListener('input', updateDetOpts);
  detMax.addEventListener('change', updateDetOpts);
  detCluster.addEventListener('change', updateDetOpts);

  // Action buttons
  document.getElementById('redetectBtn').addEventListener('click', photoRedetect);
  document.getElementById('autoIdBtn').addEventListener('click', photoAutoID);
  document.getElementById('clearSightingsBtn').addEventListener('click', photoClearSightings);
  document.getElementById('exportSightsBtn').addEventListener('click', () => {
    if (_onExportSights) _onExportSights([..._photoState.sightings]);
  });

  // Overlay toggles
  document.querySelectorAll('.ovl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.ovl;
      _photoState.overlayFlags[key] = !_photoState.overlayFlags[key];
      btn.classList.toggle('active', _photoState.overlayFlags[key]);
      if (_onPhotoPipeline) _onPhotoPipeline(_photoState);
    });
  });

  // Picker
  document.getElementById('picker-close').addEventListener('click', closePicker);
  document.getElementById('psearch').addEventListener('input', renderPickerList);

  // Photo click (identify)
  document.getElementById('pvwrap').addEventListener('click', handlePhotoClick);
}

async function handlePhotoFile(file) {
  _photoState.candidates = [];
  _photoState.sightings = [];
  _photoState.nextId = 1;

  const url = URL.createObjectURL(file);
  const imgEl = document.getElementById('pi');
  imgEl.src = url;
  await new Promise(r => { imgEl.onload = r; });

  // Try to read EXIF time
  if (window.EXIF) {
    EXIF.getData(file, function () {
      const dt = EXIF.getTag(this, 'DateTimeOriginal') || EXIF.getTag(this, 'DateTime');
      if (dt) {
        document.getElementById('utcInput').value = dt.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
      }
    });
  }

  document.getElementById('dropzone').style.display = 'none';
  document.getElementById('photoView').style.display = '';
  document.getElementById('autoid-bar').className = 'autoid-bar';
  clearMarkers();
  renderSightingsList();
  photoRedetect();
}

function photoRedetect() {
  const imgEl = document.getElementById('pi');
  if (!imgEl.src || imgEl.src === location.href) return;
  const { sightings, candidates, detOpts } = _photoState;

  // Keep candidates that have identified sightings
  const sightCandIds = new Set(sightings.map(s => s.candId).filter(Boolean));
  _photoState.candidates = candidates.filter(c => sightCandIds.has(c.id));
  clearUnidentifiedMarkers();

  const found = detectBrightSpots(imgEl, detOpts);
  const W = Math.min(imgEl.naturalWidth, 800);
  const H = Math.round(imgEl.naturalHeight * W / imgEl.naturalWidth);
  const clPx = detOpts.clusterPx || 18;
  let added = 0;

  for (const f of found) {
    const nearCand = _photoState.candidates.some(c => c.px != null && Math.hypot((c.px - f.px) * W, (c.py - f.py) * H) < clPx);
    const nearSight = sightings.some(s => s.px != null && Math.hypot((s.px - f.px) * W, (s.py - f.py) * H) < clPx);
    if (nearCand || nearSight) continue;
    const id = _photoState.nextId++;
    _photoState.candidates.push({ id, px: f.px, py: f.py, v: f.v });
    renderCandidateDot(id, f.px, f.py, 'candidate');
    added++;
  }
  document.getElementById('det-note').textContent =
    found.length ? `${added} new candidates (${_photoState.candidates.length} total)` : 'No bright spots — click to place manually';
}

function photoAutoID() {
  const bar = document.getElementById('autoid-bar');
  bar.textContent = 'Running pattern match…';
  bar.className = 'autoid-bar visible';

  setTimeout(() => {
    try {
      const hash = getCatalogHash();
      const topCands = [..._photoState.candidates].sort((a, b) => b.v - a.v).slice(0, 12);
      if (topCands.length < 3) { bar.textContent = 'Need ≥3 detected candidates.'; return; }

      const assignments = runAutoID(topCands, hash);
      const existingNames = new Set(_photoState.sightings.map(s => s.name));
      let matched = 0;

      for (const a of assignments) {
        if (existingNames.has(a.star)) continue;
        const cat = CAT[a.star];
        const cand = _photoState.candidates.find(c => c.id === a.candId);
        if (!cat || !cand) continue;
        addSighting({ name: a.star, ra_h: cat[0], dec_d: cat[1], px: cand.px, py: cand.py, candId: a.candId, autoID: true });
        updateCandidateMarker(a.candId, 'auto-id', a.star, true);
        existingNames.add(a.star);
        matched++;
      }

      bar.textContent = matched
        ? `Auto-ID: matched ${matched} star${matched > 1 ? 's' : ''}`
        : `No confident matches found — try with more / better-separated candidates`;

      renderSightingsList();
      if (_onPhotoPipeline) _onPhotoPipeline(_photoState);
    } catch (e) {
      bar.textContent = 'Auto-ID error: ' + e.message;
    }
  }, 10);
}

function photoClearSightings() {
  _photoState.sightings = [];
  clearMarkers();
  renderSightingsList();
  document.getElementById('photo-fix').style.display = 'none';
  document.getElementById('exportSightsBtn').style.display = 'none';
  if (_onPhotoPipeline) _onPhotoPipeline(_photoState);
}

function handlePhotoClick(e) {
  if (e._handled) return;
  e._handled = true;
  const img = document.getElementById('pi');
  const rect = img.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width;
  const py = (e.clientY - rect.top) / rect.height;
  if (px < 0 || px > 1 || py < 0 || py > 1) return;

  const W = rect.width, H = rect.height;
  const near = _photoState.candidates.find(c => c.px != null && Math.hypot((c.px - px) * W, (c.py - py) * H) < 18);
  if (near) { openPicker(near.id); return; }

  const id = _photoState.nextId++;
  _photoState.candidates.push({ id, px, py, v: 0 });
  renderCandidateDot(id, px, py, 'manual-pt');
  openPicker(id);
}

function addSighting(s) {
  if (s.candId != null) {
    const idx = _photoState.sightings.findIndex(x => x.candId === s.candId);
    if (idx >= 0) _photoState.sightings.splice(idx, 1);
  }
  _photoState.sightings.push({ id: _photoState.nextId++, ...s });
}

function renderSightingsList() {
  const el = document.getElementById('sightings-list');
  if (!_photoState.sightings.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--tx3);font-style:italic">No stars identified yet.</div>';
    return;
  }
  el.innerHTML = _photoState.sightings.map(s => `
    <div class="srow">
      <span class="spip ${s.autoID ? 'auto' : ''}"></span>
      <span class="sname">${s.name}</span>
      <span class="scoord">${s.ra_h.toFixed(2)}h ${s.dec_d >= 0 ? '+' : ''}${s.dec_d.toFixed(1)}°</span>
      ${s.px != null ? `<span style="font-size:10px;color:var(--tx3);font-family:var(--mono)">(${(s.px * 100).toFixed(0)}%,${(s.py * 100).toFixed(0)}%)</span>` : `<span class="snopx">no pixel pos</span>`}
      <button class="srmv" data-id="${s.id}" style="margin-left:auto">✕</button>
    </div>
  `).join('');
  el.querySelectorAll('.srmv').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const s = _photoState.sightings.find(x => x.id === id);
      if (s?.candId != null) {
        const cand = _photoState.candidates.find(c => c.id === s.candId);
        updateCandidateMarker(s.candId, cand?.v === 0 ? 'manual-pt' : 'candidate', null, false);
      }
      _photoState.sightings = _photoState.sightings.filter(x => x.id !== id);
      renderSightingsList();
      if (_onPhotoPipeline) _onPhotoPipeline(_photoState);
    });
  });
}

function openPicker(candId) {
  _pickerCandId = candId;
  const existing = _photoState.sightings.find(s => s.candId === candId);
  document.getElementById('picker-title').textContent = existing ? `Replace: ${existing.name}` : 'Identify star';
  document.getElementById('psearch').value = '';
  renderPickerList();
  const wrap = document.getElementById('picker-wrap');
  wrap.style.display = 'flex';
  setTimeout(() => document.getElementById('psearch').focus(), 50);
  wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closePicker() {
  document.getElementById('picker-wrap').style.display = 'none';
  _pickerCandId = null;
}

function renderPickerList() {
  const q = document.getElementById('psearch').value.toLowerCase().trim();
  const pl = document.getElementById('plist');
  pl.innerHTML = '';
  CAT_BY_MAG.filter(([n]) => !q || n.toLowerCase().includes(q)).slice(0, 30).forEach(([name, [ra_h, dec_d, mag]]) => {
    const row = document.createElement('div');
    row.className = 'pstar';
    row.innerHTML = `<span class="pstar-name">${name}</span><span class="pstar-coords">${ra_h.toFixed(2)}h ${dec_d >= 0 ? '+' : ''}${dec_d.toFixed(1)}°</span><span class="pstar-mag ${mag < 1 ? 'bright' : ''}">${mag >= 0 ? '+' : ''}${mag.toFixed(1)}</span>`;
    row.addEventListener('click', () => {
      const cand = _photoState.candidates.find(c => c.id === _pickerCandId);
      const px = cand ? cand.px : null, py = cand ? cand.py : null;
      addSighting({ name, ra_h, dec_d, px, py, candId: _pickerCandId, autoID: false });
      if (_pickerCandId != null) {
        const cls = cand?.v === 0 ? 'manual-pt identified' : 'identified';
        updateCandidateMarker(_pickerCandId, cls, name, false);
      }
      closePicker();
      renderSightingsList();
      if (_onPhotoPipeline) _onPhotoPipeline(_photoState);
    });
    pl.appendChild(row);
  });
}

// Candidate marker DOM management
function renderCandidateDot(id, px, py, cls) {
  const wrap = document.getElementById('pvwrap');
  const dot = document.createElement('div');
  dot.id = `cand-${id}`;
  dot.className = `cmarker ${cls}`;
  dot.style.left = `${(px * 100).toFixed(3)}%`;
  dot.style.top = `${(py * 100).toFixed(3)}%`;
  dot.addEventListener('click', e => { e.stopPropagation(); e._handled = true; openPicker(id); });
  wrap.appendChild(dot);
}

function updateCandidateMarker(id, cls, label, isAuto) {
  const dot = document.getElementById(`cand-${id}`);
  if (!dot) return;
  dot.className = `cmarker ${cls}`;
  const oldLbl = document.getElementById(`lbl-${id}`);
  if (oldLbl) oldLbl.remove();
  if (label) {
    const lbl = document.createElement('div');
    lbl.id = `lbl-${id}`;
    lbl.className = 'cmk-lbl' + (isAuto ? ' auto' : '');
    lbl.textContent = label;
    lbl.style.left = dot.style.left;
    lbl.style.top = dot.style.top;
    document.getElementById('pvwrap').appendChild(lbl);
  }
}

function clearMarkers() {
  document.querySelectorAll('.cmarker,.cmk-lbl').forEach(e => e.remove());
}

function clearUnidentifiedMarkers() {
  const ids = new Set(_photoState.sightings.map(s => s.candId).filter(Boolean));
  _photoState.candidates.forEach(c => {
    if (!ids.has(c.id)) {
      document.getElementById(`cand-${c.id}`)?.remove();
      document.getElementById(`lbl-${c.id}`)?.remove();
    }
  });
}

export function updatePhotoFix(solve, fix, method) {
  const el = document.getElementById('photo-fix');
  const exportBtn = document.getElementById('exportSightsBtn');
  if (fix && isFinite(fix.lat) && isFinite(fix.lon)) {
    const fmtC = (d, t) => {
      const a = Math.abs(d), deg = Math.floor(a), min = ((a - deg) * 60).toFixed(1);
      const h = t === 'lat' ? (d >= 0 ? 'N' : 'S') : (d >= 0 ? 'E' : 'W');
      return `${deg}°${min}'${h}`;
    };
    el.innerHTML = `<div class="fix-coords">${fmtC(fix.lat, 'lat')} ${fmtC(fix.lon, 'lon')}</div><div class="photo-method">${method}</div>`;
    el.style.display = '';
    exportBtn.style.display = '';
  } else {
    el.style.display = 'none';
    exportBtn.style.display = 'none';
  }
}

export function getPhotoState() {
  return _photoState;
}
