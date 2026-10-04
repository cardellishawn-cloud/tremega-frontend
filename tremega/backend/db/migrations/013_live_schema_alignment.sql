-- 013_live_schema_alignment.sql
-- Aligns the LIVE (pre-Phase-1) tables with the Phase 1 services.
-- All statements are additive/idempotent (IF NOT EXISTS) — safe to re-run.
-- Until this runs, the services dual-write + column-strip so both schemas work.

-- tool_approvals: the live table has action_type/resource_type/resource_id/
-- approved_*/rejected_* columns; Phase 1 uses the 009+ shape below.
ALTER TABLE tool_approvals ADD COLUMN IF NOT EXISTS tool_name TEXT;
ALTER TABLE tool_approvals ADD COLUMN IF NOT EXISTS input JSONB;
ALTER TABLE tool_approvals ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE tool_approvals ADD COLUMN IF NOT EXISTS project_id UUID;
ALTER TABLE tool_approvals ADD COLUMN IF NOT EXISTS decided_by TEXT;
ALTER TABLE tool_approvals ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE tool_approvals ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE tool_approvals ADD COLUMN IF NOT EXISTS result JSONB;

CREATE INDEX IF NOT EXISTS idx_tool_approvals_status ON tool_approvals(status);
CREATE INDEX IF NOT EXISTS idx_tool_approvals_project ON tool_approvals(project_id);

-- orders: live table lacks these Phase 1 columns.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS project_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS eta TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_project ON orders(project_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- order_items: denormalized material name (live table lacks it).
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS name TEXT;

-- audit_events: workflow audit trail (orders/bids/approvals).
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID,
  action TEXT NOT NULL,
  actor_id TEXT,
  entity TEXT,
  entity_id UUID,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at);
