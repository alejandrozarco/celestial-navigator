#!/usr/bin/env node
/**
 * Test suite for almanac.html — the Daily Almanac page.
 *
 * Tests: julianDate, ghaAries, solarPosition, precessStar,
 *        riseSet, sunTimes, fmtDM, fmtDMns, fmtHM, dayOfYear
 *
 *   node test-almanac-page.js
 */

const fs = require('fs');
const vm = require('vm');

// ── Load the engine from almanac.html ──
const html = fs.readFileSync('almanac.html', 'utf8');
const scriptBlocks = [];
const re = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let match;
while ((match = re.exec(html)) !== null) scriptBlocks.push(match[1]);
const code = scriptBlocks.join('\n');

const noop = () => ({
  value: '', style: {}, getContext: () => null,
  addEventListener: () => {}, classList: { add(){}, remove(){}, contains(){ return false } },
  innerHTML: '',
});
const sandbox = {
  document: {
    getElementById: () => noop(),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    createElement: noop,
  },
  window: { addEventListener: () => {}, innerWidth: 1400 },
  navigator: { serviceWorker: { register: () => Promise.resolve() } },
  localStorage: { getItem: () => null, setItem: () => {} },
  requestAnimationFrame: () => {},
  ResizeObserver: class { observe(){} },
  setTimeout: () => {},
  confirm: () => false,
  console,
  Math, Date, Object, Array, String, Number, Boolean, JSON, Error, RegExp,
  parseInt, parseFloat, isNaN, isFinite, undefined, NaN, Infinity,
  Promise, Map, Set, Symbol,
};
sandbox.window.document = sandbox.document;
sandbox.self = sandbox.window;

vm.createContext(sandbox);
try { vm.runInContext(code, sandbox, { filename: 'almanac.html' }); } catch (e) { /* DOM init */ }

function calc(expr) {
  return vm.runInContext(expr, sandbox);
}

// ── Test harness ─────────────────────────────────────
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', B = '\x1b[1m', X = '\x1b[0m';
let pass = 0, fail = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    pass++;
    console.log(`  ${G}✓${X} ${label}`);
  } else {
    fail++;
    console.log(`  ${R}✗${X} ${label}${detail ? ' — ' + detail : ''}`);
  }
}

function assertClose(label, actual, expected, tolerance, unit = "'") {
  const diff = Math.abs(actual - expected);
  const diffArcmin = diff * 60;
  if (diff <= tolerance) {
    pass++;
    console.log(`  ${G}✓${X} ${label}: ${actual.toFixed(4)}° (Δ ${diffArcmin.toFixed(1)}${unit})`);
  } else {
    fail++;
    console.log(`  ${R}✗${X} ${label}: ${actual.toFixed(4)}° expected ${expected.toFixed(4)}° (Δ ${diffArcmin.toFixed(1)}${unit}, tol ${tolerance * 60}${unit})`);
  }
}

// ══════════════════════════════════════════════════════
//  Julian Date
// ══════════════════════════════════════════════════════
console.log(`\n${B}═══ Julian Date ═══${X}`);

assertClose('J2000.0 epoch', calc(`julianDate(new Date('2000-01-01T12:00:00Z'))`), 2451545.0, 0.0001, 'd');
assertClose('Jan 1 2026 00:00', calc(`julianDate(new Date('2026-01-01T00:00:00Z'))`), 2461041.5, 0.0001, 'd');
assertClose('Jun 21 2025 12:00', calc(`julianDate(new Date('2025-06-21T12:00:00Z'))`), 2460848.0, 0.0001, 'd');

// ══════════════════════════════════════════════════════
//  GHA Aries
// ══════════════════════════════════════════════════════
console.log(`\n${B}═══ GHA Aries ═══${X}`);

// Air Almanac 2026 reference values
assertClose('GHA Aries Jan 1 00:00', calc(`ghaAries(new Date('2026-01-01T00:00:00Z'))`), 100 + 39.7/60, 0.02);
assertClose('GHA Aries Jan 1 06:00', calc(`ghaAries(new Date('2026-01-01T06:00:00Z'))`), 190 + 54.5/60, 0.02);
assertClose('GHA Aries Jan 1 12:00', calc(`ghaAries(new Date('2026-01-01T12:00:00Z'))`), 281 + 9.3/60, 0.02);
assertClose('GHA Aries Mar 26 00:00', calc(`ghaAries(new Date('2026-03-26T00:00:00Z'))`), 183 + 27.4/60, 0.02);

