// routes/work-orders.js
// Phase 2 contractor workflow: work orders assigned to a contractor with
// status transitions assigned -> in_progress -> completed.
// Mounted at /api/work-orders (additive require+mount in server.js).
//
// GET    /           — list (field: own only; pm/owner: all or ?contractor_id=)
// GET    /:id        — single (field: own only)
// POST   /           — create (owner/pm)
// PATCH  /:id/status — advance one step; idempotent at target; CAS-guarded
//
// GPS check-ins are NOT re-implemented here — the app calls the existing
// POST /api/checkins with project_id = work_order id (no FK — probed).

const express = require('express');
const { z } = require('zod');
const authMiddleware = require('../src/middleware/auth');
const { requireRole, resolveRole } = require('../src/middleware/rbac');
const store = require('../src/services/work-orders-store');

const router = express.Router();

// ---------- Validation (same idioms as routes/checkins.js) ----------

const STATUS_ENUM = z.enum(['assigned', 'in_progress', 'completed']);

const listQuerySchema = z.object({
  contractor_id: z.string().uuid().optional(),
  status: STATUS_ENUM.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

const createBodySchema = z.object({
  contractor_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional(),
  job_address: z.string().max(300).optional(),
});

const statusBodySchema = z.object({
  status: z.enum(['in_progress', 'completed']),
});

const idParamSchema = z.string().uuid();

// Zod v4 exposes .issues; fall back to .errors for v3 compatibility.
const zodIssues = (error) => {
  const issues = error.issues || error.errors || [];
  return issues.map((issue) => ({
    path: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path || ''),
    message: issue.message,
    code: issue.code,
  }));
};

const validationError = (res, error) =>
  res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      issues: zodIssues(error),
    },
  });

const NEXT_STATUS = { assigned: 'in_progress', in_progress: 'completed' };

// ---------- GET / ----------

router.get('/', authMiddleware, async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);

  // Pilot scoping (fixed): contractor/pm/field users only ever see their own
  // work orders. OWNER_IDS 'owner' users may see all or filter via ?contractor_id.
  const role = resolveRole(req.user);
  let contractorId = role === 'owner' ? parsed.data.contractor_id : req.user.userId;
  if (role === 'owner' && !contractorId) {
    // owner must pass a contractor_id to scope; otherwise they get everything (back-compat)
    contractorId = null;
  }

  const workOrders = await store.list({
    contractorId,
    status: parsed.data.status,
    limit: parsed.data.limit,
  });
  return res.json({ work_orders: workOrders });
});

// ---------- GET /:id ----------

router.get('/:id', authMiddleware, async (req, res) => {
  const idParsed = idParamSchema.safeParse(req.params.id);
  if (!idParsed.success) return validationError(res, idParsed.error);

  const workOrder = await store.get(req.params.id);
  if (!workOrder) {
    return res.status(404).json({ error: { code: 'WORK_ORDER_NOT_FOUND', message: 'Work order not found' } });
  }

  const role = resolveRole(req.user);
  if (role === 'field' && workOrder.contractor_id !== req.user.userId) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not your work order' } });
  }
  return res.json({ work_order: workOrder });
});

// ---------- POST / ----------

router.post('/', authMiddleware, requireRole('owner', 'pm'), async (req, res) => {
  const parsed = createBodySchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  const workOrder = await store.create(parsed.data);
  return res.status(201).json({ work_order: workOrder });
});

// ---------- PATCH /:id/status ----------

router.patch('/:id/status', authMiddleware, async (req, res) => {
  const idParsed = idParamSchema.safeParse(req.params.id);
  if (!idParsed.success) return validationError(res, idParsed.error);
  const bodyParsed = statusBodySchema.safeParse(req.body);
  if (!bodyParsed.success) return validationError(res, bodyParsed.error);

  const target = bodyParsed.data.status;
  const workOrder = await store.get(req.params.id);
  if (!workOrder) {
    return res.status(404).json({ error: { code: 'WORK_ORDER_NOT_FOUND', message: 'Work order not found' } });
  }

  const role = resolveRole(req.user);
  if (role === 'field' && workOrder.contractor_id !== req.user.userId) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not your work order' } });
  }

  // Idempotent at target — safe to retry from the app.
  if (workOrder.status === target) {
    return res.json({ work_order: workOrder });
  }

  const expected = NEXT_STATUS[workOrder.status];
  if (expected !== target) {
    return res.status(409).json({
      error: {
        code: 'INVALID_STATE',
        message: `Cannot move from "${workOrder.status}" to "${target}". Next allowed: ${expected || 'none (terminal state)'}.`,
      },
    });
  }

  const now = new Date().toISOString();
  const patch = { status: target, updated_at: now };
  if (target === 'in_progress') patch.start_time = now;
  if (target === 'completed') patch.completed_at = now;

  const updated = await store.transition(workOrder.id, workOrder.status, patch);
  if (!updated) {
    return res.status(409).json({
      error: { code: 'INVALID_STATE', message: 'Status changed concurrently — reload and retry' },
    });
  }
  return res.json({ work_order: updated });
});

module.exports = router;
