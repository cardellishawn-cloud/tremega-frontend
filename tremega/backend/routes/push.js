// routes/push.js
// Slice 6: Expo push token registration + manual/test notify.
// Mounted at /api/push (additive require+mount in server.js).
//
// POST /token   { token, platform }  — any authed user registers own token.
// POST /notify  { userId?, title, body, data? } — owner/pm only (testing + ops).

const express = require('express');
const { z } = require('zod');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../src/middleware/rbac');
const pushService = require('../src/services/push-service');

const router = express.Router();

const zodIssues = (error) => (error.issues || error.errors || []).map((issue) => ({
  path: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path || ''),
  message: issue.message,
  code: issue.code,
}));

const validationError = (res, error) => res.status(400).json({
  error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', issues: zodIssues(error) },
});

const tokenSchema = z.object({
  token: z.string().min(1).max(255),
  platform: z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
});

const notifySchema = z.object({
  userId: z.string().uuid().optional(),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(300),
  data: z.record(z.any()).optional(),
});

router.post('/token', authMiddleware, async (req, res) => {
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  const result = await pushService.register({
    userId: req.user.userId,
    token: parsed.data.token,
    platform: parsed.data.platform,
  });
  if (!result.ok) {
    return res.status(400).json({ error: { code: 'INVALID_TOKEN', message: result.error } });
  }
  return res.status(201).json({ status: 'registered', persisted: result.persisted });
});

router.post('/notify', authMiddleware, requireRole('owner', 'pm'), async (req, res) => {
  const parsed = notifySchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  const result = await pushService.send(parsed.data);
  return res.json({ status: 'sent', ...result });
});

module.exports = router;
