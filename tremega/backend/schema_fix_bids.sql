-- Fix Bids Table Schema
-- Run this in Supabase SQL Editor
-- This will DROP the existing bids table and recreate it with the correct schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DROP EXISTING BIDS TABLE (if exists)
-- ============================================

-- Drop dependent tables first (to avoid foreign key constraints)
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS sub_assignments CASCADE;
DROP TABLE IF EXISTS line_items CASCADE;
DROP TABLE IF EXISTS subs CASCADE;

-- Now drop the bids table
DROP TABLE IF EXISTS bids CASCADE;

-- ============================================
-- CREATE BIDS TABLE WITH CORRECT SCHEMA
-- ============================================

CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  estimated_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  contractor_id UUID NOT NULL,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  job_address TEXT,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  subtotal DECIMAL(12, 2) DEFAULT 0,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CREATE INDEXES
-- ============================================

CREATE INDEX idx_bids_contractor_id ON bids(contractor_id);
CREATE INDEX idx_bids_status ON bids(status);
CREATE INDEX idx_bids_created_at ON bids(created_at DESC);
CREATE INDEX idx_bids_expires_at ON bids(expires_at);
CREATE INDEX idx_bids_customer_email ON bids(customer_email);

-- ============================================
-- CREATE UPDATED_AT TRIGGER
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to bids table
CREATE TRIGGER update_bids_updated_at BEFORE UPDATE ON bids
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Create permissive policy (you can restrict this later)
CREATE POLICY "Allow all for now" ON bids FOR ALL USING (true);

-- ============================================
-- INSERT TEST DATA
-- ============================================

