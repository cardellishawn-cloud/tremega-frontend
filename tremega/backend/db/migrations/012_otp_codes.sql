-- 012_otp_codes.sql
-- Phase 2 Week 1: OTP codes for SMS login.
-- Codes are stored sha256-hashed only; 10-minute expiry enforced app-side.

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON otp_codes(expires_at);

-- Optional housekeeping: delete codes expired more than a day ago.
-- DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 day';
