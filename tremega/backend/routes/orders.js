// routes/orders.js
// Ordering layer: draft → approve (submit) / reject, status + list.
// Mounted at /api/orders. Approval records live in the week-3 approval-store
// (tool_name 'order_submission', input.order_id) so /api/agent/approvals and
// this router act on the same queue.

const express = require('express');
const { z } = require('zod');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../src/middleware/rbac');
const ordersService = require('../src/services/orders-service');
const approvalService = require('../src/services/approval-service');
const approvalStore = require('../src/services/approval-store');

const router = express.Router();

// ---------- Validation ----------

const createSchema = z.object({
  account_id: z.string().uuid(),
  project_id: z.string().uuid().optional(),
  materials: z.array(z.object({
    material_id: z.string().uuid(),
    qty: z.number().positive(),
  })).min(1).max(200),
  supplier: z.string().min(1).max(100).optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(1).max(1000),
});

const listQuerySchema = z.object({
  account_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'submitted', 'rejected', 'delivered']).optional(),
});

const validationError = (res, error) => res.status(400).json({
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    issues: (error.issues || error.errors || []).map((i) => ({
      path: Array.isArray(i.path) ? i.path.join('.') : String(i.path || ''),
      message: i.message,
      code: i.code,
    })),
  },
});

// Latest approval record linked to an order (pending ones first).
// Matches 009+ input.order_id and the legacy live resource_id column.
const findApprovalForOrder = async (orderId) => {
  const linked = (a) => (a.input && a.input.order_id === orderId) || a.resource_id === orderId;
  const pending = await approvalStore.list({ status: 'pending', limit: 500 });
  const match = (pending || []).find(linked);
  if (match) return match;
  // Fall back to any decided approval so status responses can report it.
  const all = await approvalStore.list({ limit: 500 });
  return (all || []).find(linked) || null;
};

const serviceError = (res, error) => {
  if (error.code === 'ORDER_NOT_FOUND') {
    return res.status(404).json({ error });
  }
  if (error.code === 'INVALID_STATE') {
    return res.status(409).json({ error });
  }
  return res.status(400).json({ error });
};

// ---------- POST / (create draft order + pending approval) ----------

router.post('/', authMiddleware, requireRole('owner', 'pm'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  const { account_id, project_id, materials, supplier } = parsed.data;
  const result = await ordersService.createOrder({
    account_id,
    project_id: project_id || null,
    materials,
    supplier: supplier || 'home_depot',
    created_by: req.user.userId,
  });
  if (result.error) return serviceError(res, result.error);

  const summary = `Order ${materials.length} item(s) from ${supplier || 'home_depot'}`
    + ` — $${result.total_cost}`;
  const approval = await approvalStore.create({
    tool_name: 'order_submission',
    input: { order_id: result.order_id, account_id },
    summary,
    project_id: project_id || null,
    requested_by: req.user.userId,
  });

  return res.status(201).json({
    order_id: result.order_id,
    status: 'draft',
    materials: result.materials,
    total_cost: result.total_cost,
    approval_pending: true,
    approval_id: approval.id,
  });
});

// ---------- POST /:id/approve (owner only) ----------

router.post('/:id/approve', authMiddleware, requireRole('owner'), async (req, res) => {
  const order = await ordersService.getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: `Order ${req.params.id} not found` } });
  }
  if (order.status !== 'draft') {
    return res.status(409).json({
      error: { code: 'INVALID_STATE', message: `Order is already ${order.status}` },
    });
  }

  const approval = await findApprovalForOrder(order.id);
  if (!approval) {
    return res.status(404).json({
      error: { code: 'APPROVAL_NOT_FOUND', message: `No approval record for order ${order.id}` },
    });
  }

  // Atomic guard: one decider wins; every concurrent loser gets 409.
  const decided = await approvalService.approveApprovalAtomic(approval.id, req.user.userId);
  if (decided.error) {
    return res.status(decided.http_status).json({ error: decided.error });
  }

  const submitted = decided.result;
  return res.json({
    order_id: order.id,
    status: 'submitted',
    message: 'Order submitted to Home Depot (Phase 2)',
    items_count: submitted.items_count,
    total_cost: submitted.total_cost,
  });
});

// ---------- POST /:id/reject (owner only) ----------

router.post('/:id/reject', authMiddleware, requireRole('owner'), async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body || {});
  if (!parsed.success) return validationError(res, parsed.error);

  const order = await ordersService.getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: `Order ${req.params.id} not found` } });
  }
  if (order.status !== 'draft') {
    return res.status(409).json({
      error: { code: 'INVALID_STATE', message: `Order is already ${order.status}` },
    });
  }

  const approval = await findApprovalForOrder(order.id);
  if (approval) {
    const decided = await approvalService.rejectApprovalAtomic(approval.id, req.user.userId, parsed.data.reason);
    if (decided.error) {
      return res.status(decided.http_status).json({ error: decided.error });
    }
  } else {
    // No approval record (legacy order) — reject the order directly.
    const rejected = await ordersService.rejectOrder(order.id, parsed.data.reason, req.user.userId);
    if (rejected.error) return serviceError(res, rejected.error);
  }

  return res.json({ order_id: order.id, status: 'rejected', reason: parsed.data.reason });
});

// ---------- GET /:id/status (view: any authenticated role) ----------

router.get('/:id/status', authMiddleware, requireRole('owner', 'pm', 'field'), async (req, res) => {
  const order = await ordersService.getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: `Order ${req.params.id} not found` } });
  }
  const approval = await findApprovalForOrder(order.id);
  return res.json({
    order_id: order.id,
    status: order.status,
    supplier: order.supplier,
    total_cost: order.total_cost,
    items: order.items.map((i) => ({
      material_id: i.material_id,
      name: i.name,
      qty: i.qty,
      unit_cost: i.unit_cost,
      total_cost: i.total_cost,
    })),
    created_at: order.created_at,
    created_by: order.created_by,
    approval_status: approval ? approval.status : null,
    submitted_at: order.submitted_at || null,
    eta: order.eta || null, // Phase 2 tracks real delivery
  });
});

// ---------- GET / (list; view: any authenticated role) ----------

router.get('/', authMiddleware, requireRole('owner', 'pm', 'field'), async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);

  const orders = await ordersService.listOrders({
    account_id: parsed.data.account_id,
    status: parsed.data.status,
  });
  return res.json({ orders, count: orders.length });
});

module.exports = router;
