// tests/unit/materials-service.test.js
// Unit tests for the materials data layer. Zero db calls — exercises the
// canonical offline catalog path (the same rows as db/seeds/materials.sql).

const svc = require('../../src/services/materials-service');

const IDS = {
  WIRE_14AWG: '50000000-0000-4000-8000-000000000001',
  WIRE_12AWG: '50000000-0000-4000-8000-000000000002',
  OUTLET_BOX: '50000000-0000-4000-8000-000000000003',
  BREAKER_20A: '50000000-0000-4000-8000-000000000005',
  BREAKER_30A: '50000000-0000-4000-8000-000000000006',
  PANEL_200A: '50000000-0000-4000-8000-000000000009',
  CONDUIT_HALF: '50000000-0000-4000-8000-000000000010',
  GFCI: '50000000-0000-4000-8000-000000000013',
  ROMEX_10_3: '50000000-0000-4000-8000-000000000019',
  STUD_2X4: '50000000-0000-4000-8000-000000000051',
  DRYWALL: '50000000-0000-4000-8000-000000000054',
};

const round2 = (n) => Math.round(n * 100) / 100;

beforeEach(() => {
  svc.setSupabase(null); // force the offline catalog path
});

describe('suggestMaterials', () => {
  test('electrical job returns only electrical materials', async () => {
    const r = await svc.suggestMaterials('new electrical panel', 'electrical');
    expect(r.materials.length).toBeGreaterThan(0);
    expect(r.materials.every((m) => m.category === 'electrical')).toBe(true);
  });

  test('GATE: new electrical panel → panel + breakers + wire + conduit', async () => {
    const r = await svc.suggestMaterials('new electrical panel', 'electrical');
    const ids = r.materials.map((m) => m.material_id);
    expect(ids).toContain(IDS.PANEL_200A);
    expect(ids).toContain(IDS.BREAKER_20A);
    expect(ids).toContain(IDS.BREAKER_30A);
    expect(ids).toContain(IDS.WIRE_12AWG);
    expect(ids).toContain(IDS.CONDUIT_HALF);
    expect(r.total_cost).toBeGreaterThan(0);
  });

  test('NEC-correct: panel job never pairs 14 AWG with 20A/30A breakers', async () => {
    const r = await svc.suggestMaterials('new electrical panel', 'electrical');
    const ids = r.materials.map((m) => m.material_id);
    expect(ids).not.toContain(IDS.WIRE_14AWG);
    expect(ids).toContain(IDS.ROMEX_10_3); // 30A runs get 10 AWG
  });

  test('keyword "panel" parses to electrical category', async () => {
    const r = await svc.suggestMaterials('panel upgrade');
    expect(r.category_breakdown.electrical).toBeGreaterThan(0);
  });

  test('kitchen remodel mixes trades (electrical + plumbing/general)', async () => {
    const r = await svc.suggestMaterials('kitchen remodel', 'general');
    const cats = Object.keys(r.category_breakdown);
    expect(cats.length).toBeGreaterThanOrEqual(2);
    expect(r.materials.map((m) => m.material_id)).toContain(IDS.GFCI);
  });

  test('bedroom count scales lumber and drywall (3-bedroom)', async () => {
    const r = await svc.suggestMaterials('3-bedroom addition', 'general');
    const stud = r.materials.find((m) => m.material_id === IDS.STUD_2X4);
    const drywall = r.materials.find((m) => m.material_id === IDS.DRYWALL);
    expect(stud.qty).toBe(30); // 10 per room
    expect(drywall.qty).toBe(18); // 6 per room
  });

  test('defaults to 1 room when no count given', async () => {
    const r = await svc.suggestMaterials('bedroom remodel');
    const stud = r.materials.find((m) => m.material_id === IDS.STUD_2X4);
    expect(stud.qty).toBe(10);
  });

  test('unrecognized spec falls back to general catalog', async () => {
    const r = await svc.suggestMaterials('xyzzy gibberish');
    expect(r.materials.length).toBeGreaterThan(0);
    expect(Object.keys(r.category_breakdown)).toEqual(['general']);
  });

  test('empty spec still returns a usable list', async () => {
    const r = await svc.suggestMaterials('');
    expect(r.materials.length).toBeGreaterThan(0);
  });

  test('plumbing jobType returns plumbing materials', async () => {
    const r = await svc.suggestMaterials('replace sink drain', 'plumbing');
    expect(r.materials.some((m) => m.category === 'plumbing')).toBe(true);
  });

  test('every line total equals qty * unit_cost and sums to total_cost', async () => {
    const r = await svc.suggestMaterials('3-bedroom kitchen remodel with new panel', 'general');
    r.materials.forEach((m) => {
      expect(m.total_cost).toBe(round2(m.qty * m.unit_cost));
    });
    const sum = round2(r.materials.reduce((s, m) => s + m.total_cost, 0));
    expect(r.total_cost).toBe(sum);
    const breakdownSum = round2(Object.values(r.category_breakdown).reduce((s, v) => s + v, 0));
    expect(breakdownSum).toBe(sum);
  });

  test('output is deterministic (same input → same ids in same order)', async () => {
    const a = await svc.suggestMaterials('kitchen remodel', 'general');
    const b = await svc.suggestMaterials('kitchen remodel', 'general');
    expect(a.materials.map((m) => m.material_id)).toEqual(b.materials.map((m) => m.material_id));
  });

  test('spec alias suggest_materials is the same function', async () => {
    const r = await svc.suggest_materials('new electrical panel', 'electrical');
    expect(r.materials.length).toBeGreaterThan(0);
  });
});

