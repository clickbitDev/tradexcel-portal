-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'manager', 'staff', 'agent', 'ceo', 'executive_manager', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'developer');

-- CreateEnum
CREATE TYPE "qualification_status" AS ENUM ('current', 'superseded', 'deleted');

-- CreateEnum
CREATE TYPE "tga_sync_status" AS ENUM ('synced', 'pending', 'error', 'never');

-- CreateEnum
CREATE TYPE "rto_status" AS ENUM ('active', 'pending', 'suspended', 'inactive');

-- CreateEnum
CREATE TYPE "partner_type" AS ENUM ('agent', 'provider', 'subagent');

-- CreateEnum
CREATE TYPE "partner_status" AS ENUM ('active', 'pending', 'suspended', 'inactive');

-- CreateEnum
CREATE TYPE "priority_level" AS ENUM ('standard', 'preferred', 'premium');

-- CreateEnum
CREATE TYPE "workflow_stage" AS ENUM ('draft', 'submitted', 'docs_review', 'rto_processing', 'offer_issued', 'payment_pending', 'coe_issued', 'visa_applied', 'enrolled', 'evaluate', 'dispatch', 'completed', 'withdrawn', 'rejected');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('unpaid', 'partial', 'paid', 'refunded');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "ticket_priority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('email', 'whatsapp', 'sms');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('pending', 'sent', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "reminder_status" AS ENUM ('active', 'paused', 'completed', 'expired');

-- CreateEnum
CREATE TYPE "query_source_type" AS ENUM ('web_form', 'api', 'manual', 'import', 'referral', 'walk_in');

-- CreateEnum
CREATE TYPE "contact_channel" AS ENUM ('email', 'phone', 'whatsapp', 'meeting', 'other');

