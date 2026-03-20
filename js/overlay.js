import { D2R, R2D, nrm, clamp, gmst } from './math.js';
import { CAT, CAT_ENTRIES, CONST_LINES } from './catalog.js';
import { projectToPixel } from './plate-solve.js';

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

function pct(v) { return (v * 100).toFixed(3) + '%'; }

/**
 * Draw the sky overlay SVG.
 * @param {SVGElement} svgElement
 * @param {Object} state - { plateSolution, sightings, horizonPts, horizonLine, overlayFlags, fix, utc }
 */
export function drawOverlay(svgElement, state) {
  while (svgElement.firstChild) svgElement.removeChild(svgElement.firstChild);

  const { plateSolution, sightings = [], horizonPts = [], horizonLine = null,
          overlayFlags = {}, fix = null, utc = null, horizonY = null } = state;

  // Horizon in-progress dots
  for (const p of horizonPts) {
    svgElement.appendChild(el('circle', { cx: pct(p.px), cy: pct(p.py), r: '5', fill: '#e03878', stroke: '#fff', 'stroke-width': '1' }));
  }

  if (horizonLine) {
    const { x1, y1, x2, y2, angle } = horizonLine;
    const dx = x2 - x1, dy = y2 - y1;
    let lx0, ly0, lx1, ly1;
    if (Math.abs(dx) < 1e-6) {
      lx0 = x1; ly0 = 0; lx1 = x1; ly1 = 1;
    } else {
      const tLeft = -x1 / dx, tRight = (1 - x1) / dx;
      const t0 = Math.min(tLeft, tRight), t1 = Math.max(tLeft, tRight);
      lx0 = x1 + t0 * dx; ly0 = y1 + t0 * dy;
      lx1 = x1 + t1 * dx; ly1 = y1 + t1 * dy;
    }
    svgElement.appendChild(el('line', {
      x1: pct(lx0), y1: pct(ly0), x2: pct(lx1), y2: pct(ly1),
      stroke: '#e03878', 'stroke-width': '1.5', 'stroke-dasharray': '8 4', opacity: '0.85'
    }));
    const tx = el('text', { x: pct(lx0 + 0.01), y: pct(Math.max(ly0 - 0.02, 0.02)), fill: '#e03878', 'font-size': '11', 'font-family': 'sans-serif' });
    tx.textContent = `Horizon  ${angle.toFixed(1)}°`;
    svgElement.appendChild(tx);
    for (const p of [{ px: x1, py: y1 }, { px: x2, py: y2 }]) {
      svgElement.appendChild(el('circle', { cx: pct(p.px), cy: pct(p.py), r: '4', fill: '#e03878', stroke: '#fff', 'stroke-width': '1' }));
    }
  }

  // Horizon line (from slider)
  if (horizonY != null && isFinite(horizonY)) {
    const hy = pct(horizonY);
    svgElement.appendChild(el('line', {
      x1: '0%', y1: hy, x2: '100%', y2: hy,
      stroke: '#e03878', 'stroke-width': '1.5', 'stroke-dasharray': '10 5', opacity: '0.85'
    }));
    const tx = el('text', { x: '1%', y: pct(Math.max(horizonY - 0.015, 0.015)),
      fill: '#e03878', 'font-size': '11', 'font-family': 'sans-serif' });
    tx.textContent = 'Horizon';
    svgElement.appendChild(tx);
  }

  if (plateSolution && plateSolution.cx && plateSolution.cy) {
    drawCelestialGrid(svgElement, plateSolution, overlayFlags, fix, utc);
    drawMeridian(svgElement, plateSolution, sightings, horizonY);
  }
}

function project(ra_h, dec_d, solve) {
  const p = projectToPixel(ra_h, dec_d, solve);
  if (!p) return null;
  return { x: pct(p.px), y: pct(p.py), px: p.px, py: p.py };
}

function polyline(svgEl, pts, attrs) {
  if (pts.length < 2) return;
  const e = document.createElementNS(NS, 'polyline');
  e.setAttribute('points', pts.join(' '));
  e.setAttribute('fill', 'none');
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  svgEl.appendChild(e);
}

function buildPath(svgEl, solve, stepFn, stroke, sw, dash) {
  let seg = [];
  for (const coord of stepFn()) {
    const p = project(coord[0], coord[1], solve);
    if (p && p.px >= -0.01 && p.px <= 1.01 && p.py >= -0.01 && p.py <= 1.01) {
      seg.push(`${p.x},${p.y}`);
    } else {
      polyline(svgEl, seg, { stroke, 'stroke-width': sw, ...(dash ? { 'stroke-dasharray': dash } : {}) });
      seg = [];
    }
  }
  polyline(svgEl, seg, { stroke, 'stroke-width': sw, ...(dash ? { 'stroke-dasharray': dash } : {}) });
}

