// src/tools/registry.js
// Tool registry: maps tool name -> { definition, zodSchema, execute }.
// Executors are functional stubs for Phase 1: they validate input with Zod,
// best-effort write to tool_audit_log (tolerating the table being absent),
// and return structured placeholder results.

const { v4: uuidv4 } = require('uuid');
const { definitions } = require('./definitions');
const approvalStore = require('../services/approval-store');
const auditLogService = require('../services/audit-log');
const geo = require('../services/geo');
const twilioService = require('../services/twilio-service');
const checkinsStore = require('../services/checkins-store');
const activityStore = require('../services/activity-store');
const geofenceResolver = require('../services/geofence-resolver');
const materialsService = require('../services/materials-service');
const ordersService = require('../services/orders-service');
const { MATERIALS } = require('../services/materials-catalog');
const bidsStore = require('../services/bids-store');
const { insertAdaptive } = require('../services/pg-adapt');

// Tools that must never execute a real-world action without human sign-off.
const APPROVAL_GATED = new Set(['order_materials', 'assign_crew', 'schedule_crew']);

// Supabase is loaded lazily so this module never hard-crashes when env vars
// are missing (e.g. in tests). lib/supabase.js exits the process when env is
// absent, so the require is wrapped and only attempted on first use.
let supabaseClient = null;
let supabaseLoadAttempted = false;

const setSupabase = (client) => {
  supabaseClient = client;
  supabaseLoadAttempted = true;
  // Persistence services share the same (possibly mocked) client.
  approvalStore.setSupabase(client);
  auditLogService.setSupabase(client);
  checkinsStore.setSupabase(client);
  activityStore.setSupabase(client);
  geofenceResolver.setSupabase(client);
  materialsService.setSupabase(client);
  ordersService.setSupabase(client);
  bidsStore.setSupabase(client);
};

const getSupabase = () => {
  if (!supabaseLoadAttempted) {
    supabaseLoadAttempted = true;
    try {
      // eslint-disable-next-line global-require
      supabaseClient = require('../lib/supabase');
    } catch (err) {
      supabaseClient = null;
    }
  }
  return supabaseClient;
};

// Best-effort audit write. Missing table / any DB error falls back to the
// in-memory audit store (see src/services/audit-log.js).
const auditLog = async (entry) => {
  await auditLogService.write(entry);
};

// Persist a pending approval via the approval store (Supabase or memory);
// always returns an approval id so the gate result is retrievable.
const createApproval = async ({ tool_name, input, summary }, context = {}) => {
  const record = await approvalStore.create({
    tool_name,
    input,
    summary,
    project_id: (input && input.project_id) || context.project_id,
    requested_by: context.user_id,
  });
  return record.id;
};

// Structured tool error format — fed back to Claude so it can self-correct.
const toolError = (code, message, field) => ({
  error: { code, message, ...(field ? { field } : {}) },
});

const zodErrorToToolError = (zodError) => {
  // Zod v4 exposes .issues; fall back to .errors for v3 compatibility.
  const issues = zodError.issues || zodError.errors || [];
  const first = issues[0];
  return toolError(
    'VALIDATION_ERROR',
    first ? first.message : 'Invalid input',
    first && first.path && first.path.length ? first.path.join('.') : undefined,
  );
};