-- CreateEnum
CREATE TYPE "sync_result" AS ENUM ('success', 'partial', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('application_update', 'document_uploaded', 'document_verified', 'comment_added', 'mention', 'payment_received', 'reminder', 'approval_required', 'partner_update', 'system_alert', 'welcome', 'deadline_warning', 'assignment');

-- CreateEnum
CREATE TYPE "bill_status" AS ENUM ('pending', 'received', 'paid', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "bulk_operation_type" AS ENUM ('invoice', 'bill');

-- CreateEnum
CREATE TYPE "bulk_operation_status" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "document_type_enum" AS ENUM ('passport', 'visa', 'drivers_license', 'qualification', 'resume', 'academic_transcript', 'english_test', 'coe', 'offer_letter', 'invoice', 'bill', 'other');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "assessment_result" AS ENUM ('pending', 'pass', 'failed');

-- CreateEnum
CREATE TYPE "application_outcome" AS ENUM ('active', 'withdrawn', 'rejected');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'agent',
    "avatar_url" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "company_name" TEXT,
    "secondary_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "social_links" JSONB DEFAULT '{}'::jsonb,
    "assessor_rate" DECIMAL(10,2),
    "account_status" "account_status" NOT NULL DEFAULT 'active',

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "status" "qualification_status" DEFAULT 'current',
    "release_date" DATE,
    "superseded_by" TEXT,
    "tga_sync_status" "tga_sync_status" DEFAULT 'never',
    "tga_last_synced_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "is_archived" BOOLEAN DEFAULT false,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by" UUID,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "core_units" INTEGER,
    "elective_units" INTEGER,
    "total_units" INTEGER,
    "entry_requirements" TEXT,
    "cricos_code" VARCHAR(20),
    "delivery_mode" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_edited_by" UUID,
    "prerequisites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certificate_preview_path" TEXT,
    "certificate_preview_provider" TEXT,
    "certificate_preview_bucket" TEXT,
    "certificate_preview_key" TEXT,

    CONSTRAINT "qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtos" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "status" "rto_status" DEFAULT 'active',
    "location" TEXT,
    "state" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "cricos_provider_code" VARCHAR(20),
    "delivery_modes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certificate_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tga_sync_status" "tga_sync_status" DEFAULT 'never',
    "tga_last_synced_at" TIMESTAMPTZ(6),
    "tga_sync_error" TEXT,
    "is_archived" BOOLEAN DEFAULT false,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by" UUID,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "contact_person_name" TEXT,
    "assigned_manager_id" UUID,
    "provider_name" TEXT,
    "xero_contact_id" VARCHAR(100),
    "xero_contact_url" VARCHAR(500),

    CONSTRAINT "rtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rto_offerings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "rto_id" UUID NOT NULL,
    "qualification_id" UUID NOT NULL,
    "tuition_fee_onshore" DECIMAL(10,2),
    "tuition_fee_offshore" DECIMAL(10,2),
    "material_fee" DECIMAL(10,2) DEFAULT 0,
    "application_fee" DECIMAL(10,2) DEFAULT 0,
    "duration_weeks" INTEGER,
    "intakes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "effective_date" DATE DEFAULT CURRENT_DATE,
    "expiry_date" DATE,
    "version" INTEGER DEFAULT 1,
    "approval_status" VARCHAR(20) DEFAULT 'published',
    "is_archived" BOOLEAN DEFAULT false,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by" UUID,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "agent_fee" DECIMAL(10,2) DEFAULT 0,
    "lumiere_fee" DECIMAL(10,2) DEFAULT 0,
    "student_fee" DECIMAL(10,2) DEFAULT 0,
    "enrollment_fee" DECIMAL(10,2) DEFAULT 0,
    "misc_fee" DECIMAL(10,2) DEFAULT 0,
    "assessor_fee" DECIMAL(10,2) DEFAULT 0,
    "provider_fee" DECIMAL(10,2) DEFAULT 0,

    CONSTRAINT "rto_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "type" "partner_type" NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "country" TEXT,
    "commission_rate" DECIMAL(5,2),
    "priority_level" "priority_level" DEFAULT 'standard',
    "user_id" UUID,
    "status" "partner_status" DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "delivery_method" VARCHAR(50),
    "kpi_ontime_rate" DECIMAL(5,2),
    "kpi_conversion_rate" DECIMAL(5,2),
    "assigned_manager_id" UUID,
    "is_archived" BOOLEAN DEFAULT false,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by" UUID,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "preferred_channel" "contact_channel",
    "linked_rto_id" UUID,
    "parent_partner_id" UUID,
    "xero_contact_id" VARCHAR(100),
    "xero_contact_url" VARCHAR(500),

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_master" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "passport_number" VARCHAR(50),
    "nationality" VARCHAR(100),
    "dob" DATE,
    "address" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "usi" VARCHAR(20),
    "visa_number" VARCHAR(50),
    "visa_expiry" DATE,
    "gender" VARCHAR(20),
    "country_of_birth" VARCHAR(100),
    "street_no" TEXT,
    "suburb" VARCHAR(100),
    "state" VARCHAR(50),
    "postcode" VARCHAR(20),

    CONSTRAINT "student_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "student_uid" TEXT NOT NULL,
    "student_first_name" TEXT NOT NULL,
    "student_last_name" TEXT NOT NULL,
    "student_email" TEXT,
    "student_phone" TEXT,
    "student_dob" DATE,
    "student_passport_number" TEXT,
    "student_nationality" TEXT,
    "partner_id" UUID,
    "offering_id" UUID,
    "workflow_stage" "workflow_stage" DEFAULT 'draft',
    "payment_status" "payment_status" DEFAULT 'unpaid',
    "quoted_tuition" DECIMAL(10,2),
    "quoted_materials" DECIMAL(10,2),
    "total_paid" DECIMAL(10,2) DEFAULT 0,
    "intake_date" DATE,
    "submitted_at" TIMESTAMPTZ(6),
    "coe_issued_at" TIMESTAMPTZ(6),
    "documents" JSONB DEFAULT '[]'::jsonb,
    "created_by" UUID,
    "assigned_to" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "assigned_staff_id" UUID,
    "locked_by" UUID,
    "lock_timestamp" TIMESTAMPTZ(6),
    "student_master_id" UUID,
    "query_source" "query_source_type",
    "query_source_id" VARCHAR(100),
    "lead_source_id" UUID,
    "referrer_url" TEXT,
    "is_archived" BOOLEAN DEFAULT false,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by" UUID,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "student_gender" VARCHAR(20),
    "student_country_of_birth" VARCHAR(100),
    "application_from" VARCHAR(100),
    "student_street_no" TEXT,
    "student_suburb" VARCHAR(100),
    "student_state" VARCHAR(50),
    "student_postcode" VARCHAR(20),
    "received_by" UUID,
    "received_at" TIMESTAMPTZ(6),
    "last_updated_by" UUID,
    "notes" TEXT,
    "issue_date" DATE,
    "signed_off_by" UUID,
    "signed_off_at" TIMESTAMPTZ(6),
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ(6),
    "needs_attention" BOOLEAN DEFAULT false,
    "ready_to_check" BOOLEAN DEFAULT false,
    "ready_to_check_at" TIMESTAMPTZ(6),
    "docs_prepared_by" UUID,
    "docs_prepared_at" TIMESTAMPTZ(6),
    "docs_checked_by" UUID,
    "docs_checked_at" TIMESTAMPTZ(6),
    "docs_approved_by" UUID,
    "docs_approved_at" TIMESTAMPTZ(6),
    "provider_email" VARCHAR(255),
    "additional_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sent_by" UUID,
    "sent_at" TIMESTAMPTZ(6),
    "delivery_method" VARCHAR(50),
    "delivered_by" UUID,
    "delivery_date" DATE,
    "tracking_url" TEXT,
    "is_delivered" BOOLEAN DEFAULT false,
    "has_qualifications_docs" BOOLEAN DEFAULT false,
    "has_id_docs" BOOLEAN DEFAULT false,
    "has_misc_docs" BOOLEAN DEFAULT false,
    "student_address" TEXT,
    "student_usi" VARCHAR(10),
    "student_visa_number" VARCHAR(50),
    "student_visa_expiry" DATE,
    "has_invoice" BOOLEAN DEFAULT false,
    "latest_invoice_id" UUID,
    "invoice_sent_at" TIMESTAMPTZ(6),
    "has_bill" BOOLEAN DEFAULT false,
    "latest_bill_id" UUID,
    "bill_created_at" TIMESTAMPTZ(6),
    "lock_timeout" interval,
    "assigned_assessor_id" UUID,
    "assigned_admin_id" UUID,
    "assessor_fee" DECIMAL(10,2) DEFAULT 0,
    "xero_invoice_id" VARCHAR(100),
    "xero_invoice_number" VARCHAR(50),
    "xero_invoice_status" VARCHAR(30),
    "xero_invoice_url" VARCHAR(500),
    "xero_bill_id" VARCHAR(100),
    "xero_bill_number" VARCHAR(50),
    "xero_bill_status" VARCHAR(30),
    "xero_bill_url" VARCHAR(500),
    "xero_last_synced_at" TIMESTAMPTZ(6),
    "application_number" TEXT NOT NULL,
    "workflow_stage_updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualification_id" UUID,
    "admin_applicant_pdf_email_completed" BOOLEAN NOT NULL DEFAULT false,
    "admin_applicant_pdf_email_completed_at" TIMESTAMPTZ(6),
    "admin_applicant_pdf_email_completed_by" UUID,
    "admin_references_email_completed" BOOLEAN NOT NULL DEFAULT false,
    "admin_references_email_completed_at" TIMESTAMPTZ(6),
    "admin_references_email_completed_by" UUID,
    "agent_applicant_pdf_email_completed" BOOLEAN NOT NULL DEFAULT false,
    "agent_applicant_pdf_email_completed_at" TIMESTAMPTZ(6),
    "agent_applicant_pdf_email_completed_by" UUID,
    "agent_references_email_completed" BOOLEAN NOT NULL DEFAULT false,
    "agent_references_email_completed_at" TIMESTAMPTZ(6),
    "agent_references_email_completed_by" UUID,
    "agent_enrollment_agreement_uploaded" BOOLEAN NOT NULL DEFAULT false,
    "agent_enrollment_agreement_uploaded_at" TIMESTAMPTZ(6),
    "agent_enrollment_agreement_uploaded_by" UUID,
    "agent_enrollment_agreement_document_id" UUID,
    "agent_executive_manager_notified" BOOLEAN NOT NULL DEFAULT false,
    "agent_executive_manager_notified_at" TIMESTAMPTZ(6),
    "agent_executive_manager_notified_by" UUID,
    "assessment_result" "assessment_result" NOT NULL DEFAULT 'pending',
    "assessment_result_at" TIMESTAMPTZ(6),
    "assessment_result_by" UUID,
    "evaluation_started_at" TIMESTAMPTZ(6),
    "evaluation_started_by" UUID,
    "application_outcome" "application_outcome" NOT NULL DEFAULT 'active',
    "agent_frontdesk_notified" BOOLEAN NOT NULL DEFAULT false,
    "agent_frontdesk_notified_at" TIMESTAMPTZ(6),
    "agent_frontdesk_notified_by" UUID,
    "admin_accounts_manager_bill_requested" BOOLEAN NOT NULL DEFAULT false,
    "admin_accounts_manager_bill_requested_at" TIMESTAMPTZ(6),
    "admin_accounts_manager_bill_requested_by" UUID,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID,
    "partner_id" UUID,
    "document_type" VARCHAR(100) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" VARCHAR(100),
    "version" INTEGER DEFAULT 1,
    "is_verified" BOOLEAN DEFAULT false,
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "is_archived" BOOLEAN DEFAULT false,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by" UUID,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "extracted_data" JSONB,
    "extraction_status" VARCHAR(20) DEFAULT 'pending',
    "extraction_error" TEXT,
    "extracted_at" TIMESTAMPTZ(6),
    "document_type_validated" "document_type_enum",
    "storage_provider" TEXT,
    "storage_bucket" TEXT,
    "storage_key" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "table_name" VARCHAR(100) NOT NULL,
    "record_id" UUID,
    "old_data" JSONB,
    "new_data" JSONB,
    "ip_address" inet,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subject" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "ticket_status" DEFAULT 'open',
    "priority" "ticket_priority" DEFAULT 'normal',
    "application_id" UUID,
    "partner_id" UUID,
    "created_by" UUID,
    "assigned_to" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID,
    "user_id" UUID,
    "content" TEXT NOT NULL,
    "is_internal" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID,
    "user_id" UUID,
    "content" TEXT NOT NULL,
    "is_internal" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID,
    "from_stage" VARCHAR(50),
    "to_stage" VARCHAR(50) NOT NULL,
    "changed_by" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "is_archived" BOOLEAN DEFAULT false,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by" UUID,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "offering_id" UUID,
    "tuition_fee_onshore" DECIMAL(10,2),
    "tuition_fee_offshore" DECIMAL(10,2),
    "material_fee" DECIMAL(10,2),
    "application_fee" DECIMAL(10,2),
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "approved_by" UUID,
    "approval_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_number" VARCHAR(20) NOT NULL,
    "application_id" UUID,
    "partner_id" UUID,
    "student_name" VARCHAR(255) NOT NULL,
    "course_name" VARCHAR(255),
    "rto_name" VARCHAR(255),
    "tuition_fee" DECIMAL(10,2) DEFAULT 0,
    "material_fee" DECIMAL(10,2) DEFAULT 0,
    "application_fee" DECIMAL(10,2) DEFAULT 0,
    "other_fees" DECIMAL(10,2) DEFAULT 0,
    "discount" DECIMAL(10,2) DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "status" VARCHAR(20) DEFAULT 'draft',
    "due_date" DATE,
    "paid_at" TIMESTAMPTZ(6),
    "pdf_url" TEXT,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "is_archived" BOOLEAN DEFAULT false,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by" UUID,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "invoice_type" VARCHAR(20) DEFAULT 'customer',
    "tax_rate" DECIMAL(5,2) DEFAULT 10,
    "tax_amount" DECIMAL(10,2) DEFAULT 0,
    "subtotal" DECIMAL(10,2),
    "payment_reference" VARCHAR(100),
    "payment_method" VARCHAR(50),
    "sent_at" TIMESTAMPTZ(6),
    "sent_to" VARCHAR(255),
    "sent_via" VARCHAR(20),
    "send_count" INTEGER DEFAULT 0,
    "issue_date" DATE DEFAULT CURRENT_DATE,
    "xero_invoice_id" VARCHAR(100),
    "xero_invoice_url" VARCHAR(500),
    "xero_sent_at" TIMESTAMPTZ(6),
    "xero_status" VARCHAR(30),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" INTEGER DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bill_number" VARCHAR(20) NOT NULL,
    "rto_id" UUID,
    "application_id" UUID,
    "description" TEXT,
    "rto_invoice_number" VARCHAR(100),
    "tuition_cost" DECIMAL(10,2) DEFAULT 0,
    "material_cost" DECIMAL(10,2) DEFAULT 0,
    "other_costs" DECIMAL(10,2) DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "status" "bill_status" DEFAULT 'pending',
    "due_date" DATE,
    "paid_at" TIMESTAMPTZ(6),
    "payment_reference" VARCHAR(100),
    "payment_method" VARCHAR(50),
    "is_archived" BOOLEAN DEFAULT false,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by" UUID,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "xero_bill_id" VARCHAR(100),
    "xero_bill_url" VARCHAR(500),
    "xero_status" VARCHAR(30),

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_line_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bill_id" UUID NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" INTEGER DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_operations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "bulk_operation_type" NOT NULL,
    "status" "bulk_operation_status" DEFAULT 'pending',
    "total_items" INTEGER DEFAULT 0,
    "processed_items" INTEGER DEFAULT 0,
    "failed_items" INTEGER DEFAULT 0,
    "error_log" JSONB DEFAULT '[]'::jsonb,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "bulk_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel" "notification_channel" NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255),
    "body" TEXT NOT NULL,
    "application_id" UUID,
    "partner_id" UUID,
    "template_id" UUID,
    "status" "notification_status" DEFAULT 'pending',
    "scheduled_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "retry_count" INTEGER DEFAULT 0,
    "max_retries" INTEGER DEFAULT 3,
    "metadata" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "invoice_id" UUID,
    "bill_id" UUID,

    CONSTRAINT "notification_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notification_id" UUID,
    "channel" "notification_channel" NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255),
    "status" "notification_status" NOT NULL,
    "provider_message_id" VARCHAR(255),
    "provider_response" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "sent_by" UUID,
    "recipient_name" VARCHAR(255),
    "invoice_id" UUID,
    "bill_id" UUID,
    "message_type" VARCHAR(50),

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reminders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "trigger_type" VARCHAR(50) NOT NULL,
    "trigger_config" JSONB NOT NULL,
    "notification_channel" "notification_channel" NOT NULL,
    "template_id" UUID,
    "custom_message" TEXT,
    "status" "reminder_status" DEFAULT 'active',
    "last_run_at" TIMESTAMPTZ(6),
    "next_run_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reminder_id" UUID,
    "application_id" UUID,
    "notification_id" UUID,
    "triggered_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "reminder_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "source_type" "query_source_type" NOT NULL,
    "identifier" VARCHAR(100),
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "total_leads" INTEGER DEFAULT 0,
    "conversion_rate" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_impersonation_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "impersonated_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "ip_address" inet,
    "user_agent" TEXT,
    "actions_count" INTEGER DEFAULT 0,

    CONSTRAINT "admin_impersonation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_transitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "from_stage" "workflow_stage" NOT NULL,
    "to_stage" "workflow_stage" NOT NULL,
    "is_allowed" BOOLEAN NOT NULL DEFAULT true,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "required_role" "user_role",
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "allowed_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "table_name" VARCHAR(100) NOT NULL,
    "record_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "changed_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "change_type" VARCHAR(20) NOT NULL,
    "changed_by" UUID,
    "change_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_activity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "table_name" VARCHAR(100) NOT NULL,
    "record_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "user_id" UUID,
    "user_name" TEXT,
    "ip_address" inet,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" TEXT NOT NULL,
    "permission_key" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_hidden_fields" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" "user_role" NOT NULL,
    "field_name" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT 'application',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_hidden_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualification_units" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "qualification_id" UUID NOT NULL,
    "unit_code" TEXT NOT NULL,
    "unit_title" TEXT NOT NULL,
    "unit_type" TEXT,
    "field_of_education" TEXT,
    "nominal_hours" INTEGER,
    "is_current" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qualification_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tga_sync_log" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "qualification_id" UUID,
    "sync_result" "sync_result" NOT NULL,
    "changes_detected" JSONB DEFAULT '{}'::jsonb,
    "api_response" JSONB,
    "error_message" TEXT,
    "synced_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tga_sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_contact_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "channel" "contact_channel" NOT NULL,
    "subject" VARCHAR(255),
    "content" TEXT,
    "contacted_by" UUID,
    "contacted_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_contact_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_reminders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "reminder_type" VARCHAR(50) NOT NULL,
    "template_id" UUID,
    "days_before" INTEGER NOT NULL DEFAULT 7,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_request_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "document_types" TEXT[],
    "notes" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "max_uploads" INTEGER,
    "current_uploads" INTEGER DEFAULT 0,
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_request_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_commission_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "qualification_id" UUID,
    "min_volume" INTEGER,
    "max_volume" INTEGER,
    "commission_rate" DECIMAL(5,2) NOT NULL,
    "effective_from" DATE NOT NULL DEFAULT CURRENT_DATE,
    "effective_to" DATE,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessor_qualifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "assessor_id" UUID NOT NULL,
    "qualification_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessor_qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "related_table" VARCHAR(100),
    "related_id" UUID,
    "metadata" JSONB DEFAULT '{}'::jsonb,
    "is_read" BOOLEAN DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "priority" VARCHAR(20) DEFAULT 'normal',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email_enabled" BOOLEAN DEFAULT true,
    "email_frequency" VARCHAR(20) DEFAULT 'instant',
    "in_app_application_updates" BOOLEAN DEFAULT true,
    "in_app_documents" BOOLEAN DEFAULT true,
    "in_app_comments" BOOLEAN DEFAULT true,
    "in_app_payments" BOOLEAN DEFAULT true,
    "in_app_reminders" BOOLEAN DEFAULT true,
    "in_app_system" BOOLEAN DEFAULT true,
    "email_application_updates" BOOLEAN DEFAULT true,
    "email_documents" BOOLEAN DEFAULT false,
    "email_comments" BOOLEAN DEFAULT false,
    "email_payments" BOOLEAN DEFAULT true,
    "email_reminders" BOOLEAN DEFAULT true,
    "email_system" BOOLEAN DEFAULT true,
    "quiet_hours_enabled" BOOLEAN DEFAULT false,
    "quiet_hours_start" TIME(6) DEFAULT '22:00:00'::time,
    "quiet_hours_end" TIME(6) DEFAULT '07:00:00'::time,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xero_connection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "token_type" VARCHAR(50) DEFAULT 'Bearer',
    "tenant_id" VARCHAR(100) NOT NULL,
    "tenant_name" VARCHAR(255),
    "tenant_type" VARCHAR(50),
    "scopes" TEXT[],
    "connected_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "connected_by" UUID,
    "is_active" BOOLEAN DEFAULT true,
    "last_refreshed_at" TIMESTAMPTZ(6),
    "last_sync_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "last_error_at" TIMESTAMPTZ(6),
    "error_count" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xero_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xero_entity_map" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" VARCHAR(50) NOT NULL,
    "lumiere_id" UUID NOT NULL,
    "xero_id" VARCHAR(100) NOT NULL,
    "xero_number" VARCHAR(50),
    "xero_url" VARCHAR(500),
    "sync_status" VARCHAR(20) DEFAULT 'synced',
    "sync_direction" VARCHAR(10) DEFAULT 'push',
    "last_synced_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "sync_error" TEXT,
    "sync_attempts" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xero_entity_map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_transition_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "from_stage" TEXT NOT NULL,
    "to_stage" TEXT NOT NULL,
    "actor_id" UUID,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_transition_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "alert_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'normal',
    "title" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "raised_by" UUID,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "assignee_id" UUID NOT NULL,
    "assigned_by" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT "workflow_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_transition_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "from_stage" TEXT NOT NULL,
    "to_stage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "required_role" TEXT,
    "requested_by" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "transition_notes" TEXT,
    "review_notes" TEXT,
    "executed_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_transition_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_profiles_role" ON "profiles"("role");