describe('getSupplierPricing', () => {
  test('total_cost = qty * unit_cost for each item', async () => {
    const r = await svc.getSupplierPricing([
      { material_id: IDS.BREAKER_20A, qty: 4 }, // 8.50 → 34.00
      { material_id: IDS.PANEL_200A, qty: 1 }, // 145.00
    ]);
    expect(r.materials[0].total_cost).toBe(34.00);
    expect(r.materials[1].total_cost).toBe(145.00);
  });

  test('sums line totals into total_cost', async () => {
    const r = await svc.getSupplierPricing([
      { material_id: IDS.BREAKER_20A, qty: 4 },
      { material_id: IDS.PANEL_200A, qty: 1 },
    ]);
    expect(r.total_cost).toBe(179.00);
  });

  test('unknown material_id → structured UNKNOWN_MATERIALS error', async () => {
    const r = await svc.getSupplierPricing([
      { material_id: '99999999-9999-9999-9999-999999999999', qty: 1 },
    ]);
    expect(r.error.code).toBe('UNKNOWN_MATERIALS');
    expect(r.error.ids).toContain('99999999-9999-9999-9999-999999999999');
  });

  test('empty list → zero total, no error', async () => {
    const r = await svc.getSupplierPricing([]);
    expect(r.materials).toEqual([]);
    expect(r.total_cost).toBe(0);
  });

  test('every item flagged in_stock (MVP)', async () => {
    const r = await svc.getSupplierPricing([{ material_id: IDS.GFCI, qty: 2 }]);
    expect(r.materials[0].in_stock).toBe(true);
  });

  test('large order (100+ items) calculates correctly', async () => {
    const list = [];
    for (let i = 0; i < 120; i += 1) {
      list.push({ material_id: i % 2 === 0 ? IDS.BREAKER_20A : IDS.GFCI, qty: 1 });
    }
    const r = await svc.getSupplierPricing(list);
    expect(r.materials.length).toBe(120);
    expect(r.total_cost).toBe(round2(60 * 8.50 + 60 * 18.00));
  });
});

describe('calculateOrderTotal', () => {
  test('subtotal sums line total_costs', () => {
    const t = svc.calculateOrderTotal([{ total_cost: 100 }, { total_cost: 50 }]);
    expect(t.subtotal).toBe(150);
  });

  test('tax is 8% of subtotal', () => {
    const t = svc.calculateOrderTotal([{ total_cost: 200 }]);
    expect(t.tax).toBe(16);
  });

  test('total = subtotal + tax', () => {
    const t = svc.calculateOrderTotal([{ total_cost: 200 }]);
    expect(t.total).toBe(216);
  });

  test('empty list → all zeros', () => {
    expect(svc.calculateOrderTotal([])).toEqual({ subtotal: 0, tax: 0, total: 0 });
  });

  test('rounds fractional cents to 2dp', () => {
    // 0.45 * 3 = 1.35; tax 1.35 * 0.08 = 0.108 → 0.11
    const t = svc.calculateOrderTotal([{ total_cost: 1.35 }]);
    expect(t).toEqual({ subtotal: 1.35, tax: 0.11, total: 1.46 });
  });
});

describe('validateMaterialList', () => {
  test('valid list passes', async () => {
    const r = await svc.validateMaterialList([
      { material_id: IDS.GFCI, qty: 2 },
      { material_id: IDS.PANEL_200A, qty: 1 },
    ]);
    expect(r).toEqual({ valid: true, errors: [] });
  });

  test('unknown material_id fails with the id in the error', async () => {
    const r = await svc.validateMaterialList([
      { material_id: '99999999-9999-9999-9999-999999999999', qty: 1 },
    ]);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain('99999999-9999-9999-9999-999999999999');
  });

  test('qty of 0 fails', async () => {
    const r = await svc.validateMaterialList([{ material_id: IDS.GFCI, qty: 0 }]);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/qty/);
  });

  test('negative qty fails', async () => {
    const r = await svc.validateMaterialList([{ material_id: IDS.GFCI, qty: -3 }]);
    expect(r.valid).toBe(false);
  });

  test('non-numeric qty fails', async () => {
    const r = await svc.validateMaterialList([{ material_id: IDS.GFCI, qty: 'two' }]);
    expect(r.valid).toBe(false);
  });

  test('null entry fails as not-an-object', async () => {
    const r = await svc.validateMaterialList([null]);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/not an object/);
  });

  test('missing material_id fails', async () => {
    const r = await svc.validateMaterialList([{ qty: 1 }]);
    expect(r.valid).toBe(false);
  });

  test('multiple problems accumulate all errors', async () => {
    const r = await svc.validateMaterialList([
      { material_id: '99999999-9999-9999-9999-999999999999', qty: 1 },
      { material_id: IDS.GFCI, qty: -1 },
    ]);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBe(2);
  });
});
