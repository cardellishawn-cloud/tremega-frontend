-- 014_work_orders.sql
-- Phase 2 contractor workflow: work orders assigned to a contractor with
-- status transitions assigned -> in_progress -> completed.
--
-- Why a new table: the live `jobs` table belongs to the website estimate
-- flow — it requires business_id/customer_id/job_number (NOT NULL, FK
-- enforced) and has no contractor_id column. The live `checkins` table is
-- reused as-is (project_id = work_order id; no FK enforced — probed).
--
-- Additive + idempotent. Run in the Supabase SQL Editor, then:
--   node scripts/seed-work-orders.js

CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  job_address TEXT,
  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'in_progress', 'completed')),
  start_time TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_orders_contractor_id_idx ON work_orders (contractor_id);
CREATE INDEX IF NOT EXISTS work_orders_status_idx ON work_orders (status);