-- CreateIndex
CREATE INDEX "idx_profiles_deleted_by" ON "profiles"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_profiles_account_status" ON "profiles"("account_status");

-- CreateIndex
CREATE UNIQUE INDEX "qualifications_code_key" ON "qualifications"("code");

-- CreateIndex
CREATE INDEX "idx_qualifications_code" ON "qualifications"("code");

-- CreateIndex
CREATE INDEX "idx_qualifications_archived_by" ON "qualifications"("archived_by");

-- CreateIndex
CREATE INDEX "idx_qualifications_deleted_by" ON "qualifications"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_qualifications_last_edited_by" ON "qualifications"("last_edited_by");

-- CreateIndex
CREATE UNIQUE INDEX "rtos_code_key" ON "rtos"("code");

-- CreateIndex
CREATE INDEX "idx_rtos_code" ON "rtos"("code");

-- CreateIndex
CREATE INDEX "idx_rtos_tga_sync_status" ON "rtos"("tga_sync_status");

-- CreateIndex
CREATE INDEX "idx_rtos_archived_by" ON "rtos"("archived_by");

-- CreateIndex
CREATE INDEX "idx_rtos_deleted_by" ON "rtos"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_rtos_assigned_manager" ON "rtos"("assigned_manager_id");

-- CreateIndex
CREATE INDEX "idx_rto_offerings_rto" ON "rto_offerings"("rto_id");

