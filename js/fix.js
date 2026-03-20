import { D2R } from './math.js';

export function leastSquaresFix(lops, ap) {
  const n = lops.length;
  if (n < 2) return null;

  // Check angle of cut — find max angular spread between any two LOPs
  let maxSpread = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let diff = Math.abs(lops[i].Zn - lops[j].Zn);
      if (diff > 180) diff = 360 - diff;
      if (diff > maxSpread) maxSpread = diff;
    }
  }
  if (maxSpread < 15) return null;

  // Build A matrix and b vector
  // Each LOP: dN*cos(Zn) + dE*sin(Zn) = intercept
  const A = [], b = [];
  for (const lop of lops) {
    const zr = lop.Zn * D2R;
    A.push([Math.cos(zr), Math.sin(zr)]);
    b.push(lop.intercept_nm);
  }

  // Normal equations: (A^T A)x = A^T b
  let a11 = 0, a12 = 0, a22 = 0, r1 = 0, r2 = 0;
  for (let i = 0; i < n; i++) {
    a11 += A[i][0] * A[i][0];
    a12 += A[i][0] * A[i][1];
    a22 += A[i][1] * A[i][1];
    r1  += A[i][0] * b[i];
    r2  += A[i][1] * b[i];
  }

  const det = a11 * a22 - a12 * a12;
  if (Math.abs(det) < 1e-10) return null;

  const dN = (a22 * r1 - a12 * r2) / det;
  const dE = (a11 * r2 - a12 * r1) / det;

  // Compute residuals
  const residuals = lops.map((lop, i) => {
    return A[i][0] * dN + A[i][1] * dE - b[i];
  });
  const rms = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / n);

  // Convert offsets to lat/lon
  const lat = ap.lat + dN / 60;
  const cosLat = Math.cos(ap.lat * D2R);
  const lon = ap.lon + (cosLat > 1e-6 ? dE / (60 * cosLat) : 0);

  return {
    lat, lon,
    dLat_nm: dN,
    dLon_nm: dE,
    residuals,
    confidence: rms
  };
}