INSERT INTO bids (id, title, description, estimated_amount, status, contractor_id, customer_name, customer_email, customer_phone, job_address, tax_rate, subtotal, tax_amount, total, expires_at, sent_at, accepted_at, rejected_at, created_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kitchen Renovation', 'Complete kitchen remodel including cabinets, countertops, and appliances', 25000.00, 'sent', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Alice Cooper', 'alice@example.com', '555-1001', '123 Main St, Anytown, USA', 8.5, 22995.00, 1954.58, 24949.58, NOW() + INTERVAL '30 days', NOW() - INTERVAL '5 days', NULL, NULL, NOW() - INTERVAL '5 days'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bathroom Remodel', 'Master bathroom renovation with new fixtures and tile', 15000.00, 'draft', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Bob Smith', 'bob@example.com', '555-1002', '456 Oak Ave, Anytown, USA', 8.5, 13795.00, 1172.58, 14967.58, NOW() + INTERVAL '30 days', NULL, NULL, NULL, NOW() - INTERVAL '2 days'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Deck Construction', 'Build new composite deck with railing', 12000.00, 'accepted', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Carol White', 'carol@example.com', '555-1003', '789 Pine Rd, Anytown, USA', 8.5, 11050.00, 939.25, 11989.25, NOW() + INTERVAL '30 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days', NULL, NOW() - INTERVAL '10 days'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Basement Finishing', 'Finish basement with drywall, flooring, and lighting', 30000.00, 'sent', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'David Lee', 'david@example.com', '555-1004', '321 Elm St, Anytown, USA', 8.5, 27650.00, 2350.25, 30000.25, NOW() + INTERVAL '30 days', NOW() - INTERVAL '3 days', NULL, NULL, NOW() - INTERVAL '3 days'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Roof Replacement', 'Complete roof tear-off and replacement', 18000.00, 'rejected', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Eve Johnson', 'eve@example.com', '555-1005', '654 Maple Dr, Anytown, USA', 8.5, 16590.00, 1410.15, 18000.15, NOW() + INTERVAL '30 days', NOW() - INTERVAL '15 days', NULL, NOW() - INTERVAL '12 days', NOW() - INTERVAL '15 days');

-- ============================================
-- RECREATE DEPENDENT TABLES
-- ============================================

-- 1. Subs table
CREATE TABLE subs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  skills TEXT[],
  rating DECIMAL(3, 2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  performance_score DECIMAL(5, 2) DEFAULT 0,
  total_jobs_completed INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subs_email ON subs(email);
CREATE INDEX idx_subs_status ON subs(status);
CREATE INDEX idx_subs_rating ON subs(rating DESC);

CREATE TRIGGER update_subs_updated_at BEFORE UPDATE ON subs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE subs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON subs FOR ALL USING (true);

-- 2. Line Items table
CREATE TABLE line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  assigned_sub_id UUID REFERENCES subs(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_line_items_bid_id ON line_items(bid_id);
CREATE INDEX idx_line_items_assigned_sub_id ON line_items(assigned_sub_id);

CREATE TRIGGER update_line_items_updated_at BEFORE UPDATE ON line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON line_items FOR ALL USING (true);

-- 3. Sub Assignments table
CREATE TABLE sub_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_item_id UUID NOT NULL REFERENCES line_items(id) ON DELETE CASCADE,
  sub_id UUID NOT NULL REFERENCES subs(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'started', 'completed')),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(line_item_id, sub_id)
);

CREATE INDEX idx_sub_assignments_line_item_id ON sub_assignments(line_item_id);
CREATE INDEX idx_sub_assignments_sub_id ON sub_assignments(sub_id);
CREATE INDEX idx_sub_assignments_status ON sub_assignments(status);

CREATE TRIGGER update_sub_assignments_updated_at BEFORE UPDATE ON sub_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE sub_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON sub_assignments FOR ALL USING (true);

-- 4. Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'general',
  is_read BOOLEAN DEFAULT FALSE,
  related_id UUID,
  related_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON notifications FOR ALL USING (true);

-- 5. Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  content TEXT NOT NULL,
  thread_id UUID,
  bid_id UUID REFERENCES bids(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_bid_id ON messages(bid_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON messages FOR ALL USING (true);

-- 6. Photos table
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  size INTEGER,
  mime_type VARCHAR(100),
  bid_id UUID REFERENCES bids(id) ON DELETE SET NULL,
  line_item_id UUID REFERENCES line_items(id) ON DELETE SET NULL,
  uploaded_by UUID,
  phase VARCHAR(20) DEFAULT 'progress' CHECK (phase IN ('bid', 'progress', 'completion')),
  description TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_photos_bid_id ON photos(bid_id);
CREATE INDEX idx_photos_line_item_id ON photos(line_item_id);
CREATE INDEX idx_photos_uploaded_at ON photos(uploaded_at DESC);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON photos FOR ALL USING (true);

-- ============================================
-- CREATE SUB PERFORMANCE TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_sub_performance()
RETURNS TRIGGER AS $$
DECLARE
  v_total INTEGER;
  v_on_time INTEGER;
  v_avg_hours DECIMAL;
  v_rate DECIMAL;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT COUNT(*) INTO v_total
    FROM sub_assignments
    WHERE sub_id = NEW.sub_id;
    
    SELECT COUNT(*) INTO v_on_time
    FROM sub_assignments
    WHERE sub_id = NEW.sub_id
      AND status = 'completed'
      AND completed_at <= assigned_at + INTERVAL '7 days';
    
    SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600) INTO v_avg_hours
    FROM sub_assignments
    WHERE sub_id = NEW.sub_id
      AND status = 'completed'
      AND started_at IS NOT NULL
      AND completed_at IS NOT NULL;
    
    IF v_total > 0 THEN
      v_rate := (v_on_time::DECIMAL / v_total) * 100;
    ELSE
      v_rate := 0;
    END IF;
    
    UPDATE subs
    SET total_jobs_completed = v_total,
        performance_score = v_rate,
        rating = LEAST(5, v_rate / 20)
    WHERE id = NEW.sub_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sub_assignment_completed
  AFTER UPDATE ON sub_assignments
  FOR EACH ROW EXECUTE FUNCTION update_sub_performance();

-- ============================================
-- INSERT TEST DATA FOR DEPENDENT TABLES
-- ============================================

-- Insert test subs
INSERT INTO subs (id, name, email, phone, skills, rating, performance_score, total_jobs_completed, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Mike Johnson', 'mike@example.com', '555-0101', ARRAY['plumbing', 'electrical'], 4.5, 90, 45, 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Sarah Williams', 'sarah@example.com', '555-0102', ARRAY['carpentry', 'painting'], 4.8, 95, 62, 'active'),
  ('33333333-3333-3333-3333-333333333333', 'Tom Brown', 'tom@example.com', '555-0103', ARRAY['hvac', 'plumbing'], 4.2, 85, 38, 'active'),
  ('44444444-4444-4444-4444-444444444444', 'Lisa Davis', 'lisa@example.com', '555-0104', ARRAY['electrical', 'smart-home'], 4.9, 98, 71, 'active'),
  ('55555555-5555-5555-5555-555555555555', 'John Smith', 'john@example.com', '555-0105', ARRAY['roofing', 'siding'], 4.0, 80, 29, 'active');

-- Insert test line items
INSERT INTO line_items (id, bid_id, description, quantity, unit_price, amount, assigned_sub_id, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Demolition and removal', 1, 2500.00, 2500.00, NULL, 1),
  ('10000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Cabinet installation', 1, 8500.00, 8500.00, '22222222-2222-2222-2222-222222222222', 2),
  ('10000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Countertop installation', 1, 4500.00, 4500.00, NULL, 3),
  ('10000000-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Plumbing rough-in and fixtures', 1, 3800.00, 3800.00, '11111111-1111-1111-1111-111111111111', 4),
  ('10000000-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Electrical wiring and outlets', 1, 3200.00, 3200.00, '44444444-4444-4444-4444-444444444444', 5),
  ('10000000-0000-0000-0000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Painting and finishing', 1, 495.00, 495.00, '22222222-2222-2222-2222-222222222222', 6),
  ('10000000-0000-0000-0000-000000000007', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Demolition', 1, 1200.00, 1200.00, NULL, 1),
  ('10000000-0000-0000-0000-000000000008', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Plumbing fixtures', 1, 4500.00, 4500.00, '11111111-1111-1111-1111-111111111111', 2),
  ('10000000-0000-0000-0000-000000000009', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tile installation', 1, 5200.00, 5200.00, NULL, 3),
  ('10000000-0000-0000-0000-000000000010', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Electrical', 1, 1895.00, 1895.00, '44444444-4444-4444-4444-444444444444', 4),
  ('10000000-0000-0000-0000-000000000011', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Painting', 1, 1000.00, 1000.00, '22222222-2222-2222-2222-222222222222', 5),
  ('10000000-0000-0000-0000-000000000012', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Deck framing', 1, 5500.00, 5500.00, NULL, 1),
  ('10000000-0000-0000-0000-000000000013', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Composite decking', 1, 3800.00, 3800.00, NULL, 2),
  ('10000000-0000-0000-0000-000000000014', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Railing installation', 1, 1750.00, 1750.00, NULL, 3),
  ('10000000-0000-0000-0000-000000000015', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Framing and insulation', 1, 8500.00, 8500.00, NULL, 1),
  ('10000000-0000-0000-0000-000000000016', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Drywall installation', 1, 6200.00, 6200.00, NULL, 2),
  ('10000000-0000-0000-0000-000000000017', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Electrical wiring', 1, 4800.00, 4800.00, '44444444-4444-4444-4444-444444444444', 3),
  ('10000000-0000-0000-0000-000000000018', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Flooring', 1, 5500.00, 5500.00, NULL, 4),
  ('10000000-0000-0000-0000-000000000019', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Painting', 1, 2650.00, 2650.00, '22222222-2222-2222-2222-222222222222', 5),
  ('10000000-0000-0000-0000-000000000020', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Roof tear-off', 1, 3500.00, 3500.00, '55555555-5555-5555-5555-555555555555', 1),
  ('10000000-0000-0000-0000-000000000021', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'New shingle installation', 1, 9800.00, 9800.00, '55555555-5555-5555-5555-555555555555', 2),
  ('10000000-0000-0000-0000-000000000022', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Gutter replacement', 1, 3290.00, 3290.00, '55555555-5555-5555-5555-555555555555', 3);

-- Insert test sub assignments
INSERT INTO sub_assignments (id, line_item_id, sub_id, status, assigned_at, started_at, completed_at) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'completed', NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'started', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', NULL),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444', 'assigned', NOW() - INTERVAL '1 day', NULL, NULL),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'assigned', NOW() - INTERVAL '1 day', NULL, NULL),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000017', '44444444-4444-4444-4444-444444444444', 'completed', NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days');

-- Insert test notifications
INSERT INTO notifications (id, user_id, title, message, type, is_read, related_id, related_type, created_at) VALUES
  ('30000000-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'New Bid Request', 'You have received a new bid request for Kitchen Renovation', 'bid', false, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bid', NOW() - INTERVAL '5 days'),
  ('30000000-0000-0000-0000-000000000002', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Bid Accepted', 'Your bid for Deck Construction has been accepted', 'bid', true, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'bid', NOW() - INTERVAL '10 days'),
  ('30000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'New Assignment', 'You have been assigned to Plumbing rough-in and fixtures', 'assignment', false, '20000000-0000-0000-0000-000000000002', 'sub_assignment', NOW() - INTERVAL '2 days'),
  ('30000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'New Assignment', 'You have been assigned to Electrical wiring and outlets', 'assignment', false, '20000000-0000-0000-0000-000000000003', 'sub_assignment', NOW() - INTERVAL '1 day'),
  ('30000000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'Assignment Completed', 'Cabinet installation has been marked as completed', 'assignment', true, '20000000-0000-0000-0000-000000000001', 'sub_assignment', NOW() - INTERVAL '1 day');

-- Insert test messages
INSERT INTO messages (id, sender_id, recipient_id, content, thread_id, bid_id, is_read, created_at) VALUES
  ('40000000-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Hi Mike, can you start the plumbing work tomorrow?', '50000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, NOW() - INTERVAL '2 days'),
  ('40000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Yes, I''ll be there at 8am. Do I need to bring any materials?', '50000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, NOW() - INTERVAL '2 days' + INTERVAL '1 hour'),
  ('40000000-0000-0000-0000-000000000003', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'No, all materials are on site. Thanks!', '50000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false, NOW() - INTERVAL '2 days' + INTERVAL '2 hours'),
  ('40000000-0000-0000-0000-000000000004', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '44444444-4444-4444-4444-444444444444', 'Lisa, when can you start the electrical work?', '50000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false, NOW() - INTERVAL '1 day');

-- Insert test photos
INSERT INTO photos (id, url, filename, size, mime_type, bid_id, line_item_id, uploaded_by, phase, description, uploaded_at) VALUES
  ('60000000-0000-0000-0000-000000000001', 'https://example.com/photos/kitchen-before.jpg', 'kitchen-before.jpg', 245000, 'image/jpeg', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'bid', 'Kitchen before renovation', NOW() - INTERVAL '5 days'),
  ('60000000-0000-0000-0000-000000000002', 'https://example.com/photos/cabinets-progress.jpg', 'cabinets-progress.jpg', 312000, 'image/jpeg', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '10000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'progress', 'Cabinet installation in progress', NOW() - INTERVAL '2 days'),
  ('60000000-0000-0000-0000-000000000003', 'https://example.com/photos/deck-complete.jpg', 'deck-complete.jpg', 428000, 'image/jpeg', 'cccccccc-cccc-cccc-cccc-cccccccccccc', NULL, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'completion', 'Completed deck', NOW() - INTERVAL '8 days');

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'bids' as table_name, COUNT(*) as row_count FROM bids
UNION ALL
SELECT 'line_items', COUNT(*) FROM line_items
UNION ALL
SELECT 'subs', COUNT(*) FROM subs
UNION ALL
SELECT 'sub_assignments', COUNT(*) FROM sub_assignments
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'photos', COUNT(*) FROM photos;
