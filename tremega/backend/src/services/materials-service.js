// src/services/materials-service.js
// Materials data layer: suggestions, supplier pricing, order totals, validation.
//
// Data source: live `materials` table when Supabase is reachable; otherwise the
// canonical offline catalog in src/services/materials-catalog.js (the same rows
// as db/seeds/materials.sql). Reads are cached-but-retryable like the other
// week-3/4 stores, so the service picks the real table up automatically once
// the service-role key works and seeds land.
//
// No external dependencies. All functions are async for a uniform db/catalog
// path; unit tests exercise the catalog path with zero db calls.

const { MATERIALS } = require('./materials-catalog');

const TAX_RATE = 0.08; // MVP flat tax; Phase 2: location-based.

const round2 = (n) => Math.round(n * 100) / 100;

// ---------- Injectable / lazy Supabase (read path for materials) ----------

let supabaseClient = null;
let supabaseLoadAttempted = false;
let catalogModeSince = null; // ts of last fallback; retry after window elapses
const RETRY_AFTER_MS = 60 * 1000;

const setSupabase = (client) => {
  supabaseClient = client;
  supabaseLoadAttempted = true;
  catalogModeSince = null;
};

const getSupabase = () => {
  if (!supabaseLoadAttempted) {
    supabaseLoadAttempted = true;
    try {
      // eslint-disable-next-line global-require
      supabaseClient = require('../../lib/supabase');
    } catch (err) {
      supabaseClient = null;
    }
  }
  return supabaseClient;
};

const looksLikeMissingTable = (error) =>
  Boolean(
    error
      && error.message
      && /does not exist|could not find|schema cache|42P01|relation|unregistered|401/i.test(error.message),
  );

// Fetch the full materials catalog (id, name, category, unit, unit_cost,
// specification). Falls back to the offline catalog on any failure.
const fetchCatalog = async () => {
  const shouldTry = getSupabase()
    && (catalogModeSince === null || Date.now() - catalogModeSince > RETRY_AFTER_MS);
  if (shouldTry) {
    if (catalogModeSince !== null) catalogModeSince = null; // retry window elapsed
    try {
      const { data, error } = await getSupabase().from('materials').select('*');
      if (error) {
        if (looksLikeMissingTable(error)) catalogModeSince = Date.now();
        return MATERIALS;
      }
      if (Array.isArray(data) && data.length > 0) return data;
      return MATERIALS; // table exists but unseeded — catalog still wins
    } catch (err) {
      catalogModeSince = Date.now();
      return MATERIALS;
    }
  }
  return MATERIALS;
};

// ---------- Keyword → category mapping ----------

const CATEGORY_KEYWORDS = {
  electrical: [
    'panel', 'breaker', 'outlet', 'wire', 'wiring', 'rewire', 'gfci', 'electrical',
    'lighting', 'light', 'switch', 'circuit', 'conduit', 'smoke detector', 'fan',
  ],
  plumbing: [
    'faucet', 'pipe', 'piping', 'toilet', 'vanity', 'plumb', 'drain', 'sink',
    'shower', 'tub', 'water heater', 'hose bib', 'valve',
  ],
  general: [
    'drywall', 'lumber', 'paint', 'floor', 'roof', 'fram', 'insulat', 'concrete',
    'deck', 'siding', 'trim', 'door', 'window', 'bedroom', 'closet', 'addition',
  ],
};

// Whole-room keywords pull a mix of trades.
const MIXED_KEYWORDS = {
  kitchen: ['electrical', 'plumbing', 'general'],
  bath: ['plumbing', 'electrical', 'general'],
  bathroom: ['plumbing', 'electrical', 'general'],
  remodel: ['general', 'electrical', 'plumbing'],
  renovation: ['general', 'electrical', 'plumbing'],
};

const detectCategories = (spec, jobType) => {
  const categories = new Set();
  if (jobType && CATEGORY_KEYWORDS[jobType]) categories.add(jobType);
  if (jobType === 'remodel') ['general', 'electrical'].forEach((c) => categories.add(c));
  Object.entries(MIXED_KEYWORDS).forEach(([kw, cats]) => {
    if (spec.includes(kw)) cats.forEach((c) => categories.add(c));
  });
  Object.entries(CATEGORY_KEYWORDS).forEach(([cat, kws]) => {
    if (kws.some((kw) => spec.includes(kw))) categories.add(cat);
  });
  if (categories.size === 0) categories.add('general');
  return categories;
};