-- CreateIndex
CREATE INDEX "idx_rto_offerings_qual" ON "rto_offerings"("qualification_id");

-- CreateIndex
CREATE INDEX "idx_rto_offerings_archived_by" ON "rto_offerings"("archived_by");

-- CreateIndex
CREATE INDEX "idx_rto_offerings_deleted_by" ON "rto_offerings"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "rto_offerings_rto_id_qualification_id_key" ON "rto_offerings"("rto_id", "qualification_id");

-- CreateIndex
CREATE UNIQUE INDEX "partners_email_key" ON "partners"("email");

-- CreateIndex
CREATE INDEX "idx_partners_assigned_manager" ON "partners"("assigned_manager_id");

-- CreateIndex
CREATE INDEX "idx_partners_linked_rto" ON "partners"("linked_rto_id");

-- CreateIndex
CREATE INDEX "idx_partners_parent_partner" ON "partners"("parent_partner_id");

-- CreateIndex
CREATE INDEX "idx_partners_user" ON "partners"("user_id");

-- CreateIndex
CREATE INDEX "idx_partners_archived_by" ON "partners"("archived_by");

-- CreateIndex
CREATE INDEX "idx_partners_deleted_by" ON "partners"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_student_master_deleted_by" ON "student_master"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_student_master_email" ON "student_master"("email");