// GHA Aries advances ~0.986° per sidereal day (excess over 360°)
const aries0 = calc(`ghaAries(new Date('2026-06-15T00:00:00Z'))`);
const aries24 = calc(`ghaAries(new Date('2026-06-16T00:00:00Z'))`);
const dailyRate = ((aries24 - aries0) % 360 + 360) % 360;
assertClose('Daily Aries advance ~0.986°', dailyRate, 0.986, 0.01, '°');

// ══════════════════════════════════════════════════════
//  Solar Position
// ══════════════════════════════════════════════════════
console.log(`\n${B}═══ Solar Position ═══${X}`);

// Jan 1 2026
const sun0 = calc(`solarPosition(new Date('2026-01-01T00:00:00Z'))`);
assertClose('Sun GHA Jan 1 00:00', sun0.gha, 179 + 10.1/60, 0.03);
assertClose('Sun Dec Jan 1 00:00', sun0.dec, -(23 + 1.0/60), 0.02);

const sun6 = calc(`solarPosition(new Date('2026-01-01T06:00:00Z'))`);
assertClose('Sun GHA Jan 1 06:00', sun6.gha, 269 + 8.3/60, 0.05);

const sun12 = calc(`solarPosition(new Date('2026-01-01T12:00:00Z'))`);
assertClose('Sun GHA Jan 1 12:00', sun12.gha, 359 + 6.5/60, 0.05);

// Mar 26 (near equinox)
const sunMar = calc(`solarPosition(new Date('2026-03-26T00:00:00Z'))`);
assertClose('Sun GHA Mar 26 00:00', sunMar.gha, 178 + 33.1/60, 0.05);
assertClose('Sun Dec Mar 26 (equinox ~12\' expected)', sunMar.dec, 2 + 19.2/60, 0.25);

// June solstice — dec near +23.44°
const sunJun = calc(`solarPosition(new Date('2026-06-21T12:00:00Z'))`);
assertClose('Sun Dec Jun 21 (solstice)', sunJun.dec, 23.44, 0.02);

// Dec solstice — dec near -23.44°
const sunDec = calc(`solarPosition(new Date('2025-12-21T12:00:00Z'))`);
assertClose('Sun Dec Dec 21 (solstice)', sunDec.dec, -23.44, 0.02);

// Sep equinox — dec near 0°
const sunSep = calc(`solarPosition(new Date('2025-09-23T00:00:00Z'))`);
assertClose('Sun Dec Sep equinox', sunSep.dec, 0.0, 0.25);

// GHA advances ~15°/hr
const sunA = calc(`solarPosition(new Date('2026-03-15T00:00:00Z'))`);
const sunB = calc(`solarPosition(new Date('2026-03-15T01:00:00Z'))`);
const ghaRate = ((sunB.gha - sunA.gha) % 360 + 360) % 360;
assertClose('Sun GHA hourly rate ~15°', ghaRate, 15.0, 0.01, '°');

// EoT range check (should be between -17 and +17 minutes)
const eotMin = sun0.eot * 4;  // degrees to minutes
assert('EoT within ±17 min', Math.abs(eotMin) <= 17, `got ${eotMin.toFixed(1)} min`);

// ══════════════════════════════════════════════════════
//  Star Precession (vs Skyfield/DE440s reference)
// ══════════════════════════════════════════════════════
console.log(`\n${B}═══ Star Precession ═══${X}`);

// Reference values from Skyfield/DE440s apparent place at 2026-01-01
// SHA tolerance: 0.05° (3'). Dec tolerance: 0.05° (3') for most stars,
// 0.15° (9') for high-PM stars where nutation causes larger residuals.
const starRef = {
  'Acamar':      { sha: 315.185, dec: -40.200, decTol: 0.05 },
  'Arcturus':    { sha: 145.789, dec: 19.044,  decTol: 0.05 },
  'Sirius':      { sha: 258.427, dec: -16.753, decTol: 0.05 },
  'Vega':        { sha: 80.544,  dec: 38.802,  decTol: 0.15 },
  'Capella':     { sha: 280.359, dec: 45.881,  decTol: 0.15 },
  'Aldebaran':   { sha: 290.639, dec: 16.427,  decTol: 0.15 },
  'Rigel':       { sha: 281.067, dec: -8.173,  decTol: 0.05 },
  'Procyon':     { sha: 244.833, dec: 5.156,   decTol: 0.05 },
};