// Match a free-text description to a catalog row (best-effort, case-insensitive
// token overlap). Used to price agent-supplied items against the real catalog.
const matchCatalogItem = (description) => {
  const desc = String(description || '').toLowerCase();
  if (!desc) return null;
  let best = null;
  let bestScore = 0;
  MATERIALS.forEach((m) => {
    const tokens = m.name.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
    const score = tokens.filter((t) => desc.includes(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  });
  return bestScore >= 1 ? best : null;
};

const round2 = (n) => Math.round(n * 100) / 100;

// ---------- Placeholder result builders ----------

const placeholderResults = {
  analyze_blueprints: (input) => ({
    project_id: input.project_id,
    files_analyzed: input.file_urls.length,
    findings: {
      rooms: [],
      circuits: [],
      panels: [],
      notes: 'Blueprint analysis placeholder — vision pipeline not wired yet.',
    },
    confidence: 0.5,
  }),

  generate_scope_doc: (input) => ({
    project_id: input.project_id,
    scope_doc_id: uuidv4(),
    sections: input.scope_items.map((item, i) => ({ order: i + 1, description: item })),
    status: 'draft',
  }),

  estimate_materials: (input) => {
    const lineItems = input.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_cost: item.unit_cost !== undefined ? item.unit_cost : null,
      extended_cost: item.unit_cost !== undefined ? round2(item.quantity * item.unit_cost) : null,
      pricing_source: item.unit_cost !== undefined ? 'provided' : 'unpriced',
    }));
    const priced = lineItems.filter((li) => li.extended_cost !== null);
    const totalCost = priced.length > 0 ? round2(priced.reduce((sum, li) => sum + li.extended_cost, 0)) : null;
    return {
      project_id: input.project_id,
      line_items: lineItems,
      total_cost: totalCost,
      currency: 'USD',
      confidence: totalCost !== null ? 0.6 : 0.3,
      note: 'Placeholder estimate — supplier pricing not connected yet.',
    };
  },

  estimate_labor: (input) => {
    const lineItems = input.tasks.map((task) => ({
      description: task.description,
      role: task.role || 'journeyman',
      hours: task.hours,
      rate: task.rate !== undefined ? task.rate : null,
      cost: task.rate !== undefined ? round2(task.hours * task.rate) : null,
    }));
    const rated = lineItems.filter((li) => li.cost !== null);
    const totalHours = round2(lineItems.reduce((sum, li) => sum + li.hours, 0));
    const totalCost = rated.length > 0 ? round2(rated.reduce((sum, li) => sum + li.cost, 0)) : null;
    return {
      project_id: input.project_id,
      line_items: lineItems,
      total_hours: totalHours,
      total_cost: totalCost,
      currency: 'USD',
      confidence: totalCost !== null ? 0.6 : 0.3,
    };
  },

  generate_bid_doc: (input) => ({
    project_id: input.project_id,
    bid_doc_id: uuidv4(),
    status: 'draft',
    markup_percent: input.markup_percent !== undefined ? input.markup_percent : null,
    note: 'Draft bid document generated — requires human review before sending to customer.',
  }),

  create_phase: (input) => ({
    project_id: input.project_id,
    phase_id: uuidv4(),
    name: input.name,
    start_date: input.start_date,
    end_date: input.end_date,
    depends_on: input.depends_on || [],
    status: 'created',
    persisted: false,
    note: 'Phase placeholder — phases table lands in migration 007.',
  }),

  check_conflicts: (input) => ({
    project_id: input.project_id,
    window: { start_date: input.start_date, end_date: input.end_date },
    conflicts: [],
    checked_crew: input.crew_member_ids || 'all',
    note: 'Conflict check placeholder — no schedule data source connected yet.',
  }),

  alert_team: (input) => ({
    project_id: input.project_id,
    alert_id: uuidv4(),
    message: input.message,
    severity: input.severity || 'info',
    recipients: input.recipient_ids || 'all_project_members',
    status: 'queued',
  }),

  suggest_materials: (input) => ({
    project_id: input.project_id,
    scope_item: input.scope_item,
    suggestions: [],
    alternates: [],
    note: 'Material suggestion placeholder — catalog not connected yet.',
  }),

  get_supplier_pricing: (input) => ({
    supplier: input.supplier || 'default',
    quotes: input.items.map((item) => ({
      description: item.description,
      sku: item.sku || null,
      quantity: item.quantity,
      unit_price: null,
      availability: 'unknown',
    })),
    note: 'Supplier pricing placeholder — no supplier API connected yet.',
  }),

  track_delivery: (input) => ({
    purchase_order_id: input.purchase_order_id,
    status: 'unknown',
    eta: null,
    note: 'Delivery tracking placeholder — purchase orders table not available yet.',
  }),

  consolidate_orders: (input) => ({
    project_id: input.project_id,
    consolidated_groups: [],
    orders_considered: input.order_ids || [],
    note: 'Order consolidation placeholder — purchase orders table not available yet.',
  }),

  update_job_status: (input) => ({
    project_id: input.project_id,
    status: input.status,
    note: input.note || null,
    applied: false,
    message: 'Status update placeholder — job status persistence not wired yet.',
  }),
};