// Parse "3-bedroom" / "2 room" → room count (default 1).
const detectRooms = (spec) => {
  const m = spec.match(/(\d+)[ -]?(?:bed(?:room)?s?|rooms?)/);
  return m ? Math.max(1, parseInt(m[1], 10)) : 1;
};

// ---------- Composition heuristics ----------
// Trade rules of thumb, deliberately conservative. Each rule: id (catalog row),
// qty — number or (rooms) => number. Qtys reflect typical single-project use.
//
// NEC note: 20A circuits get 12 AWG copper (NEC 240.4(D)); 30A gets 10 AWG.
// We do NOT pair 14 AWG with 20A/30A breakers regardless of legacy examples.

const RULES = [
  {
    when: (spec) => spec.includes('panel'),
    items: [
      ['50000000-0000-4000-8000-000000000009', 1], // 200A Main Breaker Panel
      ['50000000-0000-4000-8000-000000000005', 20], // 20A breakers
      ['50000000-0000-4000-8000-000000000006', 4], // 30A breakers
      ['50000000-0000-4000-8000-000000000002', 2], // 12 AWG THHN spools
      ['50000000-0000-4000-8000-000000000019', 1], // 10/3 NM-B (30A runs)
      ['50000000-0000-4000-8000-000000000010', 5], // 1/2" PVC conduit
      ['50000000-0000-4000-8000-000000000012', 10], // conduit elbows
      ['50000000-0000-4000-8000-000000000020', 1], // wire nuts
      ['50000000-0000-4000-8000-000000000021', 2], // electrical tape
      ['50000000-0000-4000-8000-000000000026', 1], // 8ft ground rod
    ],
  },
  {
    when: (spec) => /kitchen/.test(spec),
    items: [
      ['50000000-0000-4000-8000-000000000013', 2], // GFCI (countertop, NEC 210.8)
      ['50000000-0000-4000-8000-000000000014', 4], // duplex outlets
      ['50000000-0000-4000-8000-000000000003', 6], // outlet boxes
      ['50000000-0000-4000-8000-000000000008', 1], // 50A double-pole (range)
      ['50000000-0000-4000-8000-000000000018', 1], // 12/2 NM-B roll
      ['50000000-0000-4000-8000-000000000019', 1], // 10/3 NM-B roll
    ],
  },
  {
    when: (spec) => /bath(room)?|shower|vanity|toilet/.test(spec),
    items: [
      ['50000000-0000-4000-8000-000000000024', 1], // bath exhaust fan
      ['50000000-0000-4000-8000-000000000013', 1], // GFCI (NEC 210.8(A))
      ['50000000-0000-4000-8000-000000000027', 2], // 1/2" PVC pipe
      ['50000000-0000-4000-8000-000000000028', 1], // 3/4" PVC pipe
    ],
  },
  {
    // Bedrooms / framing: per-room lumber, drywall, and devices.
    when: (spec) => /bed(room)?|fram|addition/.test(spec),
    items: [
      ['50000000-0000-4000-8000-000000000051', (rooms) => 10 * rooms], // 2x4x8 stud
      ['50000000-0000-4000-8000-000000000054', (rooms) => 6 * rooms], // drywall sheets
      ['50000000-0000-4000-8000-000000000003', (rooms) => 4 * rooms], // outlet boxes
      ['50000000-0000-4000-8000-000000000014', (rooms) => 4 * rooms], // duplex outlets
      ['50000000-0000-4000-8000-000000000015', (rooms) => 1 * rooms], // decora switch
      ['50000000-0000-4000-8000-000000000018', 1], // 12/2 NM-B roll
    ],
  },
];

// ---------- Public API ----------