function altazToEquatorial(alt, az, lat, lon, utcDate) {
  const altR = alt * D2R, azR = az * D2R, latR = lat * D2R;
  const sinDec = Math.sin(altR) * Math.sin(latR) + Math.cos(altR) * Math.cos(latR) * Math.cos(azR);
  const dec_d = R2D * Math.asin(clamp(sinDec, -1, 1));
  const HA_r = Math.atan2(-Math.cos(altR) * Math.sin(azR), Math.sin(altR) * Math.cos(latR) - Math.cos(altR) * Math.cos(azR) * Math.sin(latR));
  const LMST = nrm(gmst(utcDate) + lon);
  const ra_h = nrm(LMST - R2D * HA_r) / 15;
  return { ra_h, dec_d };
}

function drawMeridian(svgEl, solve, sightings, horizonY) {
  if (horizonY != null) return;
  const polaris = (sightings || []).find(s => s.name === 'Polaris');
  if (!polaris || !(polaris.Ho_deg > 0 || polaris.Ho_min > 0)) return;

  const ncp = projectToPixel(solve.ra_h, 90, solve, { clamp: false });
  if (!ncp) return;

  const zx = 0.5, zy = 0.5;
  let dx = ncp.px - zx, dy = ncp.py - zy;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;
  dx /= len; dy /= len;

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

function drawCelestialGrid(svgEl, solve, overlayFlags, fix, utc) {
  const det = Math.abs(solve.cx[0] * solve.cy[1] - solve.cx[1] * solve.cy[0]);
  const fovDeg = det > 1e-10 ? R2D / det : 90;
  const useSmall = fovDeg < 20;
  const raStepH = useSmall ? 0.25 : 1;
  const decStepDeg = useSmall ? 5 : 10;

  if (overlayFlags.radec) {
    for (let rh = 0; rh < 24; rh += raStepH) {
      buildPath(svgEl, solve, function* () { for (let d = -80; d <= 80; d += 1) yield [rh, d]; }, 'rgba(26,158,122,0.35)', '0.8', null);
    }
    for (let dec = -80; dec <= 80; dec += decStepDeg) {
      buildPath(svgEl, solve, function* () { for (let rh = 0; rh <= 24.01; rh += 1 / 60) yield [rh, dec]; }, 'rgba(26,158,122,0.35)', '0.8', null);
    }
  }

  if (overlayFlags.const) {
    for (const [n1, n2] of CONST_LINES) {
      const c1 = CAT[n1], c2 = CAT[n2];
      if (!c1 || !c2) continue;
      const p1 = project(c1[0], c1[1], solve), p2 = project(c2[0], c2[1], solve);
      if (!p1 || !p2) continue;
      const ln = document.createElementNS(NS, 'line');
      ln.setAttribute('x1', p1.x); ln.setAttribute('y1', p1.y);
      ln.setAttribute('x2', p2.x); ln.setAttribute('y2', p2.y);
      ln.setAttribute('stroke', 'rgba(100,130,180,0.45)');
      ln.setAttribute('stroke-width', '1');
      svgEl.appendChild(ln);
    }
  }

  if (overlayFlags.stars) {
    for (const [name, [ra_h, dec_d, mag]] of CAT_ENTRIES) {
      const p = project(ra_h, dec_d, solve);
      if (!p || p.px < 0.05 || p.px > 0.95 || p.py < 0.05 || p.py > 0.95) continue;
      const r = Math.max(2, 5 - 0.8 * mag);
      const color = '#5a7898';
      const circ = document.createElementNS(NS, 'circle');
      circ.setAttribute('cx', p.x); circ.setAttribute('cy', p.y);
      circ.setAttribute('r', r.toFixed(1));
      circ.setAttribute('fill', 'none'); circ.setAttribute('stroke', color);
      circ.setAttribute('stroke-width', '1.2'); circ.setAttribute('opacity', '0.75');
      svgEl.appendChild(circ);
      const txt = document.createElementNS(NS, 'text');
      txt.setAttribute('x', pct(p.px + 0.012)); txt.setAttribute('y', p.y);
      txt.setAttribute('fill', color); txt.setAttribute('font-size', '9');
      txt.setAttribute('font-family', 'sans-serif'); txt.setAttribute('opacity', '0.85');
      txt.setAttribute('dominant-baseline', 'middle');
      txt.textContent = name;
      svgEl.appendChild(txt);
    }
  }

  if (overlayFlags.altaz && fix && utc) {
    for (let alt = 0; alt <= 80; alt += 10) {
      const isBold = alt === 0;
      const stroke = isBold ? 'rgba(192,48,96,0.9)' : 'rgba(192,48,96,0.4)';
      const sw = isBold ? '2' : '1';
      const dash = isBold ? '8 4' : null;
      buildPath(svgEl, solve, function* () {
        for (let az = 0; az <= 362; az += 2) {
          const { ra_h, dec_d } = altazToEquatorial(alt, az % 360, fix.lat, fix.lon, utc);
          yield [ra_h, dec_d];
        }
      }, stroke, sw, dash);
    }
    for (let az = 0; az < 360; az += 30) {
      buildPath(svgEl, solve, function* () {
        for (let alt = 0; alt <= 85; alt += 2) {
          const { ra_h, dec_d } = altazToEquatorial(alt, az, fix.lat, fix.lon, utc);
          yield [ra_h, dec_d];
        }
      }, 'rgba(180,100,40,0.4)', '1', null);
    }
  }
}