// ---------- Real executors (week 4) ----------
// Wired to live services: geo math, checkins/activity stores, Twilio.
// These are async (unlike the sync placeholders) and are awaited by the
// registry dispatch below.

const realExecutors = {
  geofence_check: async (input) => {
    const fence = await geofenceResolver.resolveGeofence(input.project_id);
    if (!fence) {
      return {
        project_id: input.project_id,
        within_geofence: null,
        verification_status: 'unverified_no_geofence',
        note: 'No geofence configured for this project (checked phases, bids, projects).',
      };
    }
    const check = geo.geofenceCheck(
      { lat: input.latitude, lng: input.longitude },
      fence,
      input.accuracy_m,
    );
    if (check.error) return toolError(check.error.code, check.error.message);
    return {
      project_id: input.project_id,
      within_geofence: check.inside,
      distance_meters: check.distance_m,
      radius_m: check.radius_m,
      confidence: check.confidence,
      reasons: check.reasons,
      geofence_source: fence.source,
    };
  },

  verify_checkin: async (input) => {
    const row = await checkinsStore.get(input.checkin_id);
    if (!row) {
      return toolError('CHECKIN_NOT_FOUND', `Check-in ${input.checkin_id} not found.`);
    }
    const projectId = row.project_id || input.project_id;
    const fence = projectId ? await geofenceResolver.resolveGeofence(projectId) : null;
    if (!fence) {
      return {
        checkin_id: row.id,
        verified: null,
        verification_status: 'unverified_no_geofence',
        previous_verified: row.verified !== undefined ? row.verified : null,
      };
    }
    const coords = geo.validateCoords(row.lat, row.lng);
    if (!coords) {
      return {
        checkin_id: row.id,
        verified: null,
        verification_status: 'unverifiable_no_coords',
        previous_verified: row.verified !== undefined ? row.verified : null,
      };
    }
    const check = geo.geofenceCheck(coords, fence, row.accuracy_m);
    if (check.error) return toolError(check.error.code, check.error.message);
    return {
      checkin_id: row.id,
      worker_id: row.worker_id || null,
      project_id: projectId,
      verified: check.inside,
      distance_m: check.distance_m,
      confidence: check.confidence,
      reasons: check.reasons,
      previous_verified: row.verified !== undefined ? row.verified : null,
    };
  },

  log_activity: async (input) => {
    const { record, persisted } = await activityStore.create({
      project_id: input.project_id,
      crew_member_id: input.crew_member_id || null,
      activity: input.activity,
      hours: input.hours,
    });
    return {
      project_id: input.project_id,
      activity_id: record.id,
      activity: record.activity,
      crew_member_id: record.crew_member_id,
      hours: record.hours,
      status: 'logged',
      persisted,
    };
  },

  notify_via_twilio: async (input) => {
    try {
      const res = await twilioService.sendSms(input.to_phone, input.message);
      return {
        to_phone: res.to,
        message_sid: res.sid,
        status: res.status,
        project_id: input.project_id || null,
      };
    } catch (err) {
      // twilio-service errors are already structured + scrubbed of env values.
      return toolError(err.code || 'TWILIO_ERROR', err.message);
    }
  },

  // ---------- Ordering layer (week 5) ----------

  suggest_materials: async (input) => {
    const result = await materialsService.suggestMaterials(input.scope_item, input.job_type);
    return {
      project_id: input.project_id,
      scope_item: input.scope_item,
      suggestions: result.materials,
      alternates: [],
      total_cost: result.total_cost,
      category_breakdown: result.category_breakdown,
    };
  },

  get_supplier_pricing: async (input) => ({
    supplier: input.supplier || 'home_depot',
    quotes: input.items.map((item) => {
      const match = matchCatalogItem(item.description);
      return {
        description: item.description,
        sku: item.sku || null,
        quantity: item.quantity,
        unit_price: match ? match.unit_cost : null,
        total_price: match ? round2(item.quantity * match.unit_cost) : null,
        material_id: match ? match.id : null,
        availability: match ? 'in_stock' : 'unknown',
      };
    }),
  }),

  estimate_materials: async (input) => {
    const lineItems = input.items.map((item) => {
      const match = item.unit_cost === undefined ? matchCatalogItem(item.description) : null;
      const unitCost = item.unit_cost !== undefined ? item.unit_cost : (match ? match.unit_cost : null);
      return {
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_cost: unitCost,
        extended_cost: unitCost != null ? round2(item.quantity * unitCost) : null,
        material_id: match ? match.id : null,
        pricing_source: item.unit_cost !== undefined ? 'provided' : (match ? 'catalog' : 'unpriced'),
      };
    });
    const priced = lineItems.filter((li) => li.extended_cost !== null);
    const totalCost = priced.length > 0 ? round2(priced.reduce((s, li) => s + li.extended_cost, 0)) : null;
    return {
      project_id: input.project_id,
      line_items: lineItems,
      total_cost: totalCost,
      currency: 'USD',
      confidence: priced.length === lineItems.length ? 0.8 : 0.4,
    };
  },

  track_delivery: async (input) => {
    const order = await ordersService.getOrder(input.purchase_order_id);
    if (!order) {
      return toolError('ORDER_NOT_FOUND', `Order ${input.purchase_order_id} not found.`);
    }
    return {
      purchase_order_id: order.id,
      status: order.status,
      supplier: order.supplier,
      eta: order.eta || null,
      tracking_number: order.tracking_number || null,
      items_count: order.items.length,
      total_cost: order.total_cost,
    };
  },

  // ---------- Bidding + scheduling layer (week 6) ----------

  // SOW text generation from scope items — keyword parsing shared with the
  // materials service so scope/trade detection stays consistent.
  generate_scope_doc: async (input) => {
    const items = input.scope_items.filter((s) => typeof s === 'string' && s.trim().length > 0);
    if (items.length === 0) {
      return toolError('VALIDATION_ERROR', 'scope_items must contain at least one non-empty item');
    }
    const spec = items.join('; ');
    const materialsPreview = await materialsService.suggestMaterials(spec);
    const categories = Object.keys(materialsPreview.category_breakdown);
    const complexity = items.length >= 6 || categories.length >= 3 ? 'high'
      : items.length >= 3 || categories.length === 2 ? 'medium' : 'low';
    const scopeDoc = [
      'SCOPE OF WORK',
      `Project: ${input.project_id}`,
      `Trades: ${categories.join(', ')}`,
      '',
      ...items.map((s, i) => `${i + 1}. ${s}`),
      '',
      `Materials outlook: $${materialsPreview.total_cost} across ${categories.length} trade(s).`,
      input.notes ? `Notes: ${input.notes}` : null,
    ].filter(Boolean).join('\n');
    return {
      project_id: input.project_id,
      scope_doc_id: uuidv4(),
      scope_doc: scopeDoc,
      sections: items.map((s, i) => ({ order: i + 1, description: s })),
      item_count: items.length,
      estimated_complexity: complexity,
      status: 'draft',
    };
  },

  // MVP labor rates (doc): general $50/hr, electrical $75/hr. Explicit
  // per-task rate always wins; role 'electrician' implies the electrical rate.
  estimate_labor: async (input) => {
    const rateFor = (task) => {
      if (task.rate !== undefined && task.rate !== null) return task.rate;
      return /electr/i.test(String(task.role || '')) ? 75 : 50;
    };
    const lineItems = input.tasks.map((task) => {
      const rate = rateFor(task);
      return {
        description: task.description,
        role: task.role || 'general',
        hours: task.hours,
        rate,
        cost: round2(task.hours * rate),
      };
    });
    const totalHours = round2(lineItems.reduce((s, li) => s + li.hours, 0));
    const totalCost = round2(lineItems.reduce((s, li) => s + li.cost, 0));
    return {
      project_id: input.project_id,
      phases: lineItems,
      total_hours: totalHours,
      total_cost: totalCost,
      currency: 'USD',
      rates: { general: 50, electrical: 75 },
      confidence: 0.75,
    };
  },

  // Compose the bid from upstream estimates, persist a DRAFT bid row, and
  // open a pending approval — winning the bid is always a human decision
  // (/api/agent/approvals/:id/approve marks it won).
  generate_bid_doc: async (input, context = {}) => {
    const num = (v) => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'number') return v;
      if (typeof v === 'object' && typeof v.total_cost === 'number') return v.total_cost;
      if (typeof v === 'object' && typeof v.total === 'number') return v.total;
      return null;
    };
    const materialsCost = num(input.material_estimate);
    const laborCost = num(input.labor_estimate);
    const pct = input.markup_percent !== undefined && input.markup_percent !== null
      ? input.markup_percent : 10;
    const base = (materialsCost || 0) + (laborCost || 0);
    const contingencyAmount = round2((base * pct) / 100);
    const totalEstimate = base > 0 ? round2(base + contingencyAmount) : null;

    const { bid, persisted } = await bidsStore.createBid({
      project_id: input.project_id,
      title: `Bid for project ${input.project_id}`,
      scope_doc_id: input.scope_doc_id || null,
      markup_percent: pct,
      materials_cost: materialsCost,
      labor_cost: laborCost,
      contingency_amount: base > 0 ? contingencyAmount : null,
      total: totalEstimate,
      created_by: context.user_id || null,
    });

    const summary = `Bid for project ${input.project_id}`
      + (totalEstimate != null ? ` — $${totalEstimate} (materials $${materialsCost || 0} + labor $${laborCost || 0} + ${pct}% contingency $${contingencyAmount})` : '');
    const approvalId = await createApproval({
      tool_name: 'generate_bid_doc',
      input: { ...input, bid_id: bid.id },
      summary,
    }, context);

    return {
      project_id: input.project_id,
      bid_doc_id: bid.id,
      bid_id: bid.id,
      status: 'draft',
      approval_id: approvalId,
      persisted,
      total_estimate: totalEstimate,
      breakdown: {
        materials: materialsCost,
        labor: laborCost,
        contingency_pct: pct,
        contingency_amount: base > 0 ? contingencyAmount : null,
      },
      note: 'Draft bid document generated — requires human review before sending to customer.',
    };
  },

  // MVP: constant mock specs (Phase 2 does real PDF extraction).
  analyze_blueprints: async (input) => ({
    project_id: input.project_id,
    files_analyzed: input.file_urls.length,
    focus: input.focus || null,
    dimensions: { rooms: 3, sqft: 2400 },
    fixtures: 15,
    complexity_score: 7,
    note: 'MVP mock specs — Phase 2 does real PDF parsing.',
  }),

  create_phase: async (input) => {
    if (input.end_date <= input.start_date) {
      return toolError('VALIDATION_ERROR', 'end_date must be after start_date', 'end_date');
    }
    const phase = {
      id: uuidv4(),
      project_id: input.project_id,
      name: input.name,
      status: 'planned',
      start_date: input.start_date,
      end_date: input.end_date,
      depends_on: input.depends_on || [],
      created_at: new Date().toISOString(),
    };
    let persisted = false;
    if (getSupabase()) {
      try {
        const result = await insertAdaptive(getSupabase(), 'phases', phase);
        persisted = result.ok;
      } catch (err) {
        persisted = false;
      }
    }
    const durationDays = Math.round(
      (Date.parse(input.end_date) - Date.parse(input.start_date)) / 86400000,
    );
    return {
      project_id: input.project_id,
      phase_id: phase.id,
      name: phase.name,
      status: 'planned',
      start_date: phase.start_date,
      end_date: phase.end_date,
      duration_days: durationDays,
      persisted,
    };
  },

  // Overlap detection over the project's phases (+ crew assignments when the
  // table exists): two windows conflict when start <= other.end && end >=
  // other.start.
  check_conflicts: async (input) => {
    const selectRows = async (table, col, val) => {
      if (!getSupabase()) return [];
      try {
        const { data, error } = await getSupabase().from(table).select('*').eq(col, val).limit(50);
        return error ? [] : (data || []);
      } catch (err) {
        return [];
      }
    };
    const phases = await selectRows('phases', 'project_id', input.project_id);
    const overlaps = phases.filter((p) => p.start_date && p.end_date
      && p.start_date <= input.end_date && p.end_date >= input.start_date);

    let crewRows = [];
    const crewIds = input.crew_member_ids || [];
    if (crewIds.length > 0) {
      try {
        const { data, error } = await getSupabase()
          .from('phase_crew_assignments').select('*').in('crew_member_id', crewIds).limit(100);
        if (!error && data) crewRows = data;
      } catch (err) {
        crewRows = [];
      }
    }

    const conflicts = overlaps.map((p) => ({
      job_id: p.project_id,
      phase_id: p.id,
      phase_name: p.name,
      dates: { start_date: p.start_date, end_date: p.end_date },
      crew_members: crewRows.filter((c) => c.phase_id === p.id).map((c) => c.crew_member_id),
    }));
    return {
      project_id: input.project_id,
      window: { start_date: input.start_date, end_date: input.end_date },
      conflicts,
      has_conflicts: conflicts.length > 0,
    };
  },

  // Consolidate draft orders: sum qty per material across orders; materials
  // sourced from 2+ orders get a 5% bulk discount (MVP math; Phase 2 does
  // real supplier negotiation).
  consolidate_orders: async (input) => {
    let orders = [];
    if (input.order_ids && input.order_ids.length > 0) {
      const fetched = await Promise.all(input.order_ids.map((id) => ordersService.getOrder(id)));
      orders = fetched.filter(Boolean);
    } else {
      orders = await ordersService.listOrders({ project_id: input.project_id, status: 'draft' });
      orders = await Promise.all(orders.map((o) => ordersService.getOrder(o.order_id)));
      orders = orders.filter(Boolean);
    }
    const byMaterial = new Map(); // key -> { material_id, name, unit_cost, total_qty, separate_cost, orders:Set }
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const key = item.material_id || `desc:${item.name}`;
        const entry = byMaterial.get(key) || {
          material_id: item.material_id || null,
          name: item.name,
          unit_cost: item.unit_cost,
          total_qty: 0,
          separate_cost: 0,
          orders: new Set(),
        };
        entry.total_qty += Number(item.qty) || 0;
        entry.separate_cost += item.total_cost != null ? Number(item.total_cost) : 0;
        entry.orders.add(order.id);
        byMaterial.set(key, entry);
      });
    });
    const consolidated = Array.from(byMaterial.values()).map((e) => {
      const discounted = e.orders.size >= 2;
      const consolidatedCost = discounted ? round2(e.separate_cost * 0.95) : round2(e.separate_cost);
      return {
        material_id: e.material_id,
        name: e.name,
        total_qty: e.total_qty,
        separate_cost: round2(e.separate_cost),
        consolidated_cost: consolidatedCost,
        savings: round2(e.separate_cost - consolidatedCost),
        bulk_discount_applied: discounted,
      };
    });
    return {
      project_id: input.project_id,
      orders_considered: orders.map((o) => o.id),
      consolidated_materials: consolidated,
      total_savings: round2(consolidated.reduce((s, c) => s + c.savings, 0)),
      note: 'MVP calculation (5% bulk on materials from 2+ orders); Phase 2 negotiates real supplier pricing.',
    };
  },
};

