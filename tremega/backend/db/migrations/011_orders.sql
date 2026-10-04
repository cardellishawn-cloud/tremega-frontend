-- db/migrations/011_orders.sql
-- Week 5: materials ordering tables for Tremega Contractor OS Phase 1.
--
-- Run this in the Supabase SQL Editor. All statements are idempotent
-- (IF NOT EXISTS / guarded), so it is safe to run even if some of these
-- tables were already created by hand.
--
-- NOTE (week-5 probe): the live database rejected the configured service
-- key ("Unregistered API key"), so existence of orders / order_items /
-- audit_events could not be confirmed from the backend. Every store in
-- src/services falls back to in-memory until this lands and the key works.

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  account_id UUID,
  supplier TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  total_cost NUMERIC(12,2),
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  eta DATE,
  tracking_number TEXT
);

-- Guarded column adds for databases where orders was created by an earlier
-- revision of this file (ordering-layer focused build).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  material_id UUID,
  name TEXT,
  qty NUMERIC(12,2),
  unit_cost NUMERIC(12,2),
  total_cost NUMERIC(12,2)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id UUID,
  entity TEXT,
  entity_id UUID,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Materials catalog lives in db/seeds/materials.sql. If the materials table
-- itself is missing, create it with the columns the seed expects.
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT,
  unit_cost NUMERIC(12,2),
  specification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_orders_project_id ON orders(project_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_material_id ON order_items(material_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
