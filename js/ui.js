import { visibleStars, equatorialToAltAz } from './altitude.js';
import { CAT, CAT_BY_MAG } from './catalog.js';
import { detectBrightSpots } from './detection.js';
import { buildCatalogHash, runAutoID } from './auto-id.js';
import { manualSolve, pixelToSky } from './plate-solve.js';

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
  const nowUtc = new Date();
  utcInput.value = nowUtc.toISOString().slice(0, 16);
  store.update({ utc: nowUtc });
  utcInput.addEventListener('change', () => {
    store.update({ utc: new Date(utcInput.value + 'Z') });
    triggerPipeline();
  });

  function triggerPipeline() {
    computePipeline();
    if (_onPhotoPipeline && _photoState) _onPhotoPipeline(_photoState);
  }

  document.getElementById('apLat').addEventListener('change', (e) => {
    const lat = parseDM(e.target.value, 'lat');
    if (lat != null) {
      const state = store.get();
      store.update({ ap: { ...state.ap, lat } });
      triggerPipeline();
    }
  });

  document.getElementById('apLon').addEventListener('change', (e) => {
    const lon = parseDM(e.target.value, 'lon');
    if (lon != null) {
      const state = store.get();
      store.update({ ap: { ...state.ap, lon } });
      triggerPipeline();
    }
  });

  document.getElementById('magDecl').addEventListener('change', (e) => {
    store.update({ magDecl: parseFloat(e.target.value) || 0 });
    triggerPipeline();
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

  // If row count matches, just update computed values without destroying inputs
  const existingRows = container.querySelectorAll('.obs-row');
  if (existingRows.length === state.observations.length && existingRows.length > 0) {
    state.observations.forEach((obs, i) => {
      const comp = existingRows[i].querySelector('.obs-computed');
      if (comp) {
        const intSign = obs.intercept_nm >= 0 ? '+' : '';
        const intAbs = Math.abs(obs.intercept_nm);
        const intLabel = intAbs > 60 ? `${(intAbs / 60).toFixed(1)}°` : `${intAbs.toFixed(1)}'`;
        comp.textContent = `Hc ${obs.Hc.toFixed(1)}° | a=${intSign}${intLabel} | Zn ${obs.Zn.toFixed(0)}°`;
      }
    });
    document.getElementById('computeFix').style.display = state.observations.length >= 2 ? 'inline-block' : 'none';
    return;
  }

  // Full rebuild needed (rows added/removed)
  container.innerHTML = '';

  state.observations.forEach((obs, i) => {
    const row = document.createElement('div');
    row.className = 'obs-row';
    const obsUtcVal = (obs.utc instanceof Date ? obs.utc : new Date(obs.utc)).toISOString().slice(0, 16);
    const intSign = obs.intercept_nm >= 0 ? '+' : '';
    const intAbs = Math.abs(obs.intercept_nm);
    const intLabel = intAbs > 60 ? `${(intAbs / 60).toFixed(1)}°` : `${intAbs.toFixed(1)}'`;
    row.innerHTML = `
      <div class="obs-row-main">
        <span class="obs-name">${obs.starName}</span>
        <button class="srmv" data-i="${i}">✕</button>
      </div>
      <div class="obs-row-fields">
        <label class="flbl">Ho</label>
        <input type="number" class="finput obs-ho-deg" data-i="${i}" value="${obs.Ho_deg}" min="0" max="90" style="width:60px">°
        <input type="number" class="finput obs-ho-min" data-i="${i}" value="${(obs.Ho_min || 0).toFixed(1)}" min="0" max="59.9" step="0.1" style="width:68px">'
        <label class="flbl" style="margin-left:8px">Brg</label>
        <input type="number" class="finput obs-brg" data-i="${i}" value="${obs.magBearing || ''}" placeholder="—" style="width:72px">°
        <label class="flbl" style="margin-left:8px">UTC</label>
        <input type="datetime-local" class="finput obs-utc" data-i="${i}" value="${obsUtcVal}" style="width:185px">
      </div>
      <div class="obs-computed">Hc ${obs.Hc.toFixed(1)}° | a=${intSign}${intLabel} | Zn ${obs.Zn.toFixed(0)}°</div>
    `;
    container.appendChild(row);
  });

  // Event delegation
  container.querySelectorAll('.obs-ho-deg,.obs-ho-min,.obs-brg,.obs-utc').forEach(inp => {
    const handler = () => {
      const idx = parseInt(inp.dataset.i);
      const obs = [...state.observations];
      obs[idx] = { ...obs[idx] };
      if (inp.classList.contains('obs-ho-deg')) obs[idx].Ho_deg = parseFloat(inp.value) || 0;
      if (inp.classList.contains('obs-ho-min')) obs[idx].Ho_min = parseFloat(inp.value) || 0;
      if (inp.classList.contains('obs-brg')) obs[idx].magBearing = inp.value ? parseFloat(inp.value) : null;
      if (inp.classList.contains('obs-utc')) obs[idx].utc = inp.value ? new Date(inp.value + 'Z') : state.utc;
      store.update({ observations: obs });
      computePipeline();
    };
    inp.addEventListener('change', handler);
    inp.addEventListener('input', handler);
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
let _mgDragJustEnded = false;

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
    horizonY: null,
    detOpts: { pct: 96, maxStars: 30, clusterPx: 18 },
    manualGrid: { enabled: false, ra_h: 6, dec_d: 20, fovDeg: 60, rotDeg: 0, offsetPx: 0, offsetPy: 0 }
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

  // Overlay toggles (all except the special horizon button)
  document.querySelectorAll('.ovl-btn[data-ovl]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.ovl;
      _photoState.overlayFlags[key] = !_photoState.overlayFlags[key];
      btn.classList.toggle('active', _photoState.overlayFlags[key]);
      if (_onPhotoPipeline) _onPhotoPipeline(_photoState);
    });
  });

  // Horizon mode button + slider
  const horizonBtn    = document.getElementById('horizonModeBtn');
  const horizonCtrl   = document.getElementById('horizon-ctrl');
  const horizonSlider = document.getElementById('horizon-y');
  const horizonVal    = document.getElementById('horizon-y-val');

  horizonBtn.addEventListener('click', () => {
    const on = !_photoState.overlayFlags.horizon;
    _photoState.overlayFlags.horizon = on;
    horizonBtn.classList.toggle('active', on);
    horizonCtrl.style.display = on ? 'flex' : 'none';
    _photoState.horizonY = on ? parseInt(horizonSlider.value) / 100 : null;
    if (_onPhotoPipeline) _onPhotoPipeline(_photoState);
  });

  horizonSlider.addEventListener('input', () => {
    const pct = parseInt(horizonSlider.value);
    horizonVal.textContent = pct + '%';
    if (_photoState.overlayFlags.horizon) {
      _photoState.horizonY = pct / 100;
      if (_onPhotoPipeline) _onPhotoPipeline(_photoState);
    }
  });

  // Manual grid mode
  const mgridBtn    = document.getElementById('manualGridBtn');
  const mgridCtrl   = document.getElementById('mgrid-ctrl');
  const mgridFov    = document.getElementById('mgrid-fov');
  const mgridRot    = document.getElementById('mgrid-rot');
  const mgridFovVal = document.getElementById('mgrid-fov-val');
  const mgridRotVal = document.getElementById('mgrid-rot-val');

  mgridBtn.addEventListener('click', () => {
    const mg = _photoState.manualGrid;
    mg.enabled = !mg.enabled;
    mgridBtn.classList.toggle('active', mg.enabled);
    mgridCtrl.style.display = mg.enabled ? '' : 'none';
    // Center on first identified star if available
    if (mg.enabled && _photoState.sightings.length > 0) {
      const s0 = _photoState.sightings[0];
      mg.ra_h = s0.ra_h; mg.dec_d = s0.dec_d;
    }
    mgridFov.value = mg.fovDeg;
    mgridFovVal.textContent = mg.fovDeg + '°';
    mgridRot.value = mg.rotDeg;
    mgridRotVal.textContent = mg.rotDeg + '°';
    if (_onPhotoPipeline) _onPhotoPipeline(_photoState);
  });

  mgridFov.addEventListener('input', () => {
    const v = parseInt(mgridFov.value);
    mgridFovVal.textContent = v + '°';
    _photoState.manualGrid.fovDeg = v;
    if (_onPhotoPipeline) _onPhotoPipeline(_photoState);
  });

  mgridRot.addEventListener('input', () => {
    const v = parseInt(mgridRot.value);
    mgridRotVal.textContent = v + '°';
    _photoState.manualGrid.rotDeg = v;
    if (_onPhotoPipeline) _onPhotoPipeline(_photoState);
  });

  // Drag/scroll/shift-drag for manual grid
  let _mgDrag = null;
  const pvwrap = document.getElementById('pvwrap');

  pvwrap.addEventListener('mousedown', (e) => {
    // Allow drag when manual grid is enabled OR when grid controls are visible (single-star mode)
    const ctrlVisible = document.getElementById('mgrid-ctrl').style.display !== 'none';
    if (!_photoState.manualGrid.enabled && !ctrlVisible) return;
    const img = document.getElementById('pi');
    const rect = img.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    if (px < 0 || px > 1 || py < 0 || py > 1) return;
    _mgDrag = { startX: e.clientX, startY: e.clientY, startPx: px, startPy: py,
                origRa: _photoState.manualGrid.ra_h, origDec: _photoState.manualGrid.dec_d,
                origRot: _photoState.manualGrid.rotDeg,
                origOffX: _photoState.manualGrid.offsetPx || 0, origOffY: _photoState.manualGrid.offsetPy || 0,
                singleStar: !_photoState.manualGrid.enabled,
                shift: e.shiftKey, moved: false };
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!_mgDrag) return;
    const dx = e.clientX - _mgDrag.startX, dy = e.clientY - _mgDrag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _mgDrag.moved = true;
    if (!_mgDrag.moved) return;

    const mg = _photoState.manualGrid;
    if (_mgDrag.shift) {
      // Shift+drag = rotate
      mg.rotDeg = _mgDrag.origRot + dx * 0.5;
      mg.rotDeg = Math.max(-180, Math.min(180, mg.rotDeg));
      mgridRot.value = Math.round(mg.rotDeg);
      mgridRotVal.textContent = Math.round(mg.rotDeg) + '°';
    } else if (_mgDrag.singleStar) {
      // Single-star mode: drag adjusts pixel offsets
      const img = document.getElementById('pi');
      const rect = img.getBoundingClientRect();
      const dxNorm = (e.clientX - _mgDrag.startX) / rect.width;
      const dyNorm = (e.clientY - _mgDrag.startY) / rect.height;
      mg.offsetPx = _mgDrag.origOffX + dxNorm;
      mg.offsetPy = _mgDrag.origOffY - dyNorm;
    } else {
      // Manual grid mode: drag = pan via inverse projection to get sky delta
      const solve = manualSolve(_mgDrag.origRa, _mgDrag.origDec, mg.fovDeg, mg.rotDeg, mg.offsetPx, mg.offsetPy);
      const img = document.getElementById('pi');
      const rect = img.getBoundingClientRect();
      const curPx = (e.clientX - rect.left) / rect.width;
      const curPy = (e.clientY - rect.top) / rect.height;
      const skyStart = pixelToSky(_mgDrag.startPx, _mgDrag.startPy, solve);
      const skyCur = pixelToSky(curPx, curPy, solve);
      if (skyStart && skyCur) {
        mg.ra_h = _mgDrag.origRa - (skyCur.ra_h - skyStart.ra_h);
        mg.dec_d = Math.max(-89, Math.min(89, _mgDrag.origDec - (skyCur.dec_d - skyStart.dec_d)));
      }
    }
    if (_onPhotoPipeline) _onPhotoPipeline(_photoState);
  });

  window.addEventListener('mouseup', () => {
    if (_mgDrag && _mgDrag.moved) {
      _mgDragJustEnded = true;
      setTimeout(() => { _mgDragJustEnded = false; }, 50);
    }
    _mgDrag = null;
  });

  pvwrap.addEventListener('wheel', (e) => {
    const ctrlVisible = document.getElementById('mgrid-ctrl').style.display !== 'none';
    if (!_photoState.manualGrid.enabled && !ctrlVisible) return;
    e.preventDefault();
    const mg = _photoState.manualGrid;
    const delta = e.deltaY > 0 ? 1.1 : 0.9;
    mg.fovDeg = Math.max(5, Math.min(120, mg.fovDeg * delta));
    mgridFov.value = Math.round(mg.fovDeg);
    mgridFovVal.textContent = Math.round(mg.fovDeg) + '°';
    if (_onPhotoPipeline) _onPhotoPipeline(_photoState);
  }, { passive: false });

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

      const imgEl = document.getElementById('pi');
      const ar = imgEl.naturalWidth / imgEl.naturalHeight;
      const assignments = runAutoID(topCands, hash, undefined, ar);
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
  if (e._handled || _mgDragJustEnded) return;
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
  let preserved = {};
  if (s.candId != null) {
    const idx = _photoState.sightings.findIndex(x => x.candId === s.candId);
    if (idx >= 0) {
      preserved = { Ho_deg: _photoState.sightings[idx].Ho_deg, Ho_min: _photoState.sightings[idx].Ho_min };
      _photoState.sightings.splice(idx, 1);
    }
  }
  _photoState.sightings.push({ id: _photoState.nextId++, Ho_deg: 0, Ho_min: 0, ...preserved, ...s });
}