// Approval-gated executors: never perform the action — return a pending approval.
const approvalExecutors = {
  order_materials: async (input, context = {}) => {
    // Create a REAL draft order from the (free-text) tool items so the
    // approval queue and /api/orders see the same record. Catalog ids are
    // unknown at this layer — lines keep descriptions; unit_cost used when
    // the caller supplied it.
    const lines = input.items.map((i) => {
      const match = matchCatalogItem(i.description);
      const unitCost = i.unit_cost !== undefined ? i.unit_cost : (match ? match.unit_cost : null);
      return {
        material_id: match ? match.id : null,
        name: match ? match.name : i.description,
        qty: i.quantity,
        unit_cost: unitCost,
        total_cost: unitCost != null ? round2(i.quantity * unitCost) : null,
      };
    });
    const draft = await ordersService.createOrderFromLines({
      account_id: input.account_id || null,
      project_id: input.project_id,
      supplier: input.supplier || 'home_depot',
      lines,
      created_by: context.user_id || null,
    });
    const itemList = input.items.map((i) => i.description).join(', ');
    const summary = `Order ${input.items.length} item(s) (${itemList})${input.supplier ? ` from ${input.supplier}` : ''}`
      + ` for project ${input.project_id}`
      + (draft.total_cost != null ? ` — est. $${draft.total_cost}` : '');
    const approvalId = await createApproval({
      tool_name: 'order_materials',
      input: { ...input, order_id: draft.order_id },
      summary,
    }, context);
    return {
      status: 'pending_approval',
      approval_id: approvalId,
      order_id: draft.order_id,
      draft_total_cost: draft.total_cost,
      summary,
    };
  },

  assign_crew: async (input, context = {}) => {
    const summary = `Assign ${input.crew_member_ids.length} crew member(s) to phase ${input.phase_id} on project ${input.project_id}`;
    const approvalId = await createApproval({ tool_name: 'assign_crew', input, summary }, context);
    return { status: 'pending_approval', approval_id: approvalId, summary };
  },

  schedule_crew: async (input, context = {}) => {
    const summary = `Schedule ${input.crew_member_ids.length} crew member(s) on ${input.date}`
      + `${input.start_time ? ` at ${input.start_time}` : ''} for project ${input.project_id}`;
    const approvalId = await createApproval({ tool_name: 'schedule_crew', input, summary }, context);
    return { status: 'pending_approval', approval_id: approvalId, summary };
  },
};

