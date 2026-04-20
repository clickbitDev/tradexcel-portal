-- Migration: Add contact and management fields to RTOs
-- Purpose: Enable tracking of RTO contact person, assigned manager, and provider name

-- Add new columns to rtos table
ALTER TABLE public.rtos
ADD COLUMN IF NOT EXISTS contact_person_name TEXT,
ADD COLUMN IF NOT EXISTS assigned_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS provider_name TEXT;

-- Add index for faster lookups by assigned manager
CREATE INDEX IF NOT EXISTS idx_rtos_assigned_manager ON public.rtos(assigned_manager_id);

-- Add comment for documentation
COMMENT ON COLUMN public.rtos.contact_person_name IS 'Name of the primary contact person at the RTO';
COMMENT ON COLUMN public.rtos.assigned_manager_id IS 'Staff member assigned to manage this RTO relationship';
COMMENT ON COLUMN public.rtos.provider_name IS 'Alternative/trading name of the provider';
