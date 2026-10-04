// routes/activity.js
// Phase 2 frontend: time logging by phase (clock in/out pairs).
// Mounted at /api/activity (additive require+mount in server.js).
//
// Contract:
//   POST / { job_id, phase, action: 'clock_in' | 'clock_out' }
//     clock_in  -> opens a timer for the caller (409 if one is already open)
//     clock_out -> closes the open timer, persists a completed activity
//                  row via activity-store ({ project_id, crew_member_id,
//                  activity, hours }) and returns the entry with duration.
//   GET / ?job_id=&date=YYYY-MM-DD&worker_id=
//     Completed entries for the day (field: own only; pm/owner: all or
//     filtered) + the caller's open entry, if any, with endTime null.
//
// The open clock-in lives in route memory (one per user). A server restart
// forgets it; completed entries are durable via the store. That is the MVP
// trade — no new table required.

const express = require('express');
const { z } = require('zod');
const authMiddleware = require('../middleware/auth');
const { resolveRole } = require('../src/middleware/rbac');
const activityStore = require('../src/services/activity-store');

const router = express.Router();

const PHASES = ['framing', 'electrical', 'concrete', 'finish', 'break', 'off-site'];

const postBodySchema = z.object({
  job_id: z.string().uuid(),
  phase: z.enum(PHASES),
  action: z.enum(['clock_in', 'clock_out']),
  timestamp: z.string().datetime({ offset: true }).optional(),
});

const getQuerySchema = z.object({
  job_id: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  worker_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

const zodIssues = (error) => (error.issues || error.errors || []).map((issue) => ({
  path: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path || ''),
  message: issue.message,
  code: issue.code,
}));

const validationError = (res, error) => res.status(400).json({
  error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', issues: zodIssues(error) },
});

// userId -> { job_id, phase, startTime }
const openClocks = new Map();

const toEntry = (row) => {
  const endMs = new Date(row.created_at).getTime();
  const durMs = Math.round((row.hours || 0) * 3600000);
  return {
    id: row.id,
    job_id: row.project_id,
    worker_id: row.crew_member_id,
    phase: row.activity,
    startTime: new Date(endMs - durMs).toISOString(),
    endTime: new Date(endMs).toISOString(),
    duration: durMs,
  };
};

// ---------- POST / ----------

router.post('/', authMiddleware, async (req, res) => {
  const parsed = postBodySchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  const { job_id, phase, action } = parsed.data;
  const userId = req.user.userId;

  if (action === 'clock_in') {
    const existing = openClocks.get(userId);
    if (existing) {
      return res.status(409).json({
        error: {
          code: 'ALREADY_CLOCKED_IN',
          message: `Already clocked in to '${existing.phase}' since ${existing.startTime}. Clock out first.`,
          open: existing,
        },
      });
    }
    const open = { job_id, phase, startTime: new Date().toISOString() };
    openClocks.set(userId, open);
    return res.status(201).json({ status: 'success', open: { ...open, worker_id: userId, endTime: null } });
  }

  // clock_out
  const open = openClocks.get(userId);
  if (!open) {
    return res.status(409).json({
      error: { code: 'NOT_CLOCKED_IN', message: 'No open clock-in to close.' },
    });
  }
  const end = new Date();
  const durationMs = Math.max(0, end.getTime() - new Date(open.startTime).getTime());
  const hours = durationMs / 3600000;

  const { record, persisted } = await activityStore.create({
    project_id: open.job_id,
    crew_member_id: userId,
    activity: open.phase,
    hours: Math.round(hours * 1000) / 1000,
  });
  openClocks.delete(userId);

  return res.status(201).json({
    status: 'success',
    entry: toEntry(record),
    persisted,
  });
});

// ---------- GET / ----------

router.get('/', authMiddleware, async (req, res) => {
  const parsed = getQuerySchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);

  const role = resolveRole(req.user);
  const { job_id, date, limit } = parsed.data;
  const workerId = role === 'field' ? req.user.userId : (parsed.data.worker_id || null);

  let rows = await activityStore.list({ projectId: job_id, limit });
  if (workerId) rows = rows.filter((r) => r.crew_member_id === workerId);
  if (date) rows = rows.filter((r) => (r.created_at || '').slice(0, 10) === date);

  const entries = rows.map(toEntry);

  const open = openClocks.get(req.user.userId);
  const openEntry = open && (!job_id || open.job_id === job_id)
    ? {
        id: null,
        job_id: open.job_id,
        worker_id: req.user.userId,
        phase: open.phase,
        startTime: open.startTime,
        endTime: null,
        duration: Date.now() - new Date(open.startTime).getTime(),
      }
    : null;

  return res.json({ entries, open: openEntry, phases: PHASES });
});

module.exports = router;