// Executors run after a human approves a gated action (via /api/agent/approvals/:id/approve).
// Phase 1 placeholders: the real supplier/crew/scheduling side effects land in
// later weeks — the approval workflow around them is fully live.
const approvedActionExecutors = {
  // Winning a bid is the approved action for generate_bid_doc approvals.
  generate_bid_doc: async (input) => {
    if (!input.bid_id) {
      return toolError('VALIDATION_ERROR', 'approval input has no bid_id to mark won');
    }
    const result = await bidsStore.markWon(input.bid_id, input.user_id || null);
    if (result.error) return result;
    return {
      status: 'executed',
      bid_id: input.bid_id,
      bid_status: 'won',
      already_won: result.alreadyWon,
      note: 'Bid marked won.',
    };
  },

  order_materials: async (input) => {
    // Convergence: the gate created a real draft order and stored its id on
    // the approval input — approving submits that same order.
    if (input.order_id) {
      const submitted = await ordersService.submitOrder(input.order_id, input.user_id || null);
      if (submitted.error) return submitted;
      return {
        status: 'executed',
        order_id: submitted.order_id,
        order_status: submitted.status,
        items_count: submitted.items_count,
        total_cost: submitted.total_cost,
        note: 'Order submitted to Home Depot (Phase 2)',
      };
    }
    // Legacy approvals (created before the ordering layer) have no order_id.
    return {
      status: 'executed',
      project_id: input.project_id,
      supplier: input.supplier || null,
      items: input.items,
      note: 'Legacy approval without order_id — no draft order to submit.',
    };
  },

  assign_crew: async (input) => ({
    status: 'executed',
    assignment_id: uuidv4(),
    project_id: input.project_id,
    phase_id: input.phase_id,
    crew_member_ids: input.crew_member_ids,
    note: 'Placeholder execution — crew assignment persistence lands with migrations 007-010.',
  }),

  schedule_crew: async (input) => ({
    status: 'executed',
    schedule_id: uuidv4(),
    project_id: input.project_id,
    crew_member_ids: input.crew_member_ids,
    date: input.date,
    start_time: input.start_time || null,
    note: 'Placeholder execution — scheduling persistence lands with migrations 007-010.',
  }),
};