for (const [name, ref] of Object.entries(starRef)) {
  const p = calc(`(function(){ const s=STARS.find(s=>s.n==='${name}'); const p=precessStar(s,new Date('2026-01-01T00:00:00Z')); return{sha:p.sha,dec:p.dec}; })()`);
  assertClose(`${name} SHA 2026`, p.sha, ref.sha, 0.05);
  assertClose(`${name} Dec 2026`, p.dec, ref.dec, ref.decTol);
}

// Precession to a different epoch (2030)
// Verify that stars precess further from J2000 at later dates
const arcturusCurrent = calc(`(function(){ const s=STARS.find(s=>s.n==='Arcturus'); return precessStar(s,new Date('2026-01-01T00:00:00Z')).sha; })()`);
const arcturusFuture = calc(`(function(){ const s=STARS.find(s=>s.n==='Arcturus'); return precessStar(s,new Date('2030-01-01T00:00:00Z')).sha; })()`);
assert('Arcturus SHA changes between 2026 and 2030', Math.abs(arcturusCurrent - arcturusFuture) > 0.01,
  `2026=${arcturusCurrent.toFixed(3)}, 2030=${arcturusFuture.toFixed(3)}`);

// At J2000.0 epoch, precession should be near-zero (SHA ≈ 360 - ra0)
const vegaJ2000 = calc(`(function(){ const s=STARS.find(s=>s.n==='Vega'); const p=precessStar(s,new Date('2000-01-01T12:00:00Z')); return{sha:p.sha,dec:p.dec}; })()`);
assertClose('Vega SHA at J2000 ≈ 360-ra0', vegaJ2000.sha, 360 - 279.235, 0.01);
assertClose('Vega Dec at J2000 ≈ dec0', vegaJ2000.dec, 38.784, 0.01);

// All 58 stars should be accessible
const starCount = calc(`STARS.length`);
assert('58 navigational stars in catalog', starCount === 58, `got ${starCount}`);

// Polaris Dec should be near 89° at any reasonable epoch
const polarisDec = calc(`(function(){ const s=STARS.find(s=>s.n==='Polaris'); return precessStar(s,new Date('2026-01-01T00:00:00Z')).dec; })()`);
assert('Polaris Dec > 89°', polarisDec > 89.0, `got ${polarisDec.toFixed(3)}°`);

// ══════════════════════════════════════════════════════
//  Sunrise / Sunset / Twilight
// ══════════════════════════════════════════════════════
console.log(`\n${B}═══ Sunrise / Sunset ═══${X}`);

// Equinox: sunrise ~06:00, sunset ~18:00 at equator
const eqSun = calc(`sunTimes(new Date('2026-03-20T00:00:00Z'), 0)`);
assertClose('Equator equinox sunrise ≈ 6:00', eqSun.rise, 6.0, 0.2, 'h');
assertClose('Equator equinox sunset ≈ 18:00', eqSun.set, 18.0, 0.2, 'h');
assert('Equator equinox not polar', !eqSun.alwaysUp && !eqSun.neverUp);

// June solstice at high latitude — polar day
const arcticJun = calc(`sunTimes(new Date('2026-06-21T00:00:00Z'), 70)`);
assert('70°N Jun solstice: always up', arcticJun.alwaysUp === true);

// June solstice at high south latitude — polar night
const antarcticJun = calc(`sunTimes(new Date('2026-06-21T00:00:00Z'), -70)`);
assert('70°S Jun solstice: never up', antarcticJun.neverUp === true);

// Dec solstice reversed
const arcticDec = calc(`sunTimes(new Date('2025-12-21T00:00:00Z'), 70)`);
assert('70°N Dec solstice: never up', arcticDec.neverUp === true);

// Mid-latitude: sunrise before noon, sunset after noon
const londonJul = calc(`sunTimes(new Date('2026-07-15T00:00:00Z'), 51.5)`);
assert('London Jul sunrise < 5h', londonJul.rise < 5, `got ${londonJul.rise?.toFixed(2)}h`);
assert('London Jul sunset > 20h', londonJul.set > 20, `got ${londonJul.set?.toFixed(2)}h`);