-- CreateIndex
CREATE INDEX "idx_student_master_passport" ON "student_master"("passport_number");

-- CreateIndex
CREATE INDEX "idx_student_master_name" ON "student_master"("last_name", "first_name");

-- CreateIndex
CREATE UNIQUE INDEX "applications_student_uid_key" ON "applications"("student_uid");

-- CreateIndex
CREATE UNIQUE INDEX "applications_application_number_key" ON "applications"("application_number");

-- CreateIndex
CREATE INDEX "idx_applications_stage" ON "applications"("workflow_stage");

-- CreateIndex
CREATE INDEX "idx_applications_partner" ON "applications"("partner_id");

-- CreateIndex
CREATE INDEX "idx_applications_uid" ON "applications"("student_uid");

-- CreateIndex
CREATE INDEX "idx_applications_received_by" ON "applications"("received_by");

-- CreateIndex
CREATE INDEX "idx_applications_assigned_by" ON "applications"("assigned_by");

-- CreateIndex
CREATE INDEX "idx_applications_archived_by" ON "applications"("archived_by");

-- CreateIndex
CREATE INDEX "idx_applications_assigned_staff" ON "applications"("assigned_staff_id");

-- CreateIndex
CREATE INDEX "idx_applications_assigned_to" ON "applications"("assigned_to");

