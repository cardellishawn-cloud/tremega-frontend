// tests/integration/materials.test.js
// Integration tests against the LIVE materials table. These require a working
// SUPABASE_SERVICE_ROLE_KEY in tremega/backend/.env — as of week 5 the key in
// .env is rejected (401 "Unregistered API key"), so the whole suite SKIPS
// cleanly until the key is fixed and db/seeds/materials.sql has been run.
// No skipping logic leaks into unit tests; this file is live-only.

require('dotenv').config();

let supabase = null;
let live = false;

beforeAll(async () => {
  try {
    // eslint-disable-next-line global-require
    supabase = require('../../lib/supabase');
    const { error } = await supabase.from('materials').select('id').limit(1);
    live = !error;
    if (!live) {
      // eslint-disable-next-line no-console
      console.warn(`integration/materials: live db unreachable (${error.message}) — skipping`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`integration/materials: supabase unavailable (${err.message}) — skipping`);
  }
});

const itLive = (...args) => (live ? test(...args) : test.skip(...args));

// Point the service at the real client for these tests.
const svc = require('../../src/services/materials-service');

beforeEach(() => {
  if (live) svc.setSupabase(supabase);
});

afterAll(() => {
  svc.setSupabase(null);
});

describe('live materials table', () => {
  itLive('seed data loaded (count > 50)', async () => {
    const { count, error } = await supabase
      .from('materials')
      .select('id', { count: 'exact', head: true });
    expect(error).toBeNull();
    expect(count).toBeGreaterThan(50);
  });

  itLive('suggest_materials queries the real db and returns real rows', async () => {
    const r = await svc.suggestMaterials('new electrical panel', 'electrical');
    expect(r.materials.length).toBeGreaterThan(0);
    expect(r.materials.every((m) => m.category === 'electrical')).toBe(true);
  });

  itLive('getSupplierPricing sums against real seeded prices', async () => {
    const r = await svc.getSupplierPricing([
      { material_id: '50000000-0000-4000-8000-000000000005', qty: 4 }, // 20A breaker
      { material_id: '50000000-0000-4000-8000-000000000009', qty: 1 }, // 200A panel
    ]);
    expect(r.error).toBeUndefined();
    expect(r.total_cost).toBe(179.00);
  });

  itLive('all money math is accurate to 2 decimal places', async () => {
    const r = await svc.suggestMaterials('3-bedroom kitchen remodel with new panel', 'general');
    r.materials.forEach((m) => {
      const cents = Math.round(m.total_cost * 100);
      expect(Math.abs(m.total_cost * 100 - cents)).toBeLessThan(1e-9);
    });
    const totals = svc.calculateOrderTotal(r.materials);
    expect(totals.total).toBe(Math.round((totals.subtotal + totals.tax) * 100) / 100);
  });

  itLive('suggest output is stable across live calls', async () => {
    const a = await svc.suggestMaterials('kitchen remodel', 'general');
    const b = await svc.suggestMaterials('kitchen remodel', 'general');
    expect(a.total_cost).toBe(b.total_cost);
  });
});
