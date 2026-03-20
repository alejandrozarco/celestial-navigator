export function detectBrightSpots(imgEl, opts) {
  opts = opts || {};
  const pct = opts.pct != null ? opts.pct : 96;
  const maxStars = opts.maxStars || 30;
  const clusterPx = opts.clusterPx || 18;

  const W = Math.min(imgEl.naturalWidth, 800);
  const H = Math.round(imgEl.naturalHeight * W / imgEl.naturalWidth);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  cv.getContext('2d').drawImage(imgEl, 0, 0, W, H);
  const data = cv.getContext('2d').getImageData(0, 0, W, H).data;

  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    lum[i] = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
  }

  const sorted = lum.slice().sort((a, b) => a - b);
  const thresh = Math.max(60, sorted[Math.floor(sorted.length * pct / 100)]);

  const raw = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const v = lum[y * W + x];
      if (v < thresh) continue;
      let ok = true;
      outer: for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (lum[(y + dy) * W + (x + dx)] >= v) { ok = false; break outer; }
        }
      }
      if (!ok) continue;

      // Weighted centroid in 7×7 neighbourhood
      const R = 3;
      const nbhood = [];
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < W && ny >= 0 && ny < H) nbhood.push(lum[ny * W + nx]);
        }
      }
      nbhood.sort((a, b) => a - b);
      const bg = nbhood[Math.floor(nbhood.length * 0.5)];
      let wsum = 0, wxsum = 0, wysum = 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const w = Math.max(0, lum[ny * W + nx] - bg);
          wsum += w; wxsum += nx * w; wysum += ny * w;
        }
      }
      const cx = wsum > 0 ? wxsum / wsum : x;
      const cy = wsum > 0 ? wysum / wsum : y;
      raw.push({ px: cx / W, py: cy / H, v });
    }
  }

  raw.sort((a, b) => b.v - a.v);
  const kept = [];
  for (const c of raw) {
    if (!kept.some(k => Math.hypot((k.px - c.px) * W, (k.py - c.py) * H) < clusterPx)) {
      kept.push(c);
      if (kept.length >= maxStars) break;
    }
  }
  return kept;
}