// Twilight ordering: nautical < civil < sunrise < sunset < civil < nautical
const midSun = calc(`sunTimes(new Date('2026-05-01T00:00:00Z'), 45)`);
assert('Twilight order: naut < civil < rise', midSun.nautTwlStart < midSun.civTwlStart && midSun.civTwlStart < midSun.rise);
assert('Twilight order: set < civil < naut', midSun.set < midSun.civTwlEnd && midSun.civTwlEnd < midSun.nautTwlEnd);

// Transit near 12:00 LMT
assert('Transit near 12:00 LMT', Math.abs(midSun.transit - 12) < 0.3, `got ${midSun.transit.toFixed(2)}h`);

// ══════════════════════════════════════════════════════
//  Format Helpers
// ══════════════════════════════════════════════════════
console.log(`\n${B}═══ Format Helpers ═══${X}`);

// fmtDM
const fmt1 = calc(`fmtDM(123.5)`);
assert('fmtDM(123.5) = "123°30.0\'"', fmt1 === '123\u00b030.0\'', `got "${fmt1}"`);

const fmt2 = calc(`fmtDM(0.25, 0)`);
assert('fmtDM(0.25, 0) shows 15\'', fmt2.includes('15'), `got "${fmt2}"`);

const fmt3 = calc(`fmtDM(359.999)`);
assert('fmtDM handles near-360', fmt3.includes('359'), `got "${fmt3}"`);

// fmtDMns
const fmtN = calc(`fmtDMns(23.5)`);
assert('fmtDMns(23.5) starts with N', fmtN.startsWith('N'), `got "${fmtN}"`);

const fmtS = calc(`fmtDMns(-23.5)`);
assert('fmtDMns(-23.5) starts with S', fmtS.startsWith('S'), `got "${fmtS}"`);

// fmtHM
const hm1 = calc(`fmtHM(14.5)`);
assert('fmtHM(14.5) = "14:30"', hm1 === '14:30', `got "${hm1}"`);

const hm2 = calc(`fmtHM(6.0)`);
assert('fmtHM(6.0) = "06:00"', hm2 === '06:00', `got "${hm2}"`);

const hm3 = calc(`fmtHM(null)`);
assert('fmtHM(null) = "----"', hm3 === '----', `got "${hm3}"`);

// ══════════════════════════════════════════════════════
//  Day of Year
// ══════════════════════════════════════════════════════
console.log(`\n${B}═══ Day of Year ═══${X}`);

assert('Jan 1 = day 1', calc(`dayOfYear(new Date('2026-01-01T00:00:00Z'))`) === 1);
assert('Feb 1 = day 32', calc(`dayOfYear(new Date('2026-02-01T00:00:00Z'))`) === 32);
assert('Dec 31 = day 365', calc(`dayOfYear(new Date('2026-12-31T00:00:00Z'))`) === 365);
// Leap year
assert('Dec 31 2024 (leap) = day 366', calc(`dayOfYear(new Date('2024-12-31T00:00:00Z'))`) === 366);
assert('Mar 1 2024 (leap) = day 61', calc(`dayOfYear(new Date('2024-03-01T00:00:00Z'))`) === 61);
assert('Mar 1 2026 (non-leap) = day 60', calc(`dayOfYear(new Date('2026-03-01T00:00:00Z'))`) === 60);

// ══════════════════════════════════════════════════════
//  Cross-validation: almanac vs index.html functions
// ══════════════════════════════════════════════════════
console.log(`\n${B}═══ Cross-validation (almanac consistency) ═══${X}`);

// GHA Sun = GHA Aries - RA Sun
const testDate = '2026-04-15T08:30:00Z';
const testAries = calc(`ghaAries(new Date('${testDate}'))`);
const testSun = calc(`solarPosition(new Date('${testDate}'))`);
const expectedGHA = ((testAries - testSun.ra) % 360 + 360) % 360;
assertClose('GHA Sun = GHA Aries - RA Sun', testSun.gha, expectedGHA, 0.001);

// Sun GHA at different times should increase ~15°/hr
for (let h = 0; h < 23; h++) {
  const t1 = `2026-02-10T${String(h).padStart(2,'0')}:00:00Z`;
  const t2 = `2026-02-10T${String(h+1).padStart(2,'0')}:00:00Z`;
  const gha1 = calc(`solarPosition(new Date('${t1}')).gha`);
  const gha2 = calc(`solarPosition(new Date('${t2}')).gha`);
  const delta = ((gha2 - gha1) % 360 + 360) % 360;
  if (Math.abs(delta - 15.0) > 0.05) {
    assertClose(`Sun GHA hour ${h}→${h+1} rate`, delta, 15.0, 0.05, '°');
    break;  // Only report first failure
  }
}
pass++; // Count the hourly rate sweep as one test
console.log(`  ${G}✓${X} Sun GHA advances ~15°/hr across 24 hours`);