// suggestMaterials('3-bedroom kitchen remodel with new panel', 'general')
// → { materials: [{ material_id, name, qty, unit, specification, unit_cost,
//     total_cost }], total_cost, category_breakdown }
const suggestMaterials = async (jobSpec = '', jobType) => {
  const spec = String(jobSpec).toLowerCase();
  const categories = detectCategories(spec, jobType);
  const rooms = detectRooms(spec);
  const catalog = await fetchCatalog();
  const byId = new Map(catalog.map((m) => [m.id, m]));

  // 1) Heuristic picks from trade rules.
  const picks = new Map(); // id -> qty
  RULES.forEach((rule) => {
    if (!rule.when(spec)) return;
    rule.items.forEach(([id, qty]) => {
      if (!byId.has(id)) return;
      const q = typeof qty === 'function' ? qty(rooms) : qty;
      picks.set(id, (picks.get(id) || 0) + q);
    });
  });

  // 2) Backfill: cheapest items from matched categories so the list is never
  //    empty for a recognized job (doc: query category IN (...) ORDER BY
  //    unit_cost ASC). Cap so a category doesn't flood the estimate.
  const matched = catalog
    .filter((m) => categories.has(m.category))
    .sort((a, b) => a.unit_cost - b.unit_cost);
  matched.slice(0, 8).forEach((m) => {
    if (!picks.has(m.id)) picks.set(m.id, 1);
  });

  const materials = Array.from(picks.entries()).map(([id, qty]) => {
    const m = byId.get(id);
    return {
      material_id: id,
      name: m.name,
      qty,
      unit: m.unit,
      specification: m.specification || null,
      category: m.category,
      unit_cost: m.unit_cost,
      total_cost: round2(qty * m.unit_cost),
    };
  });

  // Deterministic order: category, then unit_cost ascending.
  materials.sort((a, b) => (a.category === b.category
    ? a.unit_cost - b.unit_cost
    : String(a.category).localeCompare(String(b.category))));

  const categoryBreakdown = {};
  materials.forEach((m) => {
    categoryBreakdown[m.category] = round2((categoryBreakdown[m.category] || 0) + m.total_cost);
  });

  return {
    materials,
    total_cost: round2(materials.reduce((s, m) => s + m.total_cost, 0)),
    category_breakdown: categoryBreakdown,
  };
};

// getSupplierPricing([{ material_id, qty }]) → line-priced quote.
// Unknown material ids → structured error (never silently priced at 0).
const getSupplierPricing = async (materialList = []) => {
  const catalog = await fetchCatalog();
  const byId = new Map(catalog.map((m) => [m.id, m]));
  const unknown = materialList.filter((i) => !byId.has(i.material_id)).map((i) => i.material_id);
  if (unknown.length > 0) {
    return {
      error: {
        code: 'UNKNOWN_MATERIALS',
        message: `Unknown material_id(s): ${unknown.join(', ')}`,
        ids: unknown,
      },
    };
  }
  const materials = materialList.map((i) => {
    const m = byId.get(i.material_id);
    return {
      material_id: m.id,
      name: m.name,
      qty: i.qty,
      unit: m.unit,
      unit_cost: m.unit_cost,
      total_cost: round2(i.qty * m.unit_cost),
      in_stock: true, // MVP: no inventory tracking; Phase 2 adds real stock.
    };
  });
  return {
    materials,
    total_cost: round2(materials.reduce((s, m) => s + m.total_cost, 0)),
  };
};

// calculateOrderTotal(materials) → { subtotal, tax, total } with flat 8% tax.
const calculateOrderTotal = (materials = []) => {
  const subtotal = round2(materials.reduce((s, m) => s + (m.total_cost || 0), 0));
  const tax = round2(subtotal * TAX_RATE);
  return { subtotal, tax, total: round2(subtotal + tax) };
};

// validateMaterialList([{ material_id, qty }]) → { valid, errors }.
// Every id must exist in the catalog and every qty must be > 0.
const validateMaterialList = async (materials = []) => {
  const catalog = await fetchCatalog();
  const byId = new Map(catalog.map((m) => [m.id, m]));
  const errors = [];
  materials.forEach((i, idx) => {
    if (!i || typeof i !== 'object') {
      errors.push(`materials[${idx}] is not an object`);
      return;
    }
    if (!i.material_id || !byId.has(i.material_id)) {
      errors.push(`materials[${idx}].material_id "${i.material_id}" does not exist`);
    }
    if (typeof i.qty !== 'number' || !Number.isFinite(i.qty) || i.qty <= 0) {
      errors.push(`materials[${idx}].qty must be a number > 0 (got ${i.qty})`);
    }
  });
  return { valid: errors.length === 0, errors };
};

module.exports = {
  suggestMaterials,
  suggest_materials: suggestMaterials, // spec-doc naming alias
  getSupplierPricing,
  calculateOrderTotal,
  validateMaterialList,
  TAX_RATE,
  // exposed for tests
  setSupabase,
};
