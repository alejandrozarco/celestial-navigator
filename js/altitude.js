import { D2R, R2D, nrm, clamp, gmst } from './math.js';
import { CAT_ENTRIES } from './catalog.js';

export function equatorialToAltAz(ra_h, dec_d, lat_d, lon_d, date) {
  const LMST = nrm(gmst(date) + lon_d);
  const HA = (LMST - ra_h * 15) * D2R;
  const dec = dec_d * D2R, lat = lat_d * D2R;
  const sinAlt = Math.sin(dec)*Math.sin(lat) + Math.cos(dec)*Math.cos(lat)*Math.cos(HA);
  const alt_d = R2D * Math.asin(clamp(sinAlt, -1, 1));
  const az_r = Math.atan2(Math.sin(HA), Math.cos(HA)*Math.sin(lat) - Math.tan(dec)*Math.cos(lat));
  return { alt_d, az_d: nrm(R2D * az_r + 180) };
}

export function visibleStars(ap, utc) {
  return CAT_ENTRIES
    .map(([name, [ra_h, dec_d, mag]]) => {
      const { alt_d, az_d } = equatorialToAltAz(ra_h, dec_d, ap.lat, ap.lon, utc);
      return { name, ra: ra_h * 15, dec: dec_d, mag, alt: alt_d, az: az_d };
    })
    .filter(s => s.alt > 0)
    .sort((a, b) => b.alt - a.alt);
}
