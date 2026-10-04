// routes/agent.js
// Week 3: secured HTTP surface for the Claude agent core.
// Mounted at /api/agent (see server.js).

const express = require('express');
const { z } = require('zod');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../src/middleware/rbac');
const claudeService = require('../src/services/claude-service');
const approvalStore = require('../src/services/approval-store');
const approvalService = require('../src/services/approval-service');
const auditLog = require('../src/services/audit-log');
const registry = require('../src/tools/registry');
const pushService = require('../src/services/push-service');

const router = express.Router();

// ---------- Validation ----------

const chatSchema = z.object({
  projectId: z.string().uuid(),
  message: z.string().min(1).max(4000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.any(),
      }),
    )
    .max(50)
    .optional(),
});

const rejectSchema = z
  .object({
    reason: z.string().max(1000).optional(),
  })
  .strict();

const approvalsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

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

// Never leak stack traces, env values, or secrets in surfaced error messages.
const sanitizeErrorMessage = (err) => {
  const raw = (err && err.message) || 'Unknown agent error';
  if (/sk-|api[_-]?key|secret|token|bearer|password/i.test(raw)) {
    return 'The agent failed to process this request.';
  }
  return raw.slice(0, 300);
};

// ---------- POST /chat ----------

router.post(
  '/chat',
  authMiddleware,
  requireRole('owner', 'pm', 'field'),
  async (req, res) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const { projectId, message, conversationHistory } = parsed.data;
    try {
      const result = await claudeService.runAgentTurn({
        projectId,
        userMessage: message,
        conversationHistory: conversationHistory || [],
        userId: req.user.userId,
      });
      return res.json(result);
    } catch (err) {
      console.error('agent /chat error:', err.message);
      return res.status(502).json({
        error: { code: 'AGENT_ERROR', message: sanitizeErrorMessage(err) },
      });
    }
  },
);

// ---------- GET /approvals ----------

router.get(
  '/approvals',
  authMiddleware,
  requireRole('owner', 'pm', 'field'),
  async (req, res) => {
    const parsed = approvalsQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error);

    const { projectId, status } = parsed.data;
    const approvals = await approvalStore.list({
      projectId,
      status: status || 'pending',
    });
    return res.json({ approvals });
  },
);

// ---------- Decision helpers ----------

const loadPendingApproval = async (req, res) => {
  const approval = await approvalStore.get(req.params.id);
  if (!approval) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Approval ${req.params.id} not found` },
    });
    return null;
  }
  if (approval.status !== 'pending') {
    res.status(409).json({
      error: {
        code: 'ALREADY_DECIDED',
        message: `Approval ${approval.id} is already ${approval.status}`,
      },
    });
    return null;
  }
  return approval;
};

// ---------- POST /approvals/:id/approve ----------

router.post(
  '/approvals/:id/approve',
  authMiddleware,
  requireRole('owner', 'pm'),
  async (req, res) => {
    const decided = await approvalService.approveApprovalAtomic(req.params.id, req.user.userId);
    if (decided.error) {
      return res.status(decided.http_status).json({ error: decided.error });
    }
    // Slice 6: notify the requester their material/approval was approved.
    const approval = decided.approval || {};
    if (approval.requested_by) {
      const toolLabel = String(approval.tool_name || approval.action_type || 'request').replace(/_/g, ' ');
      pushService.send({
        userId: approval.requested_by,
        title: 'Request approved',
        body: `Your ${toolLabel} was approved.`,
        data: { type: 'material_approved', approval_id: approval.id, tab: 'orders' },
      }).catch(() => {});
    }
    return res.json({ approval: decided.approval, result: decided.result });
  },
);

// ---------- POST /approvals/:id/reject ----------

router.post(
  '/approvals/:id/reject',
  authMiddleware,
  requireRole('owner', 'pm'),
  async (req, res) => {
    const parsed = rejectSchema.safeParse(req.body || {});
    if (!parsed.success) return validationError(res, parsed.error);

    const decided = await approvalService.rejectApprovalAtomic(
      req.params.id,
      req.user.userId,
      parsed.data.reason || null,
    );
    if (decided.error) {
      return res.status(decided.http_status).json({ error: decided.error });
    }
    return res.json({ approval: decided.approval });
  },
);

// ---------- GET /audit ----------

router.get(
  '/audit',
  authMiddleware,
  requireRole('owner'),
  async (req, res) => {
    const parsedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 200);
    const projectId = req.query.projectId || undefined;

    const audit = await auditLog.list({ projectId, limit });
    return res.json({ audit });
  },
);

module.exports = router;