-- CreateIndex
CREATE INDEX "idx_applications_created_by" ON "applications"("created_by");

-- CreateIndex
CREATE INDEX "idx_applications_deleted_by" ON "applications"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_applications_delivered_by" ON "applications"("delivered_by");

-- CreateIndex
CREATE INDEX "idx_applications_docs_approved_by" ON "applications"("docs_approved_by");

-- CreateIndex
CREATE INDEX "idx_applications_docs_checked_by" ON "applications"("docs_checked_by");

-- CreateIndex
CREATE INDEX "idx_applications_docs_prepared_by" ON "applications"("docs_prepared_by");

-- CreateIndex
CREATE INDEX "idx_applications_last_updated_by" ON "applications"("last_updated_by");

-- CreateIndex
CREATE INDEX "idx_applications_latest_bill" ON "applications"("latest_bill_id");

-- CreateIndex
CREATE INDEX "idx_applications_latest_invoice" ON "applications"("latest_invoice_id");

-- CreateIndex
CREATE INDEX "idx_applications_locked_by" ON "applications"("locked_by");

-- CreateIndex
CREATE INDEX "idx_applications_offering" ON "applications"("offering_id");

-- CreateIndex
CREATE INDEX "idx_applications_sent_by" ON "applications"("sent_by");

-- CreateIndex
CREATE INDEX "idx_applications_signed_off_by" ON "applications"("signed_off_by");

-- CreateIndex
CREATE INDEX "idx_applications_student_master" ON "applications"("student_master_id");

-- CreateIndex
CREATE INDEX "idx_applications_payment_status" ON "applications"("payment_status");

-- CreateIndex
CREATE INDEX "idx_applications_student_email" ON "applications"("student_email");

-- CreateIndex
CREATE INDEX "idx_applications_lead_source_id" ON "applications"("lead_source_id");

-- CreateIndex
CREATE INDEX "idx_applications_qualification_id" ON "applications"("qualification_id");

-- CreateIndex
CREATE INDEX "idx_documents_application" ON "documents"("application_id");

-- CreateIndex
CREATE INDEX "idx_documents_partner" ON "documents"("partner_id");

-- CreateIndex
CREATE INDEX "idx_documents_verified_by" ON "documents"("verified_by");

-- CreateIndex
CREATE INDEX "idx_documents_uploaded_by" ON "documents"("uploaded_by");

