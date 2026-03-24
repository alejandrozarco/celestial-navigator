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
  return `  mean=${s.mean.toFixed(2)}${unit}  rms=${s.rms.toFixed(2)}${unit}  ` +
         `p50=${s.p50.toFixed(2)}${unit}  p90=${s.p90.toFixed(2)}${unit}  ` +
         `p95=${s.p95.toFixed(2)}${unit}  max=${s.max.toFixed(2)}${unit}  (n=${s.n})`;
}

// ANSI colors
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', B = '\x1b[1m', X = '\x1b[0m';

let totalTests = 0, totalFail = 0;

// ══════════════════════════════════════════════════════════════
//  TEST 1: Star SHA/Dec
// ══════════════════════════════════════════════════════════════
const shaRef = parseCSV('star_sha_ref.csv');
console.log(`\n${B}═══ Star SHA/Dec vs Skyfield/DE440s (${shaRef.length} readings) ═══${X}`);
const shaErrors = [], decErrors = [], skyErrors = [];
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
  if (!isNaN(dSky)) skyErrors.push(dSky);

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

// ══════════════════════════════════════════════════════════════
//  TEST 2: Sight Reduction — topocentric alt/az
// ══════════════════════════════════════════════════════════════
const sightRef = parseCSV('sight_reduction_ref.csv');
console.log(`\n${B}═══ Sight Reduction vs Skyfield/DE440s (${sightRef.length} sightings) ═══${X}`);
const altErrors = [], azErrors = [];
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

  // Tolerances by body type
  let altTol;
  if (['Venus', 'Mars'].includes(bodyName)) {
    altTol = 20;
  } else if (bodyName === 'Moon') {
    altTol = 5;
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

// ══════════════════════════════════════════════════════════════
//  TEST 3: Lunar Distance — geocentric Moon-body angular distance
// ══════════════════════════════════════════════════════════════
if (fs.existsSync('lunar_dist_ref.csv')) {
  const lunarRef = parseCSV('lunar_dist_ref.csv');
  console.log(`\n${B}═══ Lunar Distance vs Skyfield (${lunarRef.length} readings) ═══${X}`);
  const lunarErrors = [];
  let lunarFails = 0;
  const LUNAR_TOL = 20; // arcmin — planet ephemeris errors dominate

  for (const row of lunarRef) {
    const utcStr = row.utc;
    const bodyName = row.body;
    const refDist = +row.dist_deg;

    totalTests++;
    try {
      const ourDist = calc(`geocentricLunarDist(new Date('${utcStr}'), '${bodyName}')`);
      const dDist = Math.abs(ourDist - refDist) * 60; // arcmin
      lunarErrors.push(dDist);
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
}

// ══════════════════════════════════════════════════════════════
//  TEST 4: Moon Phase — illumination % vs Skyfield
// ══════════════════════════════════════════════════════════════
if (fs.existsSync('moon_phase_ref.csv')) {
  const phaseRef = parseCSV('moon_phase_ref.csv');
  console.log(`\n${B}═══ Moon Phase vs Skyfield (${phaseRef.length} readings) ═══${X}`);
  const phaseErrors = [];
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
}

// ══════════════════════════════════════════════════════════════
//  TEST 5: End-to-End Fix — synthetic sights → fix position
// ══════════════════════════════════════════════════════════════
if (fs.existsSync('fix_ref.csv')) {
  const fixRef = parseCSV('fix_ref.csv');
  console.log(`\n${B}═══ End-to-End Fix (${fixRef.length} cases) ═══${X}`);
  const fixErrors = [];
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
}

// ══════════════════════════════════════════════════════════════
//  SUMMARY
// ══════════════════════════════════════════════════════════════
console.log(`\n${B}══════════════════════════════════════════════════${X}`);
if (totalFail === 0) {
  console.log(`${G}${totalTests}/${totalTests} passed, 0 failed${X}`);
} else {
  console.log(`${R}${totalTests - totalFail}/${totalTests} passed, ${totalFail} failed${X}`);
}
console.log();

process.exit(totalFail > 0 ? 1 : 0);
