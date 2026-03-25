#!/usr/bin/env node
/**
 * Benchmark: test celestial-navigator against Skyfield/DE440s reference data.
 *
 *   node benchmark.js
 *
 * Reads:
 *   - star_sha_ref.csv     (200 star SHA/Dec readings)
 *   - sight_reduction_ref.csv (200 topocentric sightings)
 *
 * Compares our precessStar + sight reduction against Skyfield apparent-place values.
 */

const fs = require('fs');
const vm = require('vm');

// ── Load the engine from index.html (same approach as test-almanac.js) ──
const html = fs.readFileSync('index.html', 'utf8');
const scriptBlocks = [];
const re = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let match;
while ((match = re.exec(html)) !== null) scriptBlocks.push(match[1]);
const code = scriptBlocks.join('\n');

const noop = () => ({
  value: '', style: {}, getContext: () => null,
  addEventListener: () => {}, classList: { add(){}, remove(){}, contains(){ return false } },
  scrollIntoView(){}, getBoundingClientRect(){ return {width:0,height:0} },
});
const sandbox = {
  document: {
    getElementById: noop, querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, createElement: noop,
  },
  window: { addEventListener: () => {}, innerWidth: 1400 },
  navigator: { serviceWorker: { register: () => Promise.resolve() } },
  localStorage: { getItem: () => null, setItem: () => {} },
  L: { map:()=>({setView(){return this},addTo(){return this},on(){return this},remove(){},eachLayer(){},invalidateSize(){},setZoom(){return this}}),
       tileLayer:()=>({addTo(){return this}}), control:{layers:()=>({addTo(){return this}})},
       marker:()=>({addTo(){return this},setOpacity(){return this},setLatLng(){return this},bindPopup(){return this},setIcon(){return this}}),
       divIcon:()=>({}),icon:()=>({}),layerGroup:()=>({addTo(){return this},clearLayers(){return this}}),
       polyline:()=>({addTo(){return this},bindTooltip(){return this}}),
       circle:()=>({addTo(){return this}}),circleMarker:()=>({addTo(){return this},bindTooltip(){return this}}),
       polygon:()=>({addTo(){return this},setLatLngs(){return this},remove(){}}),latLng:(a,b)=>[a,b] },
  requestAnimationFrame: () => {}, ResizeObserver: class { observe(){} },
  setTimeout: () => {}, confirm: () => false, console,
  Math, Date, Object, Array, String, Number, Boolean, JSON, Error, RegExp,
  parseInt, parseFloat, isNaN, isFinite, undefined, NaN, Infinity,
  Promise, Map, Set, Symbol,
};
sandbox.window.document = sandbox.document;
sandbox.self = sandbox.window;

vm.createContext(sandbox);
try { vm.runInContext(code, sandbox, { filename: 'index.html' }); } catch (e) { /* DOM init errors */ }

function calc(expr) {
  return vm.runInContext(expr, sandbox);
}

// ── CSV parser ─────────────────────────────────────────────────
function parseCSV(path) {
  const lines = fs.readFileSync(path, 'utf8').replace(/\r/g, '').trim().split('\n');
  const hdr = lines[0].split(',');
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const row = {};
    hdr.forEach((h, i) => row[h] = vals[i]);
    return row;
  });
}

// ── Stats helpers ──────────────────────────────────────────────
function stats(errors) {
  if (errors.length === 0) return { mean:0, rms:0, p50:0, p90:0, p95:0, max:0, n:0 };
  const sorted = [...errors].sort((a, b) => a - b);
  const mean = errors.reduce((s, e) => s + e, 0) / errors.length;
  const rms = Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / errors.length);
  const p50 = sorted[Math.floor(errors.length * 0.5)];
  const p90 = sorted[Math.floor(errors.length * 0.9)];
  const p95 = sorted[Math.floor(errors.length * 0.95)];
  const max = sorted[sorted.length - 1];
  return { mean, rms, p50, p90, p95, max, n: errors.length };
}

