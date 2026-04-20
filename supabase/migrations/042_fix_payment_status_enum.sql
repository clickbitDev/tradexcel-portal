-- Migration: Fix payment_status enum type
-- This ensures the payment_status enum exists and the applications table uses it correctly

-- Create the enum type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('unpaid', 'partial', 'paid', 'refunded');
        RAISE NOTICE 'Created payment_status enum type';
    ELSE
        RAISE NOTICE 'payment_status enum type already exists';
    END IF;
END$$;

-- If the column exists but is a different type (e.g., text), alter it to use the enum
DO $$
BEGIN
    -- Check if applications table exists and column needs updating
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'applications' 
        AND column_name = 'payment_status'
        AND data_type != 'USER-DEFINED'
    ) THEN
        -- Alter the column to use the enum type
        ALTER TABLE applications 
            ALTER COLUMN payment_status TYPE payment_status 
            USING payment_status::payment_status;
        RAISE NOTICE 'Converted payment_status column to enum type';
    ELSE
        RAISE NOTICE 'payment_status column already uses correct type';
    END IF;
END$$;

-- Ensure default value is set
ALTER TABLE applications 
    ALTER COLUMN payment_status SET DEFAULT 'unpaid'::payment_status;
