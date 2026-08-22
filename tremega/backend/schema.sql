-- Supabase SQL Schema for Tremega Bids/Estimates
-- Run this in your Supabase SQL Editor

-- Create enum types
CREATE TYPE bid_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');
CREATE TYPE line_item_type AS ENUM ('labor', 'material', 'other');

-- Bids table
CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status bid_status DEFAULT 'draft',
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0.0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  terms TEXT,
  expiration_date TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bid line items table
CREATE TABLE bid_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  type line_item_type DEFAULT 'other',
  quantity DECIMAL(10,2) DEFAULT 1,
  unit TEXT DEFAULT 'units',
  unit_price DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_bids_customer_id ON bids(customer_id);
CREATE INDEX idx_bids_business_id ON bids(business_id);
CREATE INDEX idx_bids_status ON bids(status);
CREATE INDEX idx_bids_created_by ON bids(created_by);
CREATE INDEX idx_bids_expiration_date ON bids(expiration_date);
CREATE INDEX idx_bid_line_items_bid_id ON bid_line_items(bid_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_bids_updated_at BEFORE UPDATE ON bids
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bid_line_items_updated_at BEFORE UPDATE ON bid_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate bid totals
CREATE OR REPLACE FUNCTION calculate_bid_totals(bid_uuid UUID)
RETURNS VOID AS $$
DECLARE
  bid_subtotal DECIMAL(12,2);
  bid_tax_rate DECIMAL(5,4);
  bid_tax_amount DECIMAL(12,2);
  bid_total DECIMAL(12,2);
BEGIN
  -- Calculate subtotal from line items
  SELECT COALESCE(SUM(total), 0) INTO bid_subtotal
  FROM bid_line_items
  WHERE bid_id = bid_uuid;
  
  -- Get tax rate
  SELECT tax_rate INTO bid_tax_rate FROM bids WHERE id = bid_uuid;
  
  -- Calculate tax and total
  bid_tax_amount := bid_subtotal * bid_tax_rate;
  bid_total := bid_subtotal + bid_tax_amount;
  
  -- Update bid
  UPDATE bids
  SET subtotal = bid_subtotal,
      tax_amount = bid_tax_amount,
      total = bid_total
  WHERE id = bid_uuid;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate totals when line items change
CREATE OR REPLACE FUNCTION trigger_calculate_bid_totals()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_bid_totals(COALESCE(NEW.bid_id, OLD.bid_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bid_line_items_calculate_totals
  AFTER INSERT OR UPDATE OR DELETE ON bid_line_items
  FOR EACH ROW EXECUTE FUNCTION trigger_calculate_bid_totals();

-- Function to check and expire bids
CREATE OR REPLACE FUNCTION expire_old_bids()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE bids
  SET status = 'expired'
  WHERE status = 'sent'
    AND expiration_date < NOW()
    AND status != 'expired';
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;
