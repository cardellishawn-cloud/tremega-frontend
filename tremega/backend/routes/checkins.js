// routes/checkins.js
// Week 4: GPS-verified crew check-ins with Twilio notifications.
// Mounted at /api/checkins (see server.js).
//
// POST / persists the check-in first, then attempts SMS side effects. SMS
// failures never fail the request — they surface as sms: { sent: false }.
// Projects without a configured geofence are persisted with verified=null and
// verification_status 'unverified_no_geofence' (not an error).

const express = require('express');
const { z } = require('zod');
const authMiddleware = require('../middleware/auth');
const { resolveRole } = require('../src/middleware/rbac');
const geo = require('../src/services/geo');
const twilio = require('../src/services/twilio-service');
const checkinsStore = require('../src/services/checkins-store');
const geofenceResolver = require('../src/services/geofence-resolver');

const router = express.Router();

// ---------- Validation ----------

const postBodySchema = z.object({
  project_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy_m: z.number().min(0).max(1000).optional(),
  worker_id: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
});

const getQuerySchema = z.object({
  project_id: z.string().uuid().optional(),
  worker_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
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

// ---------- SMS side effects (never throw) ----------

const sendConfirmationSms = async ({ workerId, verification }) => {
  const phone = await geofenceResolver.lookupUserPhone(workerId);
  if (!phone) return { sent: false, error: 'worker_phone_unknown' };
  try {
    const res = await twilio.sendSms(
      phone,
      `Tremega check-in confirmed. You are ${Math.round(verification.distance_m)}m `
      + 'inside the job-site geofence. Have a good shift!',
    );
    return { sent: true, sid: res.sid, to: res.to };
  } catch (err) {
    return { sent: false, error: err.code || 'TWILIO_ERROR' };
  }
};

const sendPmAlertSms = async ({ workerId, projectId, verification }) => {
  const alertPhone = process.env.PM_ALERT_PHONE;
  if (!alertPhone) return { sent: false, error: 'pm_alert_phone_not_configured' };
  try {
    const res = await twilio.sendSms(
      alertPhone,
      `Tremega ALERT: check-in ${Math.round(verification.distance_m)}m OUTSIDE the geofence `
      + `(project ${projectId}, worker ${workerId}). Flagged for review.`,
    );
    return { sent: true, sid: res.sid, to: res.to };
  } catch (err) {
    return { sent: false, error: err.code || 'TWILIO_ERROR' };
  }
};

// ---------- POST / ----------

router.post('/', authMiddleware, async (req, res) => {
  const parsed = postBodySchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  const { project_id, lat, lng, accuracy_m, note } = parsed.data;
  const workerId = parsed.data.worker_id || req.user.userId;

  // 1. Resolve the job-site geofence (phases -> bids -> projects).
  const fence = await geofenceResolver.resolveGeofence(project_id);

  // 2. Verify against it (or mark unverified when none is configured).
  let verification;
  let verificationStatus;
  let flagged = false;
  if (!fence) {
    verification = { verified: null, distance_m: null, confidence: null, reasons: [] };
    verificationStatus = 'unverified_no_geofence';
  } else {
    const check = geo.geofenceCheck({ lat, lng }, fence, accuracy_m);
    if (check.error) {
      return res.status(400).json({ error: check.error });
    }
    verification = {
      verified: check.inside,
      distance_m: check.distance_m,
      confidence: check.confidence,
      reasons: check.reasons,
    };
    verificationStatus = check.inside ? 'verified' : 'outside_geofence';
    flagged = !check.inside;
  }

  // 3. Persist (Supabase with memory fallback; adapts to live columns).
  const checkin = await checkinsStore.create({
    worker_id: workerId,
    project_id,
    lat,
    lng,
    accuracy_m,
    verified: verification.verified,
    distance_m: verification.distance_m,
    confidence: verification.confidence,
    verification_status: verificationStatus,
    flagged,
    note,
  });

  // 4. SMS side effects — best effort, never fail the request.
  let sms;
  if (verification.verified === true) {
    sms = await sendConfirmationSms({ workerId, verification });
  } else if (verification.verified === false) {
    sms = await sendPmAlertSms({ workerId, projectId: project_id, verification });
  } else {
    sms = { sent: false, error: 'no_geofence_configured' };
  }

  return res.status(201).json({ checkin, verification, sms });
});

// ---------- GET / ----------

router.get('/', authMiddleware, async (req, res) => {
  const parsed = getQuerySchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);

  const role = resolveRole(req.user);
  const { project_id, limit } = parsed.data;
  // Field workers can only ever see their own check-ins.
  const workerId = role === 'field' ? req.user.userId : parsed.data.worker_id;

  const checkins = await checkinsStore.list({
    projectId: project_id,
    workerId,
    limit,
  });
  return res.json({ checkins });
});

module.exports = router;
