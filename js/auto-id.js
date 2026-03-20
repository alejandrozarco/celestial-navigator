import { angSep } from './math.js';
import { CAT, CAT_ENTRIES } from './catalog.js';

const TOL = 0.045;

export function buildCatalogHash() {
  const hash = [];
  const n = CAT_ENTRIES.length;
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        const [na, [ra_a, dec_a]] = CAT_ENTRIES[i];
        const [nb, [ra_b, dec_b]] = CAT_ENTRIES[j];
        const [nc, [ra_c, dec_c]] = CAT_ENTRIES[k];
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

/**
 * Run triangle pattern matching on detections against the catalog hash.
 * @param {Array} detections - [{id, px, py, v}] — top candidates (≥3)
 * @param {Array} catalogHash - result of buildCatalogHash()
 * @param {number} [tol] - hash tolerance (default 0.045)
 * @returns {Array} assignments [{candId, star, score}] sorted by score desc
 */
export function runAutoID(detections, catalogHash, tol = TOL) {
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
          { d: Math.hypot(ci.px - cj.px, ci.py - cj.py), u: ci, v: cj, opp: ck },
          { d: Math.hypot(cj.px - ck.px, cj.py - ck.py), u: cj, v: ck, opp: ci },
          { d: Math.hypot(ck.px - ci.px, ck.py - ci.py), u: ck, v: ci, opp: cj }
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
  return result;
}
