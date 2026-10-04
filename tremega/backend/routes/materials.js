// routes/materials.js
// Materials suggestion endpoint for the ordering layer. Mounted at /api/materials.

const express = require('express');
const { z } = require('zod');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../src/middleware/rbac');
const materialsService = require('../src/services/materials-service');

const router = express.Router();

const suggestSchema = z.object({
  account_id: z.string().uuid().optional(),
  job_spec: z.string().min(1).max(2000),
  job_type: z.enum(['electrical', 'plumbing', 'general', 'remodel']).optional(),
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

// POST /suggest — owner/pm. Pure service-layer calculation; no db writes.
router.post('/suggest', authMiddleware, requireRole('owner', 'pm'), async (req, res) => {
  const parsed = suggestSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const result = await materialsService.suggestMaterials(parsed.data.job_spec, parsed.data.job_type);
    return res.json({ ...result, status: 'suggestion' });
  } catch (err) {
    console.error('materials /suggest error:', err.message);
    return res.status(502).json({ error: { code: 'MATERIALS_ERROR', message: 'Material suggestion failed' } });
  }
});

module.exports = router;
