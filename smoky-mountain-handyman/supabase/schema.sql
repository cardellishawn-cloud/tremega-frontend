-- Smoky Mountain Handyman - Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (property managers + admins)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  role VARCHAR(50) DEFAULT 'manager', -- 'manager' or 'admin'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contractors
CREATE TABLE contractors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  skills TEXT[] DEFAULT '{}', -- e.g. {plumbing, electrical, hvac, carpentry, painting, general}
  hourly_rate DECIMAL(10,2) DEFAULT 75.00,
  availability_status VARCHAR(50) DEFAULT 'available', -- available, busy, offline
  rating DECIMAL(3,2) DEFAULT 5.0,
  jobs_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  owner_name VARCHAR(255),
  phone VARCHAR(50),
  owner_email VARCHAR(255),
  property_type VARCHAR(100) DEFAULT 'residential', -- residential, commercial, cabin, condo
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
  title VARCHAR(255),
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, assigned, in_progress, complete, cancelled
  urgency VARCHAR(50) DEFAULT 'medium', -- low, medium, high, emergency
  estimated_cost DECIMAL(10,2),
  final_cost DECIMAL(10,2),
  ai_assignment_reason TEXT,
  photos_url TEXT[] DEFAULT '{}',
  scheduled_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Status History
CREATE TABLE job_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
  invoice_number VARCHAR(50) UNIQUE,
  labor_hours DECIMAL(5,2),
  labor_rate DECIMAL(10,2),
  materials_cost DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, paid, overdue
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_contractor_id ON jobs(contractor_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_urgency ON jobs(urgency);
CREATE INDEX idx_job_status_history_job_id ON job_status_history(job_id);
CREATE INDEX idx_properties_user_id ON properties(user_id);
CREATE INDEX idx_invoices_job_id ON invoices(job_id);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Service role bypass (backend uses service_role key)
-- These policies allow the service role to do everything
CREATE POLICY "Service role full access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON contractors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON properties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON job_status_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON invoices FOR ALL USING (true) WITH CHECK (true);

-- Seed some contractors for testing
INSERT INTO contractors (name, phone, email, skills, hourly_rate, availability_status) VALUES
  ('Mike Thompson', '865-555-0101', 'mike@smokymtnhandyman.com', '{plumbing,general,carpentry}', 85.00, 'available'),
  ('Dave Wilson', '865-555-0102', 'dave@smokymtnhandyman.com', '{electrical,hvac,general}', 95.00, 'available'),
  ('Jake Barnes', '865-555-0103', 'jake@smokymtnhandyman.com', '{plumbing,electrical,painting}', 75.00, 'available'),
  ('Tom Garcia', '865-555-0104', 'tom@smokymtnhandyman.com', '{carpentry,painting,drywall}', 70.00, 'available'),
  ('Chris Lee', '865-555-0105', 'chris@smokymtnhandyman.com', '{hvac,electrical,plumbing,carpentry}', 110.00, 'busy');