-- CreateIndex
CREATE INDEX "idx_documents_archived_by" ON "documents"("archived_by");

-- CreateIndex
CREATE INDEX "idx_documents_deleted_by" ON "documents"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_documents_type_validated" ON "documents"("document_type_validated");

-- CreateIndex
CREATE INDEX "idx_audit_logs_user" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_table" ON "audit_logs"("table_name");

-- CreateIndex
CREATE INDEX "idx_audit_logs_created" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_tickets_status" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "idx_tickets_assigned" ON "tickets"("assigned_to");

-- CreateIndex
CREATE INDEX "idx_tickets_application" ON "tickets"("application_id");

-- CreateIndex
CREATE INDEX "idx_tickets_created_by" ON "tickets"("created_by");

-- CreateIndex
CREATE INDEX "idx_tickets_partner" ON "tickets"("partner_id");

-- CreateIndex
CREATE INDEX "idx_ticket_comments_ticket" ON "ticket_comments"("ticket_id");

-- CreateIndex
CREATE INDEX "idx_ticket_comments_user" ON "ticket_comments"("user_id");

-- CreateIndex
CREATE INDEX "idx_application_comments_app" ON "application_comments"("application_id");

-- CreateIndex
CREATE INDEX "idx_application_comments_user" ON "application_comments"("user_id");

-- CreateIndex
CREATE INDEX "idx_application_history_app" ON "application_history"("application_id");

-- CreateIndex
CREATE INDEX "idx_application_history_changed_by" ON "application_history"("changed_by");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_name_key" ON "email_templates"("name");

-- CreateIndex
CREATE INDEX "idx_email_templates_created_by" ON "email_templates"("created_by");

-- CreateIndex
CREATE INDEX "idx_email_templates_archived_by" ON "email_templates"("archived_by");

-- CreateIndex
CREATE INDEX "idx_email_templates_deleted_by" ON "email_templates"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_price_versions_approved_by" ON "price_versions"("approved_by");

