import { D2R, R2D, nrm } from './math.js';

const COLORS = ['#4a9eff','#ff6b6b','#6bff8a','#ffaa4a','#c084fc','#22d3ee','#f472b6','#a3e635'];

export function createNavChart(container) {
  // d3 loaded from CDN — access via globalThis.d3
  const d3 = globalThis.d3;
  if (!d3) throw new Error('d3 not loaded');

  const svg = d3.select(container).append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .style('background', '#0a0a1a');

  const g = svg.append('g'); // main group for zoom
  const gridG = g.append('g').attr('class', 'grid');
  const lopG = g.append('g').attr('class', 'lops');
  const fixG = g.append('g').attr('class', 'fix');

  let width, height, projection, colorMap = {};

  function getColor(starName) {
    if (!colorMap[starName]) {
      colorMap[starName] = COLORS[Object.keys(colorMap).length % COLORS.length];
    }
    return colorMap[starName];
  }

  // Zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.5, 10])
    .on('zoom', (e) => g.attr('transform', e.transform));
  svg.call(zoom);

  function resize() {
    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    svg.attr('viewBox', `0 0 ${width} ${height}`);
  }

  function update({ ap, lops = [], fix = null, radius_nm }) {
    // Auto-scale radius to fit data
    if (radius_nm == null) {
      const maxInt = lops.reduce((m, l) => Math.max(m, Math.abs(l.intercept_nm)), 0);
      const fixDist = fix ? Math.hypot((fix.lat - ap.lat) * 60, (fix.lon - ap.lon) * 60 * Math.cos(ap.lat * D2R)) : 0;
      radius_nm = Math.max(50, Math.min(500, Math.ceil((Math.max(maxInt, fixDist) * 1.5 + 20) / 10) * 10));
    }
    resize();
    if (!ap) return;

    // Mercator projection centered on AP
    const nmToDeg = 1 / 60;
    const latExtent = radius_nm * nmToDeg;
    const lonExtent = radius_nm * nmToDeg / Math.cos(ap.lat * D2R);

    projection = d3.geoMercator()
      .center([ap.lon, ap.lat])
      .fitSize([width, height], {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[ap.lon - lonExtent, ap.lat - latExtent],
                         [ap.lon + lonExtent, ap.lat - latExtent],
                         [ap.lon + lonExtent, ap.lat + latExtent],
                         [ap.lon - lonExtent, ap.lat + latExtent],
                         [ap.lon - lonExtent, ap.lat - latExtent]]]
        }
      });

    drawGrid(ap, radius_nm);
    drawAP(ap);
    drawLOPs(ap, lops, radius_nm);
    if (fix) drawFix(fix);
    else fixG.selectAll('*').remove();
  }

  function drawGrid(ap, radius_nm) {
    gridG.selectAll('*').remove();
    const nmToDeg = 1/60;
    // Draw lat/lon grid lines
    const step = radius_nm > 100 ? 1 : 0.5; // degree step
    const latMin = ap.lat - radius_nm * nmToDeg;
    const latMax = ap.lat + radius_nm * nmToDeg;
    const cosLat = Math.cos(ap.lat * D2R);
    const lonMin = ap.lon - radius_nm * nmToDeg / cosLat;
    const lonMax = ap.lon + radius_nm * nmToDeg / cosLat;

    for (let lat = Math.floor(latMin/step)*step; lat <= latMax; lat += step) {
      const p1 = projection([lonMin, lat]);
      const p2 = projection([lonMax, lat]);
      if (p1 && p2) {
        gridG.append('line')
          .attr('x1',p1[0]).attr('y1',p1[1]).attr('x2',p2[0]).attr('y2',p2[1])
          .attr('stroke','#1a2a4a').attr('stroke-width',0.5);
        gridG.append('text').text(formatLat(lat))
          .attr('x',p1[0]+4).attr('y',p1[1]-2)
          .attr('fill','#3a5a8a').attr('font-size',9).attr('font-family','monospace');
      }
    }
    for (let lon = Math.floor(lonMin/step)*step; lon <= lonMax; lon += step) {
      const p1 = projection([lon, latMin]);
      const p2 = projection([lon, latMax]);
      if (p1 && p2) {
        gridG.append('line')
          .attr('x1',p1[0]).attr('y1',p1[1]).attr('x2',p2[0]).attr('y2',p2[1])
          .attr('stroke','#1a2a4a').attr('stroke-width',0.5);
        gridG.append('text').text(formatLon(lon))
          .attr('x',p1[0]+4).attr('y',p2[1]-2)
          .attr('fill','#3a5a8a').attr('font-size',9).attr('font-family','monospace');
      }
    }

    // North indicator
    const nPt = projection([ap.lon, ap.lat + radius_nm * nmToDeg * 0.9]);
    if (nPt) {
      gridG.append('text').text('N')
        .attr('x',nPt[0]).attr('y',nPt[1]).attr('text-anchor','middle')
        .attr('fill','#5a7aaa').attr('font-size',14).attr('font-family','monospace');
    }

    // Scale bar
    const sbLen = 50; // nm
    const p1 = projection([ap.lon, ap.lat - radius_nm/60*0.85]);
    const p2 = projection([ap.lon + sbLen/60/cosLat, ap.lat - radius_nm/60*0.85]);
    if (p1 && p2) {
      gridG.append('line')
        .attr('x1',p1[0]).attr('y1',p1[1]).attr('x2',p2[0]).attr('y2',p2[1])
        .attr('stroke','#5a7aaa').attr('stroke-width',1.5);
      gridG.append('text').text(`${sbLen} nm`)
        .attr('x',(p1[0]+p2[0])/2).attr('y',p1[1]-4).attr('text-anchor','middle')
        .attr('fill','#5a7aaa').attr('font-size',9).attr('font-family','monospace');
    }
  }

  function drawAP(ap) {
    gridG.selectAll('.ap-marker').remove();
    const pt = projection([ap.lon, ap.lat]);
    if (!pt) return;
    const apG = gridG.append('g').attr('class','ap-marker');
    apG.append('circle').attr('cx',pt[0]).attr('cy',pt[1]).attr('r',6)
      .attr('fill','none').attr('stroke','#ffcc00').attr('stroke-width',2);
    apG.append('line').attr('x1',pt[0]-8).attr('y1',pt[1]).attr('x2',pt[0]+8).attr('y2',pt[1])
      .attr('stroke','#ffcc00').attr('stroke-width',1.5);
    apG.append('line').attr('x1',pt[0]).attr('y1',pt[1]-8).attr('x2',pt[0]).attr('y2',pt[1]+8)
      .attr('stroke','#ffcc00').attr('stroke-width',1.5);
    apG.append('text').text('AP').attr('x',pt[0]+10).attr('y',pt[1]-4)
      .attr('fill','#ffcc00').attr('font-size',11).attr('font-family','monospace');
  }

  function drawLOPs(ap, lops, radius_nm) {
    lopG.selectAll('*').remove();
    const apPt = projection([ap.lon, ap.lat]);
    if (!apPt) return;
    const cosLat = Math.cos(ap.lat * D2R);
    const nmToDeg = 1/60;
    const lopLen = radius_nm / 3;

    for (const lop of lops) {
      const color = lop.color || getColor(lop.starName);
      const zr = lop.Zn * D2R;

      // Azimuth line (dashed, from AP toward star)
      const azLen = Math.min(radius_nm * 0.8, Math.abs(lop.intercept_nm) * 1.3 + 30);
      const azEndLat = ap.lat + Math.cos(zr) * azLen * nmToDeg;
      const azEndLon = ap.lon + Math.sin(zr) * azLen * nmToDeg / cosLat;
      const azEnd = projection([azEndLon, azEndLat]);
      if (azEnd) {
        lopG.append('line')
          .attr('x1',apPt[0]).attr('y1',apPt[1]).attr('x2',azEnd[0]).attr('y2',azEnd[1])
          .attr('stroke',color).attr('stroke-width',1).attr('stroke-dasharray','4,4').attr('opacity',0.4);
      }

      // Intercept point (along azimuth line at intercept distance)
      const intLat = ap.lat + Math.cos(zr) * lop.intercept_nm * nmToDeg;
      const intLon = ap.lon + Math.sin(zr) * lop.intercept_nm * nmToDeg / cosLat;

      // LOP: perpendicular to azimuth at intercept point
      const perpZr = zr + Math.PI / 2;
      const p1Lat = intLat + Math.cos(perpZr) * lopLen * nmToDeg;
      const p1Lon = intLon + Math.sin(perpZr) * lopLen * nmToDeg / cosLat;
      const p2Lat = intLat - Math.cos(perpZr) * lopLen * nmToDeg;
      const p2Lon = intLon - Math.sin(perpZr) * lopLen * nmToDeg / cosLat;

      const lp1 = projection([p1Lon, p1Lat]);
      const lp2 = projection([p2Lon, p2Lat]);
      if (lp1 && lp2) {
        lopG.append('line')
          .attr('x1',lp1[0]).attr('y1',lp1[1]).attr('x2',lp2[0]).attr('y2',lp2[1])
          .attr('stroke',color).attr('stroke-width',2.5);
        // Label at the end of the LOP line
        const intAbs = Math.abs(lop.intercept_nm);
        const intStr = intAbs > 60 ? `${(intAbs / 60).toFixed(1)}°` : `${intAbs.toFixed(1)}'`;
        lopG.append('text').text(`${lop.starName}  a=${lop.intercept_nm >= 0 ? '+' : '-'}${intStr}`)
          .attr('x',lp2[0]+4).attr('y',lp2[1]-2)
          .attr('fill',color).attr('font-size',9).attr('font-family','monospace');
      }
    }
  }

  function drawFix(fix) {
    fixG.selectAll('*').remove();
    const pt = projection([fix.lon, fix.lat]);
    if (!pt) return;
    fixG.append('circle').attr('cx',pt[0]).attr('cy',pt[1]).attr('r',8)
      .attr('fill','none').attr('stroke','#ff3').attr('stroke-width',2.5);
    fixG.append('line').attr('x1',pt[0]-10).attr('y1',pt[1]).attr('x2',pt[0]+10).attr('y2',pt[1])
      .attr('stroke','#ff3').attr('stroke-width',2);
    fixG.append('line').attr('x1',pt[0]).attr('y1',pt[1]-10).attr('x2',pt[0]).attr('y2',pt[1]+10)
      .attr('stroke','#ff3').attr('stroke-width',2);
    fixG.append('text').text('FIX').attr('x',pt[0]+14).attr('y',pt[1]-4)
      .attr('fill','#ff3').attr('font-size',11).attr('font-weight','bold').attr('font-family','monospace');
    fixG.append('text').text(`${formatLat(fix.lat)} ${formatLon(fix.lon)}`)
      .attr('x',pt[0]+14).attr('y',pt[1]+10)
      .attr('fill','#ff3').attr('font-size',9).attr('font-family','monospace');
  }

  function formatLat(d) {
    const abs = Math.abs(d);
    const deg = Math.floor(abs);
    const min = ((abs - deg) * 60).toFixed(1);
    return `${deg}°${min}'${d >= 0 ? 'N' : 'S'}`;
  }

  function formatLon(d) {
    const abs = Math.abs(d);
    const deg = Math.floor(abs);
    const min = ((abs - deg) * 60).toFixed(1);
    return `${deg}°${min}'${d >= 0 ? 'E' : 'W'}`;
  }

  return { update, resize, destroy: () => svg.remove() };
}
