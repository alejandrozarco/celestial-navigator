import { angSep } from './math.js';
import { CAT, CAT_ENTRIES, CAT_BY_MAG } from './catalog.js';

const TOL = 0.025;

export function buildCatalogHash(nStars = 40) {
  const entries = CAT_BY_MAG.slice(0, nStars);
  const hash = [];
  const n = entries.length;
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        const [na, [ra_a, dec_a]] = entries[i];
        const [nb, [ra_b, dec_b]] = entries[j];
        const [nc, [ra_c, dec_c]] = entries[k];
        const edges = [
          { d: angSep(ra_a, dec_a, ra_b, dec_b), u: na, v: nb, opp: nc },
          { d: angSep(ra_b, dec_b, ra_c, dec_c), u: nb, v: nc, opp: na },
          { d: angSep(ra_c, dec_c, ra_a, dec_a), u: nc, v: na, opp: nb }
        ].sort((a, b) => a.d - b.d);
        const r1 = edges[0].d / edges[2].d;
        const r2 = edges[1].d / edges[2].d;
        hash.push({ r1, r2, apex: edges[2].opp, far1: edges[2].u, far2: edges[2].v });
      }
    }
  }
  hash.sort((a, b) => a.r1 - b.r1);
  return hash;
}

function hashLookup(hash, r1, r2, tol) {
  let lo = 0, hi = hash.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (hash[m].r1 < r1 - tol) lo = m + 1; else hi = m;
  }
  const out = [];
  for (let i = lo; i < hash.length && hash[i].r1 <= r1 + tol; i++) {
    if (Math.abs(hash[i].r2 - r2) <= tol) out.push(hash[i]);
  }
  return out;
}

export function verifyAssignments(assignments, detections, ar = 1) {
  if (assignments.length < 2) return assignments;

  const ref0 = assignments[0], ref1 = assignments[1];
  const det0 = detections.find(d => d.id === ref0.candId);
  const det1 = detections.find(d => d.id === ref1.candId);
  if (!det0 || !det1) return assignments;

  const cat0 = CAT[ref0.star], cat1 = CAT[ref1.star];
  if (!cat0 || !cat1) return assignments;

  // Pixel vector ref0→ref1
  const dpxX = (det1.px - det0.px) * ar;
  const dpxY = det1.py - det0.py;
  const dpxLen = Math.hypot(dpxX, dpxY);
  if (dpxLen < 0.001) return assignments;

  // Sky vector ref0→ref1 (degrees, small-angle with cos(dec) correction)
  const avgDec = (cat0[1] + cat1[1]) / 2;
  const cosDec = Math.cos(avgDec * Math.PI / 180);
  const dSkyX = (cat1[0] - cat0[0]) * 15 * cosDec;
  const dSkyY = cat1[1] - cat0[1];
  const dSkyLen = Math.hypot(dSkyX, dSkyY);
  if (dSkyLen < 0.001) return assignments;

  // Scale (normalized-px per degree) and rotation from sky→pixel frame
  const scale = dpxLen / dSkyLen;
  const ux = dpxX / dpxLen, uy = dpxY / dpxLen;
  const sx = dSkyX / dSkyLen, sy = dSkyY / dSkyLen;
  const cosA = ux * sx + uy * sy;
  const sinA = uy * sx - ux * sy;

  const THRESHOLD = 0.015;

  return assignments.filter((a, idx) => {
    if (idx < 2) return true;
    const det = detections.find(d => d.id === a.candId);
    const cat = CAT[a.star];
    if (!det || !cat) return false;

    const oSkyX = (cat[0] - cat0[0]) * 15 * cosDec;
    const oSkyY = cat[1] - cat0[1];

    const expPxX = scale * (oSkyX * cosA - oSkyY * sinA);
    const expPxY = scale * (oSkyX * sinA + oSkyY * cosA);

    const actPxX = (det.px - det0.px) * ar;
    const actPxY = det.py - det0.py;

    return Math.hypot(expPxX - actPxX, expPxY - actPxY) < THRESHOLD;
  });
}

/**
 * Run triangle pattern matching on detections against the catalog hash.
 * @param {Array} detections - [{id, px, py, v}] — top candidates (≥3)
 * @param {Array} catalogHash - result of buildCatalogHash()
 * @param {number} [tol] - hash tolerance (default 0.045)
 * @param {number} [ar] - image aspect ratio (width/height, default 1). Corrects pixel
 *   distances for non-square images so triangle ratios match the sky catalog.
 * @returns {Array} assignments [{candId, star, score}] sorted by score desc
 */
export function runAutoID(detections, catalogHash, tol = TOL, ar = 1) {
  const topN = [...detections].sort((a, b) => b.v - a.v).slice(0, 12);
  if (topN.length < 3) return [];

  const votes = {};
  topN.forEach(c => { votes[c.id] = {}; });

  const n = topN.length;
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        const ci = topN[i], cj = topN[j], ck = topN[k];
        const edges = [
          { d: Math.hypot((ci.px - cj.px) * ar, ci.py - cj.py), u: ci, v: cj, opp: ck },
          { d: Math.hypot((cj.px - ck.px) * ar, cj.py - ck.py), u: cj, v: ck, opp: ci },
          { d: Math.hypot((ck.px - ci.px) * ar, ck.py - ci.py), u: ck, v: ci, opp: cj }
        ].sort((a, b) => a.d - b.d);
        if (edges[2].d < 0.001) continue;
        const r1 = edges[0].d / edges[2].d;
        const r2 = edges[1].d / edges[2].d;
        const apex = edges[2].opp, far1 = edges[2].u, far2 = edges[2].v;

        const matches = hashLookup(catalogHash, r1, r2, tol);
        for (const m of matches) {
          votes[apex.id][m.apex] = (votes[apex.id][m.apex] || 0) + 1;
          votes[far1.id][m.far1] = (votes[far1.id][m.far1] || 0) + 1;
          votes[far2.id][m.far2] = (votes[far2.id][m.far2] || 0) + 1;
          votes[far1.id][m.far2] = (votes[far1.id][m.far2] || 0) + 0.5;
          votes[far2.id][m.far1] = (votes[far2.id][m.far1] || 0) + 0.5;
        }
      }
    }
  }

  const assignments = [];
  for (const [cidStr, starVotes] of Object.entries(votes)) {
    const candId = parseInt(cidStr);
    const best = Object.entries(starVotes).sort((a, b) => b[1] - a[1]);
    if (best.length && best[0][1] >= 4) {
      assignments.push({ candId, star: best[0][0], score: best[0][1] });
    }
  }

  // Deduplicate: each star and each candidate can only appear once
  assignments.sort((a, b) => b.score - a.score);
  const usedStars = new Set(), usedCands = new Set();
  const result = [];
  for (const a of assignments) {
    if (usedStars.has(a.star) || usedCands.has(a.candId)) continue;
    if (!CAT[a.star]) continue;
    usedStars.add(a.star);
    usedCands.add(a.candId);
    result.push(a);
  }
  return verifyAssignments(result, topN, ar);
}
