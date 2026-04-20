-- ============================================
-- LUMIERE PORTAL DATABASE MIGRATION
-- Migration: 039_extended_fee_columns
-- Purpose: Add extended fee columns to rto_offerings and assessor_rate to profiles
-- ============================================

-- ============================================
-- 1. EXTENDED FEE COLUMNS ON RTO_OFFERINGS
-- ============================================

-- Agent Fee - Fee payable to agent for this offering
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS agent_fee DECIMAL(10,2) DEFAULT 0;

-- Lumiere Fee - Lumiere service fee for this offering
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS lumiere_fee DECIMAL(10,2) DEFAULT 0;

-- Student Fee - Additional student fee for this offering
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS student_fee DECIMAL(10,2) DEFAULT 0;

-- Enrollment Fee - Enrollment processing fee
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS enrollment_fee DECIMAL(10,2) DEFAULT 0;

-- Miscellaneous Fee - Any other miscellaneous fees
ALTER TABLE rto_offerings ADD COLUMN IF NOT EXISTS misc_fee DECIMAL(10,2) DEFAULT 0;

-- ============================================
-- 2. ASSESSOR RATE ON PROFILES
-- ============================================

-- Assessor Rate - Fixed fee rate for assessors
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assessor_rate DECIMAL(10,2);

-- ============================================
-- 3. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN rto_offerings.agent_fee IS 'Fee payable to agent for this offering';
COMMENT ON COLUMN rto_offerings.lumiere_fee IS 'Lumiere service fee for this offering';
COMMENT ON COLUMN rto_offerings.student_fee IS 'Additional student fee for this offering';
COMMENT ON COLUMN rto_offerings.enrollment_fee IS 'Enrollment processing fee';
COMMENT ON COLUMN rto_offerings.misc_fee IS 'Miscellaneous fees';
COMMENT ON COLUMN profiles.assessor_rate IS 'Fixed fee rate for assessor role users';

-- ============================================
-- 4. INDEXES (for potential filtering/sorting)
-- ============================================

-- No indexes needed for fee columns as they are mainly for display