function fmtStats(s, unit = "'") {
  const dp = s.max < 0.1 ? 4 : s.max < 1 ? 3 : 2;
  return `  mean=${s.mean.toFixed(dp)}${unit}  rms=${s.rms.toFixed(dp)}${unit}  ` +
         `p50=${s.p50.toFixed(dp)}${unit}  p90=${s.p90.toFixed(dp)}${unit}  ` +
         `p95=${s.p95.toFixed(dp)}${unit}  max=${s.max.toFixed(dp)}${unit}  (n=${s.n})`;
}

function histogram(errors, numBins, unit = "'", tol = null) {
  if (!errors.length) return;
  const sorted = [...errors].sort((a, b) => a - b);
  const maxVal = sorted[sorted.length - 1];
  const binWidth = maxVal / numBins || 1;
  const bins = new Array(numBins).fill(0);
  for (const e of errors) {
    const idx = Math.min(Math.floor(e / binWidth), numBins - 1);
    bins[idx]++;
  }
  const maxCount = Math.max(...bins);
  const barWidth = 40;
  console.log();
  for (let i = 0; i < numBins; i++) {
    const dp = binWidth < 0.1 ? 3 : binWidth < 1 ? 2 : 1;
    const lo = (i * binWidth).toFixed(dp);
    const hi = ((i + 1) * binWidth).toFixed(dp);
    const pct = (bins[i] / errors.length * 100).toFixed(0);
    const barLen = Math.round(bins[i] / maxCount * barWidth);
    const bar = '\x1b[36m' + '█'.repeat(barLen) + '\x1b[0m';
    const tolMark = tol != null && (i + 1) * binWidth > tol && i * binWidth <= tol ? ' ◄ tol' : '';
    const label = `  ${lo.padStart(6)}-${hi.padEnd(6)}${unit}`;
    console.log(`${label} ${bar} ${bins[i]}${pct > 0 ? ` (${pct}%)` : ''}${tolMark}`);
  }
}

// Track results per category for summary table
const results = [];

// Per-decade breakdown helper
function decadeBreakdown(entries, unit = "'") {
  // entries: [{utc: string, error: number}, ...]
  const decades = {};
  for (const e of entries) {
    const year = new Date(e.utc).getUTCFullYear();
    const decade = Math.floor(year / 10) * 10;
    const key = `${decade}s`;
    if (!decades[key]) decades[key] = [];
    decades[key].push(e.error);
  }
  const keys = Object.keys(decades).sort();
  if (keys.length <= 1) return; // no point showing if single decade
  console.log(`\n  ${B}Per-decade breakdown:${X}`);
  for (const k of keys) {
    const s = stats(decades[k]);
    const dp = s.max < 0.1 ? 4 : s.max < 1 ? 3 : 2;
    console.log(`    ${k}: n=${String(s.n).padStart(4)}  mean=${s.mean.toFixed(dp).padStart(7)}${unit}  p90=${s.p90.toFixed(dp).padStart(7)}${unit}  max=${s.max.toFixed(dp).padStart(7)}${unit}`);
  }
}

