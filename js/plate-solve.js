import { D2R, R2D, nrm, clamp, solve3x3 } from './math.js';

function tangentProject(stars, ra0_deg, de0_deg) {
  const r0 = ra0_deg * D2R, d0 = de0_deg * D2R;
  return stars.map(s => {
    const ra = s.ra_h * 15 * D2R, de = s.dec_d * D2R;
    const D = Math.sin(d0) * Math.sin(de) + Math.cos(d0) * Math.cos(de) * Math.cos(ra - r0);
    if (Math.abs(D) < 1e-9) return null;
    return {
      xi: Math.cos(de) * Math.sin(ra - r0) / D,
      et: (Math.cos(d0) * Math.sin(de) - Math.sin(d0) * Math.cos(de) * Math.cos(ra - r0)) / D,
      px: s.px - 0.5,
      py: -(s.py - 0.5)
    };
  }).filter(Boolean);
}

/** Similarity transform for exactly 2 stars: scale + rotation + translation */
function similaritySolve2(pts) {
  // pts has exactly 2 entries with {xi, et, px, py}
  // Solve: px = a*xi - b*et + tx, py = b*xi + a*et + ty  (4 unknowns, 4 eqns)
  const [p0, p1] = pts;
  const dxi = p1.xi - p0.xi, det = p1.et - p0.et;
  const dpx = p1.px - p0.px, dpy = p1.py - p0.py;
  const denom = dxi * dxi + det * det;
  if (denom < 1e-18) return null;
  const a = (dpx * dxi + dpy * det) / denom;
  const b = (dpy * dxi - dpx * det) / denom;
  const tx = p0.px - a * p0.xi + b * p0.et;
  const ty = p0.py - b * p0.xi - a * p0.et;
  // Map to cx/cy format: cx = [a, -b, tx], cy = [b, a, ty]
  return { cx: [a, -b, tx], cy: [b, a, ty] };
}

export function plateSolve(stars) {
  if (stars.length < 2) return null;
  let ra0 = stars.reduce((s, x) => s + x.ra_h * 15, 0) / stars.length;
  let de0 = stars.reduce((s, x) => s + x.dec_d, 0) / stars.length;
  let lastCx = null, lastCy = null, lastRa0 = ra0, lastDe0 = de0;

  for (let iter = 0; iter < 10; iter++) {
    const pts = tangentProject(stars, ra0, de0);
    if (pts.length < 2) break;

    let cx, cy;
    if (pts.length === 2) {
      // 2 stars: similarity transform (scale + rotation + translation)
      const sim = similaritySolve2(pts);
      if (!sim) break;
      cx = sim.cx; cy = sim.cy;
    } else {
      // 3+ stars: full affine transform via least squares
      let Sxx = 0, Sxy = 0, Syy = 0, Sx = 0, Sy = 0, n = pts.length;
      let SxPx = 0, SyPx = 0, SPx = 0, SxPy = 0, SyPy = 0, SPy = 0;
      for (const p of pts) {
        Sxx += p.xi * p.xi; Sxy += p.xi * p.et; Syy += p.et * p.et;
        Sx += p.xi; Sy += p.et;
        SxPx += p.xi * p.px; SyPx += p.et * p.px; SPx += p.px;
        SxPy += p.xi * p.py; SyPy += p.et * p.py; SPy += p.py;
      }
      const mat = [Sxx, Sxy, Sx, Sxy, Syy, Sy, Sx, Sy, n];
      cx = solve3x3(mat, [SxPx, SyPx, SPx]);
      cy = solve3x3(mat, [SxPy, SyPy, SPy]);
      if (!cx || !cy) break;
    }

    lastCx = cx; lastCy = cy; lastRa0 = ra0; lastDe0 = de0;
    const det2 = cx[0] * cy[1] - cx[1] * cy[0];
    if (Math.abs(det2) < 1e-12) break;
    const xi_c = (-cx[2] * cy[1] + cx[1] * cy[2]) / det2;
    const et_c = (-cx[0] * cy[2] + cy[0] * cx[2]) / det2;
    const rho = Math.sqrt(xi_c * xi_c + et_c * et_c);
    if (rho < 1e-10) break;
    const c = Math.atan(rho);
    const d0 = de0 * D2R;
    de0 = R2D * Math.asin(clamp(Math.cos(c) * Math.sin(d0) + et_c * Math.sin(c) * Math.cos(d0) / rho, -1, 1));
    ra0 = ra0 + R2D * Math.atan2(xi_c * Math.sin(c), rho * Math.cos(d0) * Math.cos(c) - et_c * Math.sin(d0) * Math.sin(c));
  }

  if (!lastCx || !lastCy) return null;

  // Compute RMS residual
  const solve = { ra_h: nrm(ra0) / 15, dec_d: de0, cx: lastCx, cy: lastCy, ra0_deg: lastRa0, dec0_deg: lastDe0 };
  const residuals = stars.map(s => {
    const p = projectToPixel(s.ra_h, s.dec_d, solve);
    if (!p) return null;
    return Math.hypot(p.px - s.px, p.py - s.py);
  }).filter(r => r != null);
  solve.rmsResidual = residuals.length > 0
    ? Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length)
    : null;

  return solve;
}

export function projectToPixel(ra_h, dec_d, solve, { clamp = true } = {}) {
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
  if (clamp && (px < 0 || px > 1 || py < 0 || py > 1)) return null;
  return { px, py };
}

export function manualSolve(ra_h, dec_d, fovDeg, rotDeg, offsetPx, offsetPy) {
  const halfFovRad = Math.max(fovDeg, 1) / 2 * D2R;
  const s = 0.5 / Math.tan(halfFovRad);
  const theta = (rotDeg || 0) * D2R;
  const ox = offsetPx || 0, oy = offsetPy || 0;
  // Negate xi (East) axis so RA increases leftward — correct star chart orientation
  return {
    ra_h, dec_d,
    cx: [-s * Math.cos(theta), s * Math.sin(theta), ox],
    cy: [ s * Math.sin(theta), s * Math.cos(theta), oy],
    ra0_deg: ra_h * 15,
    dec0_deg: dec_d,
    rmsResidual: null,
    manual: true
  };
}

export function pixelToSky(px_in, py_in, solve) {
  if (!solve || !solve.cx || !solve.cy) return null;
  // Invert: px - 0.5 = cx[0]*xi + cx[1]*et + cx[2]
  //        -(py - 0.5) = cy[0]*xi + cy[1]*et + cy[2]
  const bx = (px_in - 0.5) - solve.cx[2];
  const by = -(py_in - 0.5) - solve.cy[2];
  const det = solve.cx[0] * solve.cy[1] - solve.cx[1] * solve.cy[0];
  if (Math.abs(det) < 1e-12) return null;
  const xi = (bx * solve.cy[1] - solve.cx[1] * by) / det;
  const et = (solve.cx[0] * by - bx * solve.cy[0]) / det;

  const d0 = solve.dec0_deg * D2R;
  const r0 = solve.ra0_deg;
  const rho = Math.sqrt(xi * xi + et * et);
  if (rho < 1e-12) return { ra_h: nrm(r0) / 15, dec_d: solve.dec0_deg };
  const c = Math.atan(rho);
  const dec_d = R2D * Math.asin(clamp(Math.cos(c) * Math.sin(d0) + et * Math.sin(c) * Math.cos(d0) / rho, -1, 1));
  const ra_h = nrm(r0 + R2D * Math.atan2(xi * Math.sin(c), rho * Math.cos(d0) * Math.cos(c) - et * Math.sin(d0) * Math.sin(c))) / 15;
  return { ra_h, dec_d };
}
