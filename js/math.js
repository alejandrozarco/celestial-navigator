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

export function angSep(ra1_h, dec1_d, ra2_h, dec2_d) {
  const ra1 = ra1_h * 15 * D2R, d1 = dec1_d * D2R;
  const ra2 = ra2_h * 15 * D2R, d2 = dec2_d * D2R;
  return R2D * Math.acos(clamp(
    Math.sin(d1)*Math.sin(d2) + Math.cos(d1)*Math.cos(d2)*Math.cos(ra1-ra2), -1, 1));
}