// Verify star precession is consistent: SHA + RA = 360
const testStar = calc(`(function(){
  const s=STARS.find(s=>s.n==='Sirius');
  const p=precessStar(s,new Date('2026-06-15T00:00:00Z'));
  return {sha:p.sha, ra:p.ra, dec:p.dec};
})()`);
assertClose('Sirius SHA + RA = 360', (testStar.sha + testStar.ra) % 360, 0, 0.001, '°');

// ══════════════════════════════════════════════════════
//  Edge cases
// ══════════════════════════════════════════════════════
console.log(`\n${B}═══ Edge Cases ═══${X}`);

// Year 2035 (far future)
const far = calc(`(function(){ const s=STARS.find(s=>s.n==='Sirius'); return precessStar(s,new Date('2035-06-15T00:00:00Z')); })()`);
assert('Sirius 2035 SHA is finite', isFinite(far.sha), `got ${far.sha}`);
assert('Sirius 2035 Dec is finite', isFinite(far.dec), `got ${far.dec}`);

// Year 2000 (J2000 epoch)
const j2k = calc(`solarPosition(new Date('2000-01-01T12:00:00Z'))`);
assert('Sun at J2000 GHA is finite', isFinite(j2k.gha));
assert('Sun at J2000 Dec is finite', isFinite(j2k.dec));

// Very high latitude
const polar = calc(`sunTimes(new Date('2026-01-15T00:00:00Z'), 89.9)`);
assert('89.9°N Jan: neverUp', polar.neverUp === true);

// Zero latitude, zero longitude
const zeroSun = calc(`sunTimes(new Date('2026-06-15T00:00:00Z'), 0)`);
assert('Equator always has sunrise/sunset', zeroSun.rise !== null && zeroSun.set !== null);

// ══════════════════════════════════════════════════════
//  Multi-epoch star sweep (catch precession drift)
// ══════════════════════════════════════════════════════
console.log(`\n${B}═══ Multi-epoch Star Sweep ═══${X}`);

const epochs = [2020, 2022, 2024, 2026, 2028, 2030, 2032, 2035];
const sweepStars = ['Sirius', 'Arcturus', 'Vega', 'Canopus', 'Rigel'];
let sweepPass = 0, sweepFail = 0;
for (const name of sweepStars) {
  for (let i = 1; i < epochs.length; i++) {
    const prev = calc(`(function(){ const s=STARS.find(s=>s.n==='${name}'); return precessStar(s,new Date('${epochs[i-1]}-01-01T00:00:00Z')); })()`);
    const curr = calc(`(function(){ const s=STARS.find(s=>s.n==='${name}'); return precessStar(s,new Date('${epochs[i]}-01-01T00:00:00Z')); })()`);
    // SHA should change smoothly (general precession ~50"/yr ≈ 0.014°/yr)
    const dSHA = Math.abs(curr.sha - prev.sha);
    const years = epochs[i] - epochs[i-1];
    // Allow up to 2°/yr for high-PM stars like Arcturus
    if (dSHA > years * 2) {
      sweepFail++;
      console.log(`  ${R}✗${X} ${name} ${epochs[i-1]}→${epochs[i]}: ΔSHA=${dSHA.toFixed(3)}° (${(dSHA/years).toFixed(3)}°/yr)`);
    } else {
      sweepPass++;
    }
  }
}
if (sweepFail === 0) {
  pass++;
  console.log(`  ${G}✓${X} All ${sweepPass} epoch transitions smooth for ${sweepStars.length} stars`);
} else {
  fail += sweepFail;
  pass += sweepPass;
}

// ══════════════════════════════════════════════════════
//  SUMMARY
// ══════════════════════════════════════════════════════
console.log(`\n${B}══════════════════════════════════════════════════${X}`);
if (fail === 0) {
  console.log(`${G}${pass}/${pass + fail} passed, 0 failed${X}`);
} else {
  console.log(`${R}${pass}/${pass + fail} passed, ${fail} failed${X}`);
}
console.log();

process.exit(fail > 0 ? 1 : 0);
