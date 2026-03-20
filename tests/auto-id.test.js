import { buildCatalogHash, runAutoID } from '../js/auto-id.js';
import { CAT_BY_MAG } from '../js/catalog.js';

test('buildCatalogHash uses top N brightest stars', () => {
  const hash40 = buildCatalogHash(40);
  const hash10 = buildCatalogHash(10);
  // C(40,3) = 9880 triangles; C(10,3) = 120
  assert(hash40.length === 9880, `expected 9880, got ${hash40.length}`);
  assert(hash10.length === 120, `expected 120, got ${hash10.length}`);
});

test('buildCatalogHash entries come from brightest stars', () => {
  const top5names = new Set(CAT_BY_MAG.slice(0, 5).map(([n]) => n));
  const hash = buildCatalogHash(5);
  // Every triangle references only stars from the top 5
  for (const t of hash) {
    assert(top5names.has(t.apex), `apex ${t.apex} not in top 5`);
    assert(top5names.has(t.far1), `far1 ${t.far1} not in top 5`);
    assert(top5names.has(t.far2), `far2 ${t.far2} not in top 5`);
  }
});

test('verifyAssignments filters geometrically inconsistent assignment', async () => {
  const { verifyAssignments } = await import('../js/auto-id.js');
  const assignments = [
    { candId: 1, star: 'Sirius',  score: 20 },
    { candId: 2, star: 'Canopus', score: 18 },
    { candId: 3, star: 'Vega',    score: 15 },  // wrong pixel position
  ];
  const detections = [
    { id: 1, px: 0.3, py: 0.5, v: 100 },
    { id: 2, px: 0.7, py: 0.5, v: 90 },
    { id: 3, px: 0.99, py: 0.01, v: 80 },  // far from where Vega should be
  ];
  const result = verifyAssignments(assignments, detections, 1);
  assert(result.length === 2, `expected 2 (third filtered), got ${result.length}`);
});

test('verifyAssignments with 2 assignments always returns both', async () => {
  // With only 2 assignments the reference pair is returned unchanged
  const { verifyAssignments } = await import('../js/auto-id.js');
  const assignments = [
    { candId: 1, star: 'Sirius',  score: 20 },
    { candId: 2, star: 'Canopus', score: 18 },
  ];
  const detections = [
    { id: 1, px: 0.3, py: 0.5, v: 100 },
    { id: 2, px: 0.7, py: 0.5, v: 90 },
  ];
  const result = verifyAssignments(assignments, detections, 1);
  assert(result.length === 2, `expected 2, got ${result.length}`);
});