/** Propagate estimated Alt/Az to all sightings given a fix and UTC */
export function propagateAltAz(fix, utc) {
  if (!fix || !utc || !_photoState) return;
  for (const s of _photoState.sightings) {
    const aa = equatorialToAltAz(s.ra_h, s.dec_d, fix.lat, fix.lon, utc);
    s._estAlt = aa.alt_d;
    s._estAz = aa.az_d;
    // If Ho is 0 and no manual az, fill in estimates for convenience
    if (s.Ho_deg === 0 && (s.Ho_min || 0) === 0 && s.az == null) {
      // Don't auto-fill — just show estimates
    }
  }
  renderSightingsList();
}

function renderSightingsList() {
  const el = document.getElementById('sightings-list');
  if (!_photoState.sightings.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--tx3);font-style:italic">No stars identified yet.</div>';
    return;
  }
  el.innerHTML = _photoState.sightings.map(s => {
    const estAlt = s._estAlt != null ? s._estAlt.toFixed(1) + '°' : '';
    const estAz = s._estAz != null ? s._estAz.toFixed(1) + '°' : '';
    const userHo = s.Ho_deg + (s.Ho_min || 0) / 60;
    // Residuals: difference between user input and computed position
    let residualHtml = '';
    if (estAlt) {
      const parts = [];
      parts.push(`calc: ${estAlt} alt, ${estAz} az`);
      if (userHo > 0 && s._estAlt != null) {
        const dAlt = (userHo - s._estAlt).toFixed(1);
        parts.push(`\u0394alt=${dAlt > 0 ? '+' : ''}${dAlt}°`);
      }
      if (s.az != null && s._estAz != null) {
        let dAz = s.az - s._estAz;
        if (dAz > 180) dAz -= 360; if (dAz < -180) dAz += 360;
        parts.push(`\u0394az=${dAz > 0 ? '+' : ''}${dAz.toFixed(1)}°`);
      }
      residualHtml = `<div class="saz-est">${parts.join(' &nbsp; ')}</div>`;
    }
    return `
    <div class="srow">
      <span class="spip ${s.autoID ? 'auto' : ''}"></span>
      <span class="sname">${s.name}</span>
      <span class="scoord">${s.ra_h.toFixed(2)}h ${s.dec_d >= 0 ? '+' : ''}${s.dec_d.toFixed(1)}°</span>
      <label class="sho-lbl">Ho</label>
      <input type="number" class="finput sho-deg" data-id="${s.id}" value="${s.Ho_deg}" min="0" max="90" style="width:60px">°
      <input type="number" class="finput sho-min" data-id="${s.id}" value="${(s.Ho_min || 0).toFixed(1)}" min="0" max="59.9" step="0.1" style="width:64px">'
      <label class="sho-lbl">Az</label>
      <input type="number" class="finput saz" data-id="${s.id}" value="${s.az != null ? s.az.toFixed(1) : ''}" placeholder="—" min="0" max="360" step="0.1" style="width:72px">°
      <button class="srmv" data-id="${s.id}" style="margin-left:auto">✕</button>
      ${residualHtml}
    </div>`;
  }).join('');

  el.querySelectorAll('.sho-deg, .sho-min, .saz').forEach(inp => {
    const handler = () => {
      const id = parseInt(inp.dataset.id);
      const s = _photoState.sightings.find(x => x.id === id);
      if (!s) return;
      if (inp.classList.contains('sho-deg')) s.Ho_deg = parseFloat(inp.value) || 0;
      if (inp.classList.contains('sho-min')) s.Ho_min = parseFloat(inp.value) || 0;
      if (inp.classList.contains('saz')) s.az = inp.value ? parseFloat(inp.value) : null;
      if (_onPhotoPipeline) _onPhotoPipeline(_photoState);
    };
    inp.addEventListener('change', handler);
    inp.addEventListener('input', handler);
  });

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

/** Show/hide FOV/rotation controls based on whether a solve needs manual params */
export function showGridControls(show) {
  const ctrl = document.getElementById('mgrid-ctrl');
  const btn = document.getElementById('manualGridBtn');
  if (!ctrl || !_photoState) return;
  if (show) {
    ctrl.style.display = '';
    btn.classList.add('active');
    // Sync slider values
    const mg = _photoState.manualGrid;
    document.getElementById('mgrid-fov').value = mg.fovDeg;
    document.getElementById('mgrid-fov-val').textContent = Math.round(mg.fovDeg) + '°';
    document.getElementById('mgrid-rot').value = mg.rotDeg;
    document.getElementById('mgrid-rot-val').textContent = Math.round(mg.rotDeg) + '°';
  }
}

export function getManualGridSolve() {
  if (!_photoState || !_photoState.manualGrid.enabled) return null;
  const mg = _photoState.manualGrid;
  return manualSolve(mg.ra_h, mg.dec_d, mg.fovDeg, mg.rotDeg, mg.offsetPx, mg.offsetPy);
}
