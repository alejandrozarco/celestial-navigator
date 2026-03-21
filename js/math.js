export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;
export const nrm = a => ((a % 360) + 360) % 360;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function gmst(date) {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T = (JD - 2451545.0) / 36525;
  return nrm(280.46061837 + 360.98564736629 * (JD - 2451545.0)
    + 0.000387933 * T * T - T * T * T / 38710000);
}

export function zenithFix(ra_h, dec_d, date) {
  let lon = nrm(ra_h * 15) - gmst(date);
  lon = ((lon + 180) % 360 + 360) % 360 - 180;
  return { lat: dec_d, lon };
}

export function solve3x3(M, b) {
  const d = M[0]*(M[4]*M[8]-M[5]*M[7]) - M[1]*(M[3]*M[8]-M[5]*M[6]) + M[2]*(M[3]*M[7]-M[4]*M[6]);
  if (Math.abs(d) < 1e-14) return null;
  return [
    (b[0]*(M[4]*M[8]-M[5]*M[7]) - M[1]*(b[1]*M[8]-M[5]*b[2]) + M[2]*(b[1]*M[7]-M[4]*b[2])) / d,
    (M[0]*(b[1]*M[8]-M[5]*b[2]) - b[0]*(M[3]*M[8]-M[5]*M[6]) + M[2]*(M[3]*b[2]-b[1]*M[6])) / d,
    (M[0]*(M[4]*b[2]-b[1]*M[7]) - M[1]*(M[3]*b[2]-b[1]*M[6]) + b[0]*(M[3]*M[7]-M[4]*M[6])) / d
  ];
}

/**
 * Compute observer position from the horizon in a plate-solved image.
 *
 * The horizon is a great circle at alt=0°. Its pole is the zenith.
 * Given ≥2 sky-coordinate points known to lie on the horizon (from pixelToSky
 * along a level horizon line), the zenith is the unit-sphere cross-product of
 * two spread-out horizon vectors. Combined with UTC, that gives lat/lon.
 *
 * @param {Array<{ra_h, dec_d}>} horizonPoints  ≥2 sky coords on the horizon
 * @param {{ra_h, dec_d}}        abovePoint      a sky coord known to be ABOVE
 *                                                the horizon (used to pick the
 *                                                correct pole — zenith vs nadir)
 * @param {Date} utc
 * @returns {{lat, lon}|null}
 */
export function horizonFix(horizonPoints, abovePoint, utc) {
  if (!horizonPoints || horizonPoints.length < 2) return null;

  // Convert to unit vectors on the celestial sphere
  const vec = p => {
    const ra = p.ra_h * 15 * D2R, d = p.dec_d * D2R;
    return [Math.cos(d) * Math.cos(ra), Math.cos(d) * Math.sin(ra), Math.sin(d)];
  };

  const vecs = horizonPoints.map(vec);

  // Zenith = pole of the horizon great circle = cross-product of two horizon vecs.
  // Use the most widely separated pair for numerical stability.
  const v1 = vecs[0], v2 = vecs[vecs.length - 1];
  let zx = v1[1]*v2[2] - v1[2]*v2[1];
  let zy = v1[2]*v2[0] - v1[0]*v2[2];
  let zz = v1[0]*v2[1] - v1[1]*v2[0];
  const mag = Math.sqrt(zx*zx + zy*zy + zz*zz);
  if (mag < 1e-9) return null;
  zx /= mag; zy /= mag; zz /= mag;

  // Pick the pole that is on the same side as the sky (above the horizon).
  if (abovePoint) {
    const av = vec(abovePoint);
    if (zx*av[0] + zy*av[1] + zz*av[2] < 0) { zx = -zx; zy = -zy; zz = -zz; }
  }

  const lat     = R2D * Math.asin(clamp(zz, -1, 1));
  const lmst    = R2D * Math.atan2(zy, zx);
  const gst_deg = gmst(utc instanceof Date ? utc : new Date(utc));
  const lon     = ((lmst - gst_deg) % 360 + 540) % 360 - 180;   // → -180..180

  return { lat, lon };
}

export function angSep(ra1_h, dec1_d, ra2_h, dec2_d) {
  const ra1 = ra1_h * 15 * D2R, d1 = dec1_d * D2R;
  const ra2 = ra2_h * 15 * D2R, d2 = dec2_d * D2R;
  return R2D * Math.acos(clamp(
    Math.sin(d1)*Math.sin(d2) + Math.cos(d1)*Math.cos(d2)*Math.cos(ra1-ra2), -1, 1));
}
