// routes/crews.js
// Phase 2 frontend: crew roster for the Crew tab.
// Mounted at /api/crews (additive require+mount in server.js).
//
// GET / ?job_id=
//   Crew = users sharing the caller's business (user_roles join users).
//   Location/status come from each member's LATEST check-in:
//     - latest check-in is for job_id and < 12h old -> "on-site" + coords
//     - otherwise -> "off-site" (+ coords from the latest check-in, if any)
//   There is no realtime location table yet; the app polls/pull-to-refresh.
//   Degrades to { crew: [], degraded: true } on schema/Supabase failure
//   so the app's empty state renders instead of an error.

const express = require('express');
const { z } = require('zod');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');
const checkinsStore = require('../src/services/checkins-store');

const router = express.Router();

const ONSITE_WINDOW_MS = 12 * 3600 * 1000;

const getQuerySchema = z.object({
  job_id: z.string().uuid().optional(),
});

const zodIssues = (error) => (error.issues || error.errors || []).map((issue) => ({
  path: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path || ''),
  message: issue.message,
  code: issue.code,
}));

const fullName = (u) => (u.full_name || '').trim() || u.email || 'Crew member';

router.get('/', authMiddleware, async (req, res) => {
  const parsed = getQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', issues: zodIssues(parsed.error) },
    });
  }
  const { job_id: jobId } = parsed.data;

  try {
    // 1. Roster = active users (single-tenant pilot: one company per deployment).
    //    Live schema: users(id, email, full_name, phone, phone_number, role, is_active, ...).
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, email, full_name, phone, phone_number, role, is_active');
    if (usersErr) throw usersErr;

    const members = (users || [])
      .filter((u) => u.is_active !== false)
      .map((u) => ({
        id: u.id,
        name: fullName(u),
        role: u.role || 'crew',
        phone: u.phone || u.phone_number || null,
      }));

    // 3. Latest check-in per member -> location + status.
    const crew = await Promise.all(members.map(async (m) => {
      let latest = null;
      try {
        const rows = await checkinsStore.list({ workerId: m.id, limit: 1 });
        latest = rows[0] || null;
      } catch { /* location unknown */ }

      const fresh = latest && (Date.now() - new Date(latest.created_at).getTime()) < ONSITE_WINDOW_MS;
      const onSiteHere = Boolean(fresh && jobId && latest.project_id === jobId);

      return {
        id: m.id,
        job_id: jobId || null,
        name: m.name,
        role: m.role,
        phone: m.phone,
        avatar_url: null,
        status: onSiteHere ? 'on-site' : 'off-site',
        latitude: latest ? latest.lat ?? null : null,
        longitude: latest ? latest.lng ?? null : null,
        last_location_update: latest ? latest.created_at : null,
        eta: null,
      };
    }));

    return res.json({ crew });
  } catch (err) {
    console.warn('crews: degraded response (' + err.message + ')');
    return res.json({ crew: [], degraded: true });
  }
});

module.exports = router;
