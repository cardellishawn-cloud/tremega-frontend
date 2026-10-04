// src/services/orders-service.js
// Order lifecycle for the ordering layer: create (draft) → approve (submit) →
// track. Persists to orders + order_items (db/migrations/011_orders.sql) when
// Supabase is reachable; otherwise in-memory with the same cached-but-retryable
// pattern as approval-store. Audit events go to audit_events (same fallback).
//
// Money: orders.total_cost is the pre-tax materials sum (matches
// materials-service.getSupplierPricing). Tax is informational only
// (materials-service.calculateOrderTotal) and never persisted.

const { v4: uuidv4 } = require('uuid');
const materialsService = require('./materials-service');
const { insertAdaptive, updateAdaptive } = require('./pg-adapt');

const RETRY_AFTER_MS = 60 * 1000;

// ---------- Injectable / lazy Supabase ----------

let supabaseClient = null;
let supabaseLoadAttempted = false;
let memoryModeSince = null;

const setSupabase = (client) => {
  supabaseClient = client;
  supabaseLoadAttempted = true;
  memoryModeSince = null;
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

const shouldTrySupabase = () => {
  if (!getSupabase()) return false;
  if (memoryModeSince === null) return true;
  if (Date.now() - memoryModeSince > RETRY_AFTER_MS) {
    memoryModeSince = null;
    return true;
  }
  return false;
};

const enterMemoryMode = (op, error) => {
  const firstTime = memoryModeSince === null;
  memoryModeSince = Date.now();
  if (firstTime) {
    console.warn(`orders-service: ${op} falling back to memory (${error.message})`);
  }
};

// ---------- In-memory fallback ----------

const memoryOrders = new Map(); // id -> order row
const memoryItems = new Map(); // order_id -> [item rows]
const memoryAudit = []; // audit_events rows

// Attempt fn() against Supabase; on any failure fall back to memoryFn().
const withStore = async (op, supabaseFn, memoryFn) => {
  if (shouldTrySupabase()) {
    try {
      const result = await supabaseFn(getSupabase());
      if (result && result.error) {
        if (looksLikeMissingTable(result.error)) enterMemoryMode(op, result.error);
        else console.warn(`orders-service: supabase ${op} failed (${result.error.message}); using memory`);
        return memoryFn();
      }
      return result;
    } catch (err) {
      enterMemoryMode(op, err);
      return memoryFn();
    }
  }
  return memoryFn();
};

// ---------- Audit events ----------

const writeAudit = async ({ action, actor_id, entity, entity_id, detail }) => {
  const row = {
    id: uuidv4(),
    action,
    actor_id: actor_id || null,
    entity: entity || 'order',
    entity_id: entity_id || null,
    detail: detail || {},
    created_at: new Date().toISOString(),
  };
  await withStore(
    'audit',
    async (sb) => {
      const result = await insertAdaptive(sb, 'audit_events', row);
      return result.ok ? { data: row } : { error: result.error };
    },
    () => memoryAudit.push(row),
  );
  return row;
};

// ---------- Public API ----------

// createOrder({ account_id, project_id, materials: [{ material_id, qty }],
//               supplier, created_by })
// Validates ids against the catalog, prices lines server-side (client-sent
// prices are never trusted), persists draft order + items, writes audit.
const createOrder = async ({ account_id, project_id = null, materials, supplier = 'home_depot', created_by = null }) => {
  const validation = await materialsService.validateMaterialList(materials);
  if (!validation.valid) {
    return { error: { code: 'VALIDATION_ERROR', message: validation.errors.join('; ') } };
  }
  const priced = await materialsService.getSupplierPricing(materials);
  if (priced.error) return { error: priced.error };

  const now = new Date().toISOString();
  const order = {
    id: uuidv4(),
    account_id,
    project_id,
    supplier,
    status: 'draft',
    total_cost: priced.total_cost,
    reason: null,
    created_by,
    created_at: now,
    updated_at: now,
    submitted_at: null,
    rejected_at: null,
    eta: null,
    tracking_number: null,
  };
  const items = priced.materials.map((m) => ({
    id: uuidv4(),
    order_id: order.id,
    material_id: m.material_id,
    name: m.name,
    qty: m.qty,
    unit_cost: m.unit_cost,
    total_cost: m.total_cost,
    created_at: now,
  }));

  await withStore(
    'create',
    async (sb) => {
      const orderResult = await insertAdaptive(sb, 'orders', order);
      if (!orderResult.ok) return { error: orderResult.error };
      for (const item of items) {
        // eslint-disable-next-line no-await-in-loop
        const itemResult = await insertAdaptive(sb, 'order_items', item);
        if (!itemResult.ok) return { error: itemResult.error };
      }
      return { data: order };
    },
    () => {
      memoryOrders.set(order.id, order);
      memoryItems.set(order.id, items);
    },
  );

  await writeAudit({
    action: 'order_created',
    actor_id: created_by,
    entity: 'order',
    entity_id: order.id,
    detail: { total_cost: order.total_cost, item_count: items.length, supplier },
  });

  return { order_id: order.id, status: 'draft', materials: priced.materials, total_cost: order.total_cost };
};

// createOrderFromLines: draft order from pre-priced lines (agent tool path,
// where items arrive as free-text descriptions rather than catalog ids).
// Lines: [{ material_id|null, name, qty, unit_cost|null, total_cost|null }].
const createOrderFromLines = async ({ account_id = null, project_id = null, supplier = 'home_depot', lines, created_by = null }) => {
  const now = new Date().toISOString();
  const items = lines.map((l) => ({
    id: uuidv4(),
    order_id: null, // set below
    material_id: l.material_id || null,
    name: l.name,
    qty: l.qty,
    unit_cost: l.unit_cost != null ? l.unit_cost : null,
    total_cost: l.total_cost != null ? l.total_cost : null,
    created_at: now,
  }));
  const known = items.filter((i) => i.total_cost != null);
  const order = {
    id: uuidv4(),
    account_id,
    project_id,
    supplier,
    status: 'draft',
    total_cost: known.length > 0 ? Math.round(known.reduce((s, i) => s + i.total_cost, 0) * 100) / 100 : null,
    reason: null,
    created_by,
    created_at: now,
    updated_at: now,
    submitted_at: null,
    rejected_at: null,
    eta: null,
    tracking_number: null,
  };
  items.forEach((i) => { i.order_id = order.id; });
  await withStore(
    'createFromLines',
    async (sb) => {
      const orderResult = await insertAdaptive(sb, 'orders', order);
      if (!orderResult.ok) return { error: orderResult.error };
      for (const item of items) {
        // eslint-disable-next-line no-await-in-loop
        const itemResult = await insertAdaptive(sb, 'order_items', item);
        if (!itemResult.ok) return { error: itemResult.error };
      }
      return { data: order };
    },
    () => {
      memoryOrders.set(order.id, order);
      memoryItems.set(order.id, items);
    },
  );
  await writeAudit({
    action: 'order_created',
    actor_id: created_by,
    entity: 'order',
    entity_id: order.id,
    detail: { total_cost: order.total_cost, item_count: items.length, supplier, source: 'agent_tool' },
  });
  return { order_id: order.id, status: 'draft', total_cost: order.total_cost, item_count: items.length };
};

const getOrder = async (orderId) => {
  // Shadow-store behavior during migration: a Supabase miss (error OR null
  // row) falls through to memory, so orders created before the tables/key
  // worked are still found.
  const order = await withStore(
    'get',
    async (sb) => {
      const { data, error } = await sb.from('orders').select('*').eq('id', orderId).single();
      return error ? { error } : { data };
    },
    () => memoryOrders.get(orderId) || null,
  );
  let row = order && order.data !== undefined ? order.data : order;
  if (!row) row = memoryOrders.get(orderId) || null;
  if (!row) return null;
  const items = await withStore(
    'getItems',
    async (sb) => {
      const { data, error } = await sb.from('order_items').select('*').eq('order_id', orderId);
      return error ? { error } : { data: data || [] };
    },
    () => memoryItems.get(orderId) || [],
  );
  let itemRows = items && items.data !== undefined ? items.data : items;
  if (!itemRows || (itemRows.length === 0 && !shouldTrySupabase())) {
    itemRows = memoryItems.get(orderId) || [];
  }
  return { ...row, items: itemRows };
};

// draft → submitted. Actor + audit recorded by the caller-facing routes and
// the approval executor alike, so both approval paths converge.
const submitOrder = async (orderId, actorId = null) => {
  const order = await getOrder(orderId);
  if (!order) return { error: { code: 'ORDER_NOT_FOUND', message: `Order ${orderId} not found` } };
  if (order.status !== 'draft') {
    return {
      error: {
        code: 'INVALID_STATE',
        message: `Order ${orderId} is ${order.status}; only draft orders can be submitted`,
      },
    };
  }
  const now = new Date().toISOString();
  const patch = { status: 'submitted', submitted_at: now, updated_at: now };
  await withStore(
    'submit',
    async (sb) => {
      const result = await updateAdaptive(sb, 'orders', patch, [{ col: 'id', val: orderId }]);
      return result.ok ? { data: result.patch } : { error: result.error };
    },
    () => memoryOrders.set(orderId, { ...memoryOrders.get(orderId), ...patch }),
  );
  await writeAudit({
    action: 'order_approved',
    actor_id: actorId,
    entity: 'order',
    entity_id: orderId,
    detail: { total_cost: order.total_cost, item_count: order.items.length },
  });
  return { order_id: orderId, status: 'submitted', submitted_at: now, items_count: order.items.length, total_cost: order.total_cost };
};

// draft → rejected (terminal). Reason required by the route layer.
const rejectOrder = async (orderId, reason, actorId = null) => {
  const order = await getOrder(orderId);
  if (!order) return { error: { code: 'ORDER_NOT_FOUND', message: `Order ${orderId} not found` } };
  if (order.status !== 'draft') {
    return {
      error: {
        code: 'INVALID_STATE',
        message: `Order ${orderId} is ${order.status}; only draft orders can be rejected`,
      },
    };
  }
  const now = new Date().toISOString();
  const patch = { status: 'rejected', reason, rejected_at: now, updated_at: now };
  await withStore(
    'reject',
    async (sb) => {
      const result = await updateAdaptive(sb, 'orders', patch, [{ col: 'id', val: orderId }]);
      return result.ok ? { data: result.patch } : { error: result.error };
    },
    () => memoryOrders.set(orderId, { ...memoryOrders.get(orderId), ...patch }),
  );
  await writeAudit({
    action: 'order_rejected',
    actor_id: actorId,
    entity: 'order',
    entity_id: orderId,
    detail: { reason },
  });
  return { order_id: orderId, status: 'rejected', reason };
};

// listOrders({ account_id, project_id, status }) → summary rows with item_count.
const listOrders = async ({ account_id, project_id, status } = {}) => {
  const rows = await withStore(
    'list',
    async (sb) => {
      let q = sb.from('orders').select('*').order('created_at', { ascending: false });
      if (account_id) q = q.eq('account_id', account_id);
      if (project_id) q = q.eq('project_id', project_id);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      return error ? { error } : { data: data || [] };
    },
    () => {
      let all = Array.from(memoryOrders.values());
      if (account_id) all = all.filter((o) => o.account_id === account_id);
      if (project_id) all = all.filter((o) => o.project_id === project_id);
      if (status) all = all.filter((o) => o.status === status);
      return all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    },
  );
  const orders = (rows && rows.data !== undefined ? rows.data : rows) || [];
  const effective = orders.length > 0 ? orders : (() => {
    // Supabase returned nothing — serve the memory shadow store.
    let all = Array.from(memoryOrders.values());
    if (account_id) all = all.filter((o) => o.account_id === account_id);
    if (project_id) all = all.filter((o) => o.project_id === project_id);
    if (status) all = all.filter((o) => o.status === status);
    return all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  })();
  return Promise.all(effective.map(async (o) => {
    const full = await getOrder(o.id);
    return {
      order_id: o.id,
      status: o.status,
      supplier: o.supplier,
      total_cost: o.total_cost,
      item_count: full ? full.items.length : 0,
      created_at: o.created_at,
    };
  }));
};

// Test helper: wipe memory + expose memory audit rows.
const _clearMemory = () => {
  memoryOrders.clear();
  memoryItems.clear();
  memoryAudit.length = 0;
};
const _memoryAudit = () => memoryAudit.slice();

module.exports = {
  createOrder,
  createOrderFromLines,
  getOrder,
  submitOrder,
  rejectOrder,
  listOrders,
  writeAudit,
  setSupabase,
  _clearMemory,
  _memoryAudit,
};
