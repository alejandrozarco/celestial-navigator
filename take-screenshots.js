const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  page.on('dialog', async dialog => { await dialog.accept(); });

  const fileUrl = 'file://' + path.resolve('index.html');
  const almUrl = 'file://' + path.resolve('almanac.html');

  // === Almanac page ===
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
  await page.goto(almUrl, { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'screenshots/almanac.png', clip: { x: 0, y: 0, width: 1200, height: 800 } });
  console.log('almanac.png');

  // === Helper: fresh page load with no saved state ===
  async function freshLoad(width, height) {
    await page.evaluate(() => { localStorage.clear(); });
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
  }

  // === Helper: add sights programmatically ===
  async function addSights(lat, latH, lon, lonH, sights) {
    await page.evaluate((lat, latH, lon, lonH, sights) => {
      document.getElementById('apLatD').value = Math.floor(Math.abs(lat));
      document.getElementById('apLatM').value = ((Math.abs(lat) - Math.floor(Math.abs(lat))) * 60).toFixed(0);
      document.getElementById('apLatH').value = latH;
      document.getElementById('apLonD').value = Math.floor(Math.abs(lon));
      document.getElementById('apLonM').value = ((Math.abs(lon) - Math.floor(Math.abs(lon))) * 60).toFixed(0);
      document.getElementById('apLonH').value = lonH;

      const ap = readAP();
      const ie = 0, hoe = 2;

      sights.forEach(s => {
        const utc = new Date(s._utc || '2026-03-21T18:30:00Z');
        let star;
        if (s.body === 'sun') {
          star = { n: 'Sun', ...solarPosition(utc), isBody: true, bodyType: 'sun' };
        } else if (['venus','mars','jupiter','saturn'].includes(s.body)) {
          const pos = planetPosition(PLANET_NAMES[s.body], utc);
          star = { n: PLANET_NAMES[s.body], ...pos, isBody: true, bodyType: s.body };
        } else {
          star = STARS.find(x => x.n === s.body);
        }
        if (!star) return;

        const ghaA = ghaAries(utc);
        const ghaSt = mod360(ghaA + star.sha);
        const lha = mod360(ghaSt + ap.lon);
        const { Hc, Zn } = reduce(ap.lat, star.dec, lha);
        if (Hc < 5) return;

        const hs = Hc + (s.offset || 0) / 60;
        const { ho, dipC, refC, ha } = correct(hs, ie, hoe);
        const intercept = (ho - Hc) * 60;

        state.sights.push({
          id: state.nextId++, mode: 'intercept', utc, hs, ho, ie, hoe, dipC, refC, ha,
          star, ap: { ...ap }, ghaAries: ghaA, ghaStar: ghaSt, lha, Hc, Zn, intercept
        });
      });

      render();
      if (fixMap) fixMap.invalidateSize();
    }, lat, latH, lon, lonH, sights);
    await new Promise(r => setTimeout(r, 1500));
  }

  // === Hero screenshot (demo-fix-map) — full interface, map zoomed into Florence ===
  await freshLoad(1400, 900);
  await page.evaluate(() => { loadDemo(); });
  await new Promise(r => setTimeout(r, 2000));
  // Zoom map in closer to Florence fix
  await page.evaluate(() => {
    if (fixMap) {
      fixMap.setView([43.7, 11.3], 7);
      fixMap.invalidateSize();
    }
    // Ensure LIVE button shows active
    const liveBtn = document.getElementById('liveUtc');
    if (liveBtn) liveBtn.classList.add('active');
  });
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: 'screenshots/demo-fix-map.png', clip: { x: 0, y: 0, width: 1400, height: 900 } });
  console.log('demo-fix-map.png');

  // === Map with LOPs — full interface screenshot ===
  // Already has demo loaded, just take the full viewport
  await page.screenshot({ path: 'screenshots/map-lops.png', clip: { x: 0, y: 0, width: 1400, height: 900 } });
  console.log('map-lops.png');

  // === LOP Plot — full interface, scroll to show plot prominently ===
  await freshLoad(1400, 900);
  await page.evaluate(() => { loadDemo(); });
  await new Promise(r => setTimeout(r, 2000));
  // Make sure LOP plot is visible and expanded
  await page.evaluate(() => {
    const lopBody = document.getElementById('lopBody');
    if (lopBody) lopBody.style.display = 'block';
    const plotEl = document.getElementById('plot');
    if (plotEl) plotEl.scrollIntoView({ block: 'center' });
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'screenshots/lop-plot.png', clip: { x: 0, y: 0, width: 1400, height: 900 } });
  console.log('lop-plot.png');

  // === Star Finder — crop the sky plot canvas ===
  // Use taller viewport so sky plot is fully visible when scrolled into view
  await page.setViewport({ width: 1400, height: 2400, deviceScaleFactor: 2 });
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    const skySection = document.getElementById('skySection');
    if (skySection) skySection.scrollIntoView({ block: 'start' });
    // Trigger redraw with proper dimensions
    if (typeof drawSkyPlot === 'function') drawSkyPlot();
  });
  await new Promise(r => setTimeout(r, 1500));
  const skyEl = await page.$('#skyPlot');
  if (skyEl) {
    const box = await skyEl.boundingBox();
    if (box && box.height > 50) {
      await page.screenshot({ path: 'screenshots/star-finder.png', clip: box });
      console.log(`star-finder.png (${Math.round(box.width)}x${Math.round(box.height)})`);
    }
  }
  // Restore viewport
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 });

  // === Fix Result — crop the computed fix section ===
  await freshLoad(1400, 900);
  await page.evaluate(() => { loadDemo(); });
  await new Promise(r => setTimeout(r, 2000));
  const fixEl = await page.$('.fix-detail');
  if (fixEl) {
    const box = await fixEl.boundingBox();
    if (box) {
      await page.screenshot({ path: 'screenshots/fix-result.png', clip: box });
      console.log('fix-result.png');
    }
  }

  // === Workings — crop workings panel ===
  await page.evaluate(() => {
    // Show workings for an intercept sight (skip Polaris)
    const sight = state.sights.find(s => s.mode === 'intercept');
    if (sight) showWorkings(sight.id);
    const panel = document.getElementById('workingsPanel');
    if (panel) panel.scrollIntoView({ block: 'start' });
  });
  await new Promise(r => setTimeout(r, 500));
  const workEl = await page.$('#workingsPanel');
  if (workEl) {
    const box = await workEl.boundingBox();
    if (box && box.height > 20) {
      await page.screenshot({ path: 'screenshots/workings.png', clip: box });
      console.log('workings.png');
    }
  }

  // === Magellan route — full interface screenshots ===
  const utcSanlucar = '2026-03-21T18:30:00Z';
  const utcMagellan = '2026-03-21T22:00:00Z';
  const utcPacific  = '2026-03-22T06:30:00Z';
  const utcGuam     = '2026-03-21T09:00:00Z';

  async function takeFullShot(name, lat, latH, lon, lonH, zoom, sights, { satellite = false } = {}) {
    await freshLoad(1400, 900);
    await addSights(lat, latH, lon, lonH, sights);

    // Zoom map and optionally switch to satellite tiles
    await page.evaluate((lat, lon, zoom, satellite) => {
      if (fixMap) {
        if (satellite) {
          // Remove dark base, add satellite
          fixMap.eachLayer(l => { if (l._url && l._url.includes('carto')) fixMap.removeLayer(l); });
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }).addTo(fixMap);
        }
        fixMap.setView([lat, lon], zoom);
        fixMap.invalidateSize();
      }
    }, lat * (latH === 'S' ? -1 : 1), lon * (lonH === 'W' ? -1 : 1), zoom, satellite);
    await new Promise(r => setTimeout(r, 3000));

    // Full interface screenshot
    await page.screenshot({
      path: `screenshots/${name}.png`,
      clip: { x: 0, y: 0, width: 1400, height: 900 }
    });
    console.log(`${name}.png`);
  }

  // Sanlúcar de Barrameda
  await takeFullShot('sanlucar', 36.77, 'N', 6.35, 'W', 9, [
    { body: 'Capella', offset: 2, _utc: utcSanlucar },
    { body: 'Sirius', offset: -3, _utc: utcSanlucar },
    { body: 'Betelgeuse', offset: 1, _utc: utcSanlucar },
    { body: 'venus', offset: -5, _utc: utcSanlucar },
    { body: 'Procyon', offset: 2, _utc: utcSanlucar },
  ]);

  // Strait of Magellan
  await takeFullShot('magellan-strait', 53.47, 'S', 70.92, 'W', 7, [
    { body: 'Canopus', offset: 3, _utc: utcMagellan },
    { body: 'Acrux', offset: -2, _utc: utcMagellan },
    { body: 'Rigil Kent', offset: 1, _utc: utcMagellan },
    { body: 'Sirius', offset: -4, _utc: utcMagellan },
    { body: 'Achernar', offset: 2, _utc: utcMagellan },
    { body: 'Fomalhaut', offset: 1, _utc: utcMagellan },
    { body: 'Peacock', offset: -3, _utc: utcMagellan },
  ]);

  // Mid-Pacific (satellite tiles for ocean context)
  await takeFullShot('magellan-pacific', 5, 'N', 170, 'W', 5, [
    { body: 'Capella', offset: 2, _utc: utcPacific },
    { body: 'Sirius', offset: -3, _utc: utcPacific },
    { body: 'Betelgeuse', offset: 1, _utc: utcPacific },
    { body: 'Procyon', offset: -2, _utc: utcPacific },
    { body: 'Rigel', offset: 3, _utc: utcPacific },
    { body: 'Canopus', offset: -1, _utc: utcPacific },
    { body: 'Aldebaran', offset: 2, _utc: utcPacific },
  ], { satellite: true });

  // Guam (satellite tiles for island context)
  await takeFullShot('magellan-guam', 13.45, 'N', 144.78, 'E', 7, [
    { body: 'Capella', offset: 2, _utc: utcGuam },
    { body: 'Sirius', offset: -3, _utc: utcGuam },
    { body: 'Betelgeuse', offset: 1, _utc: utcGuam },
    { body: 'Procyon', offset: -2, _utc: utcGuam },
    { body: 'Aldebaran', offset: 4, _utc: utcGuam },
    { body: 'Rigel', offset: -1, _utc: utcGuam },
    { body: 'Canopus', offset: 3, _utc: utcGuam },
  ], { satellite: true });

  // Clean up
  await page.evaluate(() => { localStorage.clear(); });
  await browser.close();
  console.log('\nDone!');
})();
