-- activity_log — as the code (tremega/backend activity-store + routes/activity.js) expects it.
-- Columns are exactly what the store writes/reads; UUID PK client-generated.
-- ADDITIVE, idempotent (IF NOT EXISTS). No FKs (mirrors checkins pattern: project_id
-- is intentionally loose — work_orders.id today, jobs.id possible later).

CREATE TABLE IF NOT EXISTS activity_log (
  id              UUID PRIMARY KEY,
  project_id      UUID,                      -- work order (job) the activity belongs to; NULL allowed
  crew_member_id  UUID,                      -- users.id of the worker
  activity        TEXT,                      -- phase label while clocked in
  hours           NUMERIC,                   -- computed on clock_out; NULL while open
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_project ON activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_member  ON activity_log(crew_member_id);

-- ---------- UNDO ----------
-- DROP TABLE IF EXISTS activity_log;