-- CreateIndex
CREATE INDEX "idx_price_versions_offering" ON "price_versions"("offering_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "idx_invoices_application" ON "invoices"("application_id");

-- CreateIndex
CREATE INDEX "idx_invoices_partner" ON "invoices"("partner_id");

-- CreateIndex
CREATE INDEX "idx_invoices_status" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "idx_invoices_created_by" ON "invoices"("created_by");

-- CreateIndex
CREATE INDEX "idx_invoices_archived_by" ON "invoices"("archived_by");

-- CreateIndex
CREATE INDEX "idx_invoices_deleted_by" ON "invoices"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_invoice_line_items_invoice" ON "invoice_line_items"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "bills_bill_number_key" ON "bills"("bill_number");

-- CreateIndex
CREATE INDEX "idx_bills_rto" ON "bills"("rto_id");

-- CreateIndex
CREATE INDEX "idx_bills_application" ON "bills"("application_id");

-- CreateIndex
CREATE INDEX "idx_bills_status" ON "bills"("status");

-- CreateIndex
CREATE INDEX "idx_bills_due_date" ON "bills"("due_date");

-- CreateIndex
CREATE INDEX "idx_bills_archived_by" ON "bills"("archived_by");

-- CreateIndex
CREATE INDEX "idx_bills_created_by" ON "bills"("created_by");

-- CreateIndex
CREATE INDEX "idx_bills_deleted_by" ON "bills"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_bill_line_items_bill" ON "bill_line_items"("bill_id");

-- CreateIndex
CREATE INDEX "idx_bulk_operations_created_by" ON "bulk_operations"("created_by");

-- CreateIndex
CREATE INDEX "idx_notification_queue_status" ON "notification_queue"("status");

-- CreateIndex
CREATE INDEX "idx_notification_queue_scheduled" ON "notification_queue"("scheduled_at");

-- CreateIndex
CREATE INDEX "idx_notification_queue_application" ON "notification_queue"("application_id");

-- CreateIndex
CREATE INDEX "idx_notification_queue_created_by" ON "notification_queue"("created_by");

-- CreateIndex
CREATE INDEX "idx_notification_queue_partner" ON "notification_queue"("partner_id");

-- CreateIndex
CREATE INDEX "idx_notification_queue_template" ON "notification_queue"("template_id");

-- CreateIndex
CREATE INDEX "idx_notification_logs_sent_by" ON "notification_logs"("sent_by");

-- CreateIndex
CREATE INDEX "idx_notification_logs_notification" ON "notification_logs"("notification_id");

-- CreateIndex
CREATE INDEX "idx_scheduled_reminders_created_by" ON "scheduled_reminders"("created_by");

-- CreateIndex
CREATE INDEX "idx_scheduled_reminders_template" ON "scheduled_reminders"("template_id");

-- CreateIndex
CREATE INDEX "idx_reminder_history_application" ON "reminder_history"("application_id");

-- CreateIndex
CREATE INDEX "idx_reminder_history_notification" ON "reminder_history"("notification_id");

-- CreateIndex
CREATE INDEX "idx_reminder_history_reminder" ON "reminder_history"("reminder_id");

-- CreateIndex
CREATE INDEX "idx_impersonation_admin" ON "admin_impersonation_logs"("admin_id");

-- CreateIndex
CREATE INDEX "idx_admin_impersonation_logs_impersonated_user" ON "admin_impersonation_logs"("impersonated_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_transitions_from_stage_to_stage_key" ON "workflow_transitions"("from_stage", "to_stage");

-- CreateIndex
CREATE INDEX "idx_record_versions_table_record" ON "record_versions"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "idx_record_versions_user" ON "record_versions"("changed_by");

-- CreateIndex
CREATE UNIQUE INDEX "record_versions_table_name_record_id_version_number_key" ON "record_versions"("table_name", "record_id", "version_number");

-- CreateIndex
CREATE INDEX "idx_record_activity_table_record" ON "record_activity"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "idx_record_activity_user" ON "record_activity"("user_id");

-- CreateIndex
CREATE INDEX "idx_record_activity_action" ON "record_activity"("action");

-- CreateIndex
CREATE INDEX "idx_role_permissions_role" ON "role_permissions"("role");

-- CreateIndex
CREATE INDEX "idx_role_permissions_permission_key" ON "role_permissions"("permission_key");

-- CreateIndex
CREATE UNIQUE INDEX "idx_role_permissions_role_permission" ON "role_permissions"("role", "permission_key");

-- CreateIndex
CREATE INDEX "idx_role_hidden_fields_role" ON "role_hidden_fields"("role");

-- CreateIndex
CREATE INDEX "idx_role_hidden_fields_context" ON "role_hidden_fields"("context");

-- CreateIndex
CREATE UNIQUE INDEX "role_hidden_fields_role_field_name_context_key" ON "role_hidden_fields"("role", "field_name", "context");

-- CreateIndex
CREATE INDEX "idx_qualification_units_qual" ON "qualification_units"("qualification_id");

-- CreateIndex
CREATE INDEX "idx_qualification_units_code" ON "qualification_units"("unit_code");

-- CreateIndex
CREATE INDEX "idx_qualification_units_type" ON "qualification_units"("unit_type");

-- CreateIndex
CREATE UNIQUE INDEX "qualification_units_qualification_id_unit_code_key" ON "qualification_units"("qualification_id", "unit_code");

-- CreateIndex
CREATE INDEX "idx_tga_sync_log_qual" ON "tga_sync_log"("qualification_id");

-- CreateIndex
CREATE INDEX "idx_tga_sync_log_result" ON "tga_sync_log"("sync_result");

-- CreateIndex
CREATE INDEX "idx_tga_sync_log_synced_by" ON "tga_sync_log"("synced_by");

-- CreateIndex
CREATE INDEX "idx_partner_contact_history_partner" ON "partner_contact_history"("partner_id");

-- CreateIndex
CREATE INDEX "idx_partner_contact_history_contacted_by" ON "partner_contact_history"("contacted_by");

-- CreateIndex
CREATE INDEX "idx_partner_reminders_partner" ON "partner_reminders"("partner_id");

-- CreateIndex
CREATE INDEX "idx_partner_reminders_template" ON "partner_reminders"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_request_links_token_key" ON "document_request_links"("token");

-- CreateIndex
CREATE INDEX "idx_document_request_links_partner" ON "document_request_links"("partner_id");

-- CreateIndex
CREATE INDEX "idx_document_request_links_created_by" ON "document_request_links"("created_by");

-- CreateIndex
CREATE INDEX "idx_partner_commission_rules_partner" ON "partner_commission_rules"("partner_id");

-- CreateIndex
CREATE INDEX "idx_partner_commission_rules_qualification" ON "partner_commission_rules"("qualification_id");

-- CreateIndex
CREATE INDEX "idx_assessor_qualifications_assessor" ON "assessor_qualifications"("assessor_id");

-- CreateIndex
CREATE INDEX "idx_assessor_qualifications_qual" ON "assessor_qualifications"("qualification_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessor_qualifications_assessor_id_qualification_id_key" ON "assessor_qualifications"("assessor_id", "qualification_id");

-- CreateIndex
CREATE INDEX "idx_notifications_user_id" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "idx_notifications_type" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "idx_notifications_related" ON "notifications"("related_table", "related_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "idx_xero_entity_map_xero_id" ON "xero_entity_map"("xero_id");

-- CreateIndex
CREATE INDEX "idx_xero_entity_map_lumiere" ON "xero_entity_map"("entity_type", "lumiere_id");

-- CreateIndex
CREATE UNIQUE INDEX "xero_entity_map_unique" ON "xero_entity_map"("entity_type", "lumiere_id");

-- CreateIndex
CREATE INDEX "idx_workflow_transition_events_application" ON "workflow_transition_events"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_workflow_alerts_application" ON "workflow_alerts"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_workflow_alerts_status" ON "workflow_alerts"("status", "severity");

-- CreateIndex
CREATE INDEX "idx_workflow_assignments_lookup" ON "workflow_assignments"("application_id", "stage", "is_active");

-- CreateIndex
CREATE INDEX "idx_workflow_transition_approvals_application" ON "workflow_transition_approvals"("application_id", "requested_at");

-- CreateIndex
CREATE INDEX "idx_workflow_transition_approvals_status" ON "workflow_transition_approvals"("status", "required_role");