// ---------- Registry ----------

const registry = new Map();

definitions.forEach((def) => {
  const execute = async (rawInput, context = {}) => {
    const parsed = def.zodSchema.safeParse(rawInput);
    if (!parsed.success) {
      const errResult = zodErrorToToolError(parsed.error);
      await auditLog({
        tool_name: def.name,
        input: rawInput,
        output: errResult,
        status: 'validation_error',
        project_id: context.project_id,
      });
      return errResult;
    }

    const input = parsed.data;
    let result;
    if (APPROVAL_GATED.has(def.name)) {
      result = await approvalExecutors[def.name](input, context);
    } else if (realExecutors[def.name]) {
      result = await realExecutors[def.name](input, context);
    } else {
      result = placeholderResults[def.name](input);
    }

    await auditLog({
      tool_name: def.name,
      input,
      output: result,
      status: result && result.status === 'pending_approval' ? 'pending_approval' : 'ok',
      project_id: context.project_id || input.project_id,
    });

    return result;
  };

  registry.set(def.name, {
    name: def.name,
    description: def.description,
    input_schema: def.input_schema,
    zodSchema: def.zodSchema,
    execute,
  });
});

const getTool = (name) => registry.get(name);

// Execute a tool's real action after human approval, bypassing the approval
// gate. Validates input with the tool's Zod schema and writes an audit entry.
const executeApproved = async (name, rawInput, context = {}) => {
  const tool = registry.get(name);
  if (!tool) {
    return toolError('UNKNOWN_TOOL', `No tool named "${name}" is available.`);
  }
  const parsed = tool.zodSchema.safeParse(rawInput);
  if (!parsed.success) {
    return zodErrorToToolError(parsed.error);
  }
  const input = parsed.data;
  let result;
  if (APPROVAL_GATED.has(name) || approvedActionExecutors[name]) {
    // Pass rawInput (post-validation) so extra fields the gate stored —
    // e.g. order_id on order_materials — survive zod's key stripping.
    result = await approvedActionExecutors[name](rawInput);
  } else if (realExecutors[name]) {
    result = await realExecutors[name](input, context);
  } else {
    result = placeholderResults[name](input);
  }
  await auditLog({
    tool_name: name,
    input,
    output: result,
    status: 'approved_executed',
    project_id: context.project_id || input.project_id,
    approval_id: context.approval_id,
    actor: context.user_id,
  });
  return result;
};

const listTools = () => Array.from(registry.keys());

// Tool definitions in the exact shape the Anthropic API expects.
const getToolDefinitions = () =>
  definitions.map(({ name, description, input_schema }) => ({ name, description, input_schema }));

module.exports = {
  getTool,
  listTools,
  getToolDefinitions,
  APPROVAL_GATED,
  executeApproved,
  // exposed for tests
  setSupabase,
  toolError,
};
