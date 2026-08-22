-- Supabase SQL Schema for Tremega Sub/Contractor Management
-- Run this AFTER the bids schema

-- Create user_roles table
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'contractor', 'sub', 'worker')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, business_id)
);

-- Create sub_assignments table
CREATE TABLE sub_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_line_item_id UUID NOT NULL REFERENCES bid_line_items(id) ON DELETE CASCADE,
  sub_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'started', 'completed')),
  assigned_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sub_assignment', 'message', 'job_update', 'photo_upload')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  related_id UUID,
  related_type TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID REFERENCES bids(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  sub_assignment_id UUID REFERENCES sub_assignments(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create job_photos table
CREATE TABLE job_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  bid_id UUID REFERENCES bids(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  description TEXT,
  phase TEXT NOT NULL CHECK (phase IN ('bid', 'progress', 'completion')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create sub_performance table
CREATE TABLE sub_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  total_assignments INTEGER DEFAULT 0,
  completed_on_time INTEGER DEFAULT 0,
  completion_rate DECIMAL DEFAULT 0.0,
  avg_turnaround_hours DECIMAL,
  last_updated TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(sub_user_id, business_id)
);

-- Create indexes
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_business_id ON user_roles(business_id);
CREATE INDEX idx_sub_assignments_sub_user_id ON sub_assignments(sub_user_id);
CREATE INDEX idx_sub_assignments_bid_id ON sub_assignments(bid_id);
CREATE INDEX idx_sub_assignments_business_id ON sub_assignments(business_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_business_id ON notifications(business_id);
CREATE INDEX idx_messages_bid_id ON messages(bid_id);
CREATE INDEX idx_messages_job_id ON messages(job_id);
CREATE INDEX idx_messages_business_id ON messages(business_id);
CREATE INDEX idx_job_photos_job_id ON job_photos(job_id);
CREATE INDEX idx_job_photos_business_id ON job_photos(business_id);
CREATE INDEX idx_sub_performance_sub_user_id ON sub_performance(sub_user_id);
CREATE INDEX idx_sub_performance_business_id ON sub_performance(business_id);

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_business_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_description TEXT DEFAULT '',
  p_related_id UUID DEFAULT NULL,
  p_related_type TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, business_id, type, title, description, related_id, related_type)
  VALUES (p_user_id, p_business_id, p_type, p_title, p_description, p_related_id, p_related_type)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update sub performance when assignment is completed
CREATE OR REPLACE FUNCTION update_sub_performance()
RETURNS TRIGGER AS $$
DECLARE
  v_total INTEGER;
  v_on_time INTEGER;
  v_avg_hours DECIMAL;
  v_rate DECIMAL;
BEGIN
  -- Only process when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get total assignments for this sub in this business
    SELECT COUNT(*) INTO v_total
    FROM sub_assignments
    WHERE sub_user_id = NEW.sub_user_id AND business_id = NEW.business_id;
    
    -- Get completed on time count (assuming 7 days is the deadline for now)
    SELECT COUNT(*) INTO v_on_time
    FROM sub_assignments
    WHERE sub_user_id = NEW.sub_user_id 
      AND business_id = NEW.business_id
      AND status = 'completed'
      AND completed_at <= assigned_at + INTERVAL '7 days';
    
    -- Calculate average turnaround hours
    SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600) INTO v_avg_hours
    FROM sub_assignments
    WHERE sub_user_id = NEW.sub_user_id 
      AND business_id = NEW.business_id
      AND status = 'completed'
      AND started_at IS NOT NULL
      AND completed_at IS NOT NULL;
    
    -- Calculate completion rate
    IF v_total > 0 THEN
      v_rate := (v_on_time::DECIMAL / v_total) * 100;
    ELSE
      v_rate := 0;
    END IF;
    
    -- Insert or update performance record
    INSERT INTO sub_performance (sub_user_id, business_id, total_assignments, completed_on_time, completion_rate, avg_turnaround_hours, last_updated)
    VALUES (NEW.sub_user_id, NEW.business_id, v_total, v_on_time, v_rate, v_avg_hours, NOW())
    ON CONFLICT (sub_user_id, business_id)
    DO UPDATE SET
      total_assignments = v_total,
      completed_on_time = v_on_time,
      completion_rate = v_rate,
      avg_turnaround_hours = v_avg_hours,
      last_updated = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sub_assignment_completed
  AFTER UPDATE ON sub_assignments
  FOR EACH ROW EXECUTE FUNCTION update_sub_performance();

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
CREATE POLICY "Users can view roles in their business" ON user_roles
  FOR SELECT USING (business_id IN (SELECT business_id FROM user_roles WHERE user_id = auth.uid()));

-- RLS Policies for sub_assignments
CREATE POLICY "Users can view assignments in their business" ON sub_assignments
  FOR SELECT USING (business_id IN (SELECT business_id FROM user_roles WHERE user_id = auth.uid()));

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their business" ON messages
  FOR SELECT USING (business_id IN (SELECT business_id FROM user_roles WHERE user_id = auth.uid()));

-- RLS Policies for job_photos
CREATE POLICY "Users can view photos in their business" ON job_photos
  FOR SELECT USING (business_id IN (SELECT business_id FROM user_roles WHERE user_id = auth.uid()));

-- RLS Policies for sub_performance
CREATE POLICY "Users can view performance in their business" ON sub_performance
  FOR SELECT USING (business_id IN (SELECT business_id FROM user_roles WHERE user_id = auth.uid()));