// ANSI colors
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', B = '\x1b[1m', X = '\x1b[0m';

let totalTests = 0, totalFail = 0;

// ══════════════════════════════════════════════════════════════
//  TEST 1: Star SHA/Dec
// ══════════════════════════════════════════════════════════════
const shaRef = parseCSV('star_sha_ref.csv');
console.log(`\n${B}═══ Star SHA/Dec vs Skyfield/DE440s (${shaRef.length} readings) ═══${X}`);
const shaErrors = [], decErrors = [], skyErrors = [], skyEntries = [];
let shaFails = 0;
// Tolerance: 1.5' for SHA (generous for nutation/aberration we don't model),
// but Polaris gets 20' due to pole amplification
const SHA_TOL = 1.5;  // arcmin for |dec| < 80
const POLE_SHA_TOL = 40; // arcmin for |dec| >= 80 (amplified by 1/cos(dec))
const DEC_TOL = 1.0;  // arcmin

for (const row of shaRef) {
  const utcStr = row.utc;
  const starName = row.star;
  const refSHA = +row.sha_deg;
  const refDec = +row.dec_deg;

  const sha = calc(`(function(){
    const s = STARS.find(s => s.n === '${starName}');
    if (!s) return null;
    const p = precessStar(s, new Date('${utcStr}'));
    return { sha: p.sha, dec: p.dec };
  })()`);

  totalTests++;
  if (!sha) {
    totalFail++; shaFails++;
    console.log(`  ${R}✗${X} ${starName} at ${utcStr}: not found`);
    continue;
  }

  const dSHA = Math.abs(sha.sha - refSHA) * 60; // arcmin
  const dDec = Math.abs(sha.dec - refDec) * 60;
  // Sky separation (great-circle approx)
  const dRA = (sha.sha - refSHA) * Math.cos(refDec * Math.PI / 180);
  const dSky = Math.sqrt(dRA * dRA + (sha.dec - refDec) * (sha.dec - refDec)) * 60;

  if (!isNaN(dSHA)) shaErrors.push(dSHA);
  if (!isNaN(dDec)) decErrors.push(dDec);
  if (!isNaN(dSky)) { skyErrors.push(dSky); skyEntries.push({utc: utcStr, error: dSky}); }

  const tol = Math.abs(refDec) >= 80 ? POLE_SHA_TOL : SHA_TOL;
  if (dSHA > tol || dDec > DEC_TOL) {
    totalFail++; shaFails++;
    console.log(`  ${R}✗${X} ${starName} at ${utcStr}: ΔSHA=${dSHA.toFixed(1)}' ΔDec=${dDec.toFixed(1)}' sky=${dSky.toFixed(1)}'`);
  }
}

const shaPassed = shaRef.length - shaFails;
console.log(`\n  ${shaPassed === shaRef.length ? G : Y}${shaPassed}/${shaRef.length} within tolerance${X}`);
console.log(`\n  ${B}SHA error distribution (arcmin):${X}`);
console.log(fmtStats(stats(shaErrors)));
console.log(`  ${B}Dec error distribution (arcmin):${X}`);
console.log(fmtStats(stats(decErrors)));
console.log(`  ${B}Sky separation distribution (arcmin):${X}`);
console.log(fmtStats(stats(skyErrors)));
histogram(skyErrors, 8, "'", SHA_TOL);
decadeBreakdown(skyEntries);
results.push({ name: 'Star SHA/Dec', total: shaRef.length, passed: shaPassed, unit: "'", errors: skyErrors });

// ══════════════════════════════════════════════════════════════
//  TEST 2: Sight Reduction — topocentric alt/az
// ══════════════════════════════════════════════════════════════
const sightRef = parseCSV('sight_reduction_ref.csv');
console.log(`\n${B}═══ Sight Reduction vs Skyfield/DE440s (${sightRef.length} sightings) ═══${X}`);
const altErrors = [], azErrors = [], altEntries = [];
let sightFails = 0, sightSkips = 0;

for (const row of sightRef) {
  const utcStr = row.utc;
  const bodyName = row.body;
  const lat = +row.obs_lat;
  const lon = +row.obs_lon;
  const refAlt = +row.alt_deg;
  const refAz = +row.az_deg;

  totalTests++;

  // Compute our SHA/Dec for this body
  let ourSHA, ourDec;
  try {
    if (bodyName === 'Sun') {
      const pos = calc(`solarPosition(new Date('${utcStr}'))`);
      ourSHA = pos.sha; ourDec = pos.dec;
    } else if (bodyName === 'Moon') {
      const pos = calc(`moonPosition(new Date('${utcStr}'))`);
      ourSHA = pos.sha; ourDec = pos.dec;
    } else if (['Venus', 'Mars', 'Jupiter', 'Saturn'].includes(bodyName)) {
      const pos = calc(`planetPosition('${bodyName}', new Date('${utcStr}'))`);
      ourSHA = pos.sha; ourDec = pos.dec;
    } else {
      // Star
      const pos = calc(`(function(){
        const s = STARS.find(s => s.n === '${bodyName}');
        if (!s) return null;
        const p = precessStar(s, new Date('${utcStr}'));
        return { sha: p.sha, dec: p.dec };
      })()`);
      if (!pos) {
        sightSkips++; totalFail++;
        console.log(`  ${R}✗${X} ${bodyName}: star not found`);
        continue;
      }
      ourSHA = pos.sha; ourDec = pos.dec;
    }
  } catch (e) {
    sightSkips++; totalFail++;
    console.log(`  ${R}✗${X} ${bodyName} at ${utcStr}: error: ${e.message}`);
    continue;
  }

  // Compute sight reduction
  const ghaAries = calc(`ghaAries(new Date('${utcStr}'))`);
  const gha = ((ghaAries + ourSHA) % 360 + 360) % 360;
  const lha = ((gha + lon) % 360 + 360) % 360;
  const sr = calc(`reduce(${lat}, ${ourDec}, ${lha})`);
  const ourAlt = sr.Hc;
  const ourAz = sr.Zn;

  const dAlt = Math.abs(ourAlt - refAlt) * 60; // arcmin
  let dAz = Math.abs(ourAz - refAz);
  if (dAz > 180) dAz = 360 - dAz;
  dAz *= 60; // arcmin

  altErrors.push(dAlt);
  azErrors.push(dAz);
  altEntries.push({utc: utcStr, error: dAlt});

  // Tolerances by body type (arcmin)
  // Moon: geocentric vs topocentric differs by HP (~57'), so 60' tolerance
  // Planets: mean-element ephemeris errors
  let altTol;
  if (bodyName === 'Moon') {
    altTol = 60;
  } else if (['Venus', 'Mars'].includes(bodyName)) {
    altTol = 20;
  } else if (['Jupiter', 'Saturn'].includes(bodyName)) {
    altTol = 15;
  } else if (bodyName === 'Sun') {
    altTol = 3;
  } else {
    altTol = 3; // Stars
  }
  // Azimuth is unreliable near zenith/horizon — only check altitude
  const altOk = dAlt <= altTol;
  if (!altOk) {
    sightFails++; totalFail++;
    console.log(`  ${R}✗${X} ${bodyName} @ ${row.location} ${utcStr}: ΔAlt=${dAlt.toFixed(1)}' (ours=${ourAlt.toFixed(2)}° ref=${refAlt.toFixed(2)}°)`);
  }
}

const sightPassed = sightRef.length - sightFails - sightSkips;
console.log(`\n  ${sightPassed === sightRef.length - sightSkips ? G : Y}${sightPassed}/${sightRef.length} within tolerance${X} (${sightSkips} skipped)`);
console.log(`\n  ${B}Altitude error distribution (arcmin):${X}`);
console.log(fmtStats(stats(altErrors)));
console.log(`  ${B}Azimuth error distribution (arcmin):${X}`);
console.log(fmtStats(stats(azErrors)));
histogram(altErrors, 8, "'");
decadeBreakdown(altEntries);
results.push({ name: 'Sight Reduction', total: sightRef.length, passed: sightPassed, unit: "'", errors: altErrors });

// ══════════════════════════════════════════════════════════════
//  TEST 3: Lunar Distance — geocentric Moon-body angular distance
// ══════════════════════════════════════════════════════════════
if (fs.existsSync('lunar_dist_ref.csv')) {
  const lunarRef = parseCSV('lunar_dist_ref.csv');
  console.log(`\n${B}═══ Lunar Distance vs Skyfield (${lunarRef.length} readings) ═══${X}`);
  const lunarErrors = [], lunarEntries = [];
  let lunarFails = 0;
  const LUNAR_TOL = 30; // arcmin — Venus/Mars ephemeris errors dominate

  for (const row of lunarRef) {
    const utcStr = row.utc;
    const bodyName = row.body;
    const refDist = +row.dist_deg;

    totalTests++;
    try {
      const ourDist = calc(`geocentricLunarDist(new Date('${utcStr}'), '${bodyName}')`);
      const dDist = Math.abs(ourDist - refDist) * 60; // arcmin
      lunarErrors.push(dDist);
      lunarEntries.push({utc: utcStr, error: dDist});
      if (dDist > LUNAR_TOL) {
        lunarFails++; totalFail++;
        console.log(`  ${R}✗${X} ${bodyName} ${utcStr}: Δ=${dDist.toFixed(1)}' (ours=${ourDist.toFixed(3)}° ref=${refDist.toFixed(3)}°)`);
      }
    } catch (e) {
      lunarFails++; totalFail++;
      console.log(`  ${R}✗${X} ${bodyName} ${utcStr}: error: ${e.message}`);
    }
  }
  const lunarPassed = lunarRef.length - lunarFails;
  console.log(`\n  ${lunarPassed === lunarRef.length ? G : Y}${lunarPassed}/${lunarRef.length} within tolerance${X}`);
  console.log(`  ${B}Lunar distance error distribution (arcmin):${X}`);
  console.log(fmtStats(stats(lunarErrors)));
  histogram(lunarErrors, 8, "'", LUNAR_TOL);
  decadeBreakdown(lunarEntries);
  results.push({ name: 'Lunar Distance', total: lunarRef.length, passed: lunarPassed, unit: "'", errors: lunarErrors });
}

// ══════════════════════════════════════════════════════════════
//  TEST 4: Moon Phase — illumination % vs Skyfield
// ══════════════════════════════════════════════════════════════
if (fs.existsSync('moon_phase_ref.csv')) {
  const phaseRef = parseCSV('moon_phase_ref.csv');
  console.log(`\n${B}═══ Moon Phase vs Skyfield (${phaseRef.length} readings) ═══${X}`);
  const phaseErrors = [], phaseEntries = [];
  let phaseFails = 0;
  const PHASE_TOL = 5; // percent illumination

  for (const row of phaseRef) {
    const utcStr = row.utc;
    const refIllum = +row.illumination_pct;

    totalTests++;
    try {
      const our = calc(`moonPhase(new Date('${utcStr}'))`);
      const dIllum = Math.abs(our.illumination - refIllum);
      phaseErrors.push(dIllum);
      phaseEntries.push({utc: utcStr, error: dIllum});
      if (dIllum > PHASE_TOL) {
        phaseFails++; totalFail++;
        console.log(`  ${R}✗${X} ${utcStr}: Δ=${dIllum.toFixed(1)}% (ours=${our.illumination.toFixed(1)}% ref=${refIllum.toFixed(1)}%)`);
      }
    } catch (e) {
      phaseFails++; totalFail++;
      console.log(`  ${R}✗${X} ${utcStr}: error: ${e.message}`);
    }
  }
  const phasePassed = phaseRef.length - phaseFails;
  console.log(`\n  ${phasePassed === phaseRef.length ? G : Y}${phasePassed}/${phaseRef.length} within tolerance${X}`);
  console.log(`  ${B}Illumination error distribution (%):${X}`);
  console.log(fmtStats(stats(phaseErrors), '%'));
  histogram(phaseErrors, 6, '%', PHASE_TOL);
  decadeBreakdown(phaseEntries, '%');
  results.push({ name: 'Moon Phase', total: phaseRef.length, passed: phasePassed, unit: '%', errors: phaseErrors });
}

// ══════════════════════════════════════════════════════════════
//  TEST 5: End-to-End Fix — synthetic sights → fix position
// ══════════════════════════════════════════════════════════════
if (fs.existsSync('fix_ref.csv')) {
  const fixRef = parseCSV('fix_ref.csv');
  console.log(`\n${B}═══ End-to-End Fix (${fixRef.length} cases) ═══${X}`);
  const fixErrors = [], fixEntries = [];
  let fixFails = 0;
  const FIX_TOL = 30; // nm — generous for simplified ephemeris

  for (const row of fixRef) {
    const utcStr = row.utc;
    const trueLat = +row.true_lat;
    const trueLon = +row.true_lon;
    const sightData = row.sights.split('|').map(s => {
      const [body, alt, az] = s.split(':');
      return { body, alt: +alt, az: +az };
    });

    totalTests++;
    try {
      // Build intercept LOPs using true position as AP
      const lopsCode = sightData.map(s => {
        const isBody = ['Sun','Moon','Venus','Mars','Jupiter','Saturn'].includes(s.body);
        return `(function(){
          const utc=new Date('${utcStr}');
          ${isBody
            ? (s.body === 'Sun' ? `const pos=solarPosition(utc);` :
               s.body === 'Moon' ? `const pos=moonPosition(utc);` :
               `const pos=planetPosition('${s.body}',utc);`)
            : `const raw=STARS.find(s=>s.n==='${s.body}');
               const pos=precessStar(raw,utc);`
          }
          const ghaA=ghaAries(utc);
          const ghaSt=mod360(ghaA+(pos.sha||mod360(360-pos.ra)));
          const lha=mod360(ghaSt+${trueLon});
          const r=reduce(${trueLat},pos.dec,lha);
          return{intercept:(${s.alt}-r.Hc)*60, azimuth:r.Zn};
        })()`;
      });

      const lops = calc(`[${lopsCode.join(',')}]`);
      const fix = calc(`lsFix(${JSON.stringify(lops)})`);
      const fixLat = trueLat + fix.dy / 60;
      const fixLon = trueLon + fix.dx / (60 * Math.cos(trueLat * Math.PI / 180));

      // Great-circle distance in nm
      const dLat = (fixLat - trueLat) * 60;
      const dLon = (fixLon - trueLon) * 60 * Math.cos(trueLat * Math.PI / 180);
      const errNm = Math.sqrt(dLat * dLat + dLon * dLon);
      fixErrors.push(errNm);
      fixEntries.push({utc: utcStr, error: errNm});

      if (errNm > FIX_TOL) {
        fixFails++; totalFail++;
        console.log(`  ${R}✗${X} ${utcStr} @ (${trueLat},${trueLon}): ${errNm.toFixed(1)} nm (${sightData.length} sights)`);
      }
    } catch (e) {
      fixFails++; totalFail++;
      console.log(`  ${R}✗${X} ${utcStr}: error: ${e.message}`);
    }
  }
  const fixPassed = fixRef.length - fixFails;
  console.log(`\n  ${fixPassed === fixRef.length ? G : Y}${fixPassed}/${fixRef.length} within ${FIX_TOL} nm${X}`);
  console.log(`  ${B}Fix error distribution (nm):${X}`);
  console.log(fmtStats(stats(fixErrors), ' nm'));
  histogram(fixErrors, 8, ' nm', FIX_TOL);
  decadeBreakdown(fixEntries, ' nm');
  results.push({ name: 'End-to-End Fix', total: fixRef.length, passed: fixPassed, unit: ' nm', errors: fixErrors });
}

// ══════════════════════════════════════════════════════════════
//  SUMMARY TABLE
// ══════════════════════════════════════════════════════════════
console.log(`\n${B}══════════════════════════════════════════════════${X}`);
console.log(`  ${B}${'Category'.padEnd(20)} Pass    %     Mean    P90     Max${X}`);
console.log(`  ${'─'.repeat(60)}`);
for (const r of results) {
  const pct = (r.passed / r.total * 100).toFixed(1);
  const s = stats(r.errors);
  const color = r.passed === r.total ? G : pct >= 95 ? Y : R;
  console.log(`  ${color}${r.name.padEnd(20)}${X} ${String(r.passed + '/' + r.total).padEnd(8)} ${pct.padStart(5)}%  ${s.mean.toFixed(2).padStart(6)}${r.unit}  ${s.p90.toFixed(2).padStart(6)}${r.unit}  ${s.max.toFixed(2).padStart(6)}${r.unit}`);
}
console.log(`  ${'─'.repeat(60)}`);
if (totalFail === 0) {
  console.log(`  ${G}TOTAL: ${totalTests}/${totalTests} passed (100%)${X}`);
} else {
  const totalPct = ((totalTests - totalFail) / totalTests * 100).toFixed(1);
  console.log(`  ${totalFail <= totalTests * 0.05 ? Y : R}TOTAL: ${totalTests - totalFail}/${totalTests} passed (${totalPct}%)${X}`);
}
console.log();

process.exit(totalFail > 0 ? 1 : 0);
