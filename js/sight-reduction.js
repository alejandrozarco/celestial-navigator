import { D2R, R2D, nrm, clamp, gmst } from './math.js';

export function gha(utc, ra_deg) {
  const gmst_deg = gmst(utc);
  return nrm(gmst_deg - ra_deg);
}

export function lha(gha_deg, ap_lon) {
  return nrm(gha_deg + ap_lon);
}

export function calcHcZn(ap_lat, ap_lon, dec, gha_deg) {
  const lat = ap_lat * D2R;
  const d = dec * D2R;
  const LHA = lha(gha_deg, ap_lon) * D2R;
  const sinHc = Math.sin(lat)*Math.sin(d) + Math.cos(lat)*Math.cos(d)*Math.cos(LHA);
  const Hc_deg = R2D * Math.asin(clamp(sinHc, -1, 1));
  const Z = Math.atan2(
    -Math.cos(d) * Math.sin(LHA),
    Math.sin(d) * Math.cos(lat) - Math.cos(d) * Math.cos(LHA) * Math.sin(lat)
  );
  return { Hc_deg, Zn_deg: nrm(R2D * Z) };
}

export function magToTrue(magBearing, magDecl) {
  return nrm(magBearing + magDecl);
}

export function sightReduce(star, Ho_deg, utc, ap, magDecl, magBearing) {
  const gha_deg = gha(utc, star.ra);
  const { Hc_deg, Zn_deg } = calcHcZn(ap.lat, ap.lon, star.dec, gha_deg);
  const intercept_nm = (Ho_deg - Hc_deg) * 60;
  return {
    intercept_nm,
    Zn: Zn_deg,
    Hc: Hc_deg,
    Ho: Ho_deg,
    starName: star.name,
    trueBearing: magBearing != null ? magToTrue(magBearing, magDecl) : null
  };
}
