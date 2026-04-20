// Database types for Sharp Future

// ===========================================
// Enums
// ===========================================

export type UserRole =
    | 'ceo'
    | 'executive_manager'
    | 'admin'
    | 'accounts_manager'
    | 'assessor'
    | 'dispatch_coordinator'
    | 'frontdesk'
    | 'developer'
    | 'agent';
export type QualificationStatus = 'current' | 'superseded' | 'deleted';
export type TgaSyncStatus = 'synced' | 'pending' | 'error' | 'never';
export type RtoStatus = 'active' | 'pending' | 'suspended' | 'inactive';
export type PartnerType = 'agent' | 'provider' | 'subagent';
export type PartnerStatus = 'active' | 'pending' | 'suspended' | 'inactive';
export type AccountStatus = 'active' | 'disabled';
export type PriorityLevel = 'standard' | 'preferred' | 'premium';
export type ConnectionStatus = 'pending' | 'connected' | 'disconnected' | 'error';
export type WorkflowStage =
    | 'TRANSFERRED'
    | 'docs_review'
    | 'enrolled'
    | 'evaluate'
    | 'accounts'
    | 'dispatch'
    | 'completed';
export type AssessmentResult = 'pending' | 'pass' | 'failed';
export type AssessmentReportVenue = 'on_campus' | 'virtual';
export type AssessmentReportVirtualPlatform = 'google_meet' | 'zoom';
export type ApplicationOutcome = 'active' | 'withdrawn' | 'rejected';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded' | 'waived';
export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ApprovalStatus = 'draft' | 'pending_review' | 'published' | 'archived';
export type ContactChannel = 'email' | 'phone' | 'whatsapp' | 'meeting' | 'other';
export type ReminderType = 'intake_reminder' | 'document_followup' | 'payment_reminder';
export type VersionChangeType = 'create' | 'update' | 'archive' | 'restore' | 'delete' | 'unarchive' | 'version_restored';
export type CertificateRecordStatus = 'active' | 'replaced' | 'revoked';
export type TranscriptUnitResult = 'Competent' | 'Not Yet Competent' | 'Credit Transfer';
export type CertificateGenerationJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

// ===========================================
// Soft Delete & Archive Mixin
// ===========================================

export interface SoftDeleteFields {
    is_deleted: boolean;
    deleted_at: string | null;
    deleted_by: string | null;
}

export interface ArchiveFields {
    is_archived: boolean;
    archived_at: string | null;
    archived_by: string | null;
}

export interface VersionControlFields extends SoftDeleteFields, ArchiveFields { }

// ===========================================
// Version Control Types
// ===========================================

export interface RecordVersion {
    id: string;
    table_name: string;
    record_id: string;
    version_number: number;
    data: Record<string, unknown>;
    changed_fields: string[];
    change_type: VersionChangeType;
    changed_by: string | null;
    change_reason: string | null;
    created_at: string;
    // Populated via join
    user?: Profile;
}

export interface RecordActivity {
    id: string;
    table_name: string;
    record_id: string;
    action: string;
    summary: string;
    details: {
        changed_fields?: string[];
        old_values?: Record<string, unknown>;
        new_values?: Record<string, unknown>;
        [key: string]: unknown;
    } | null;
    user_id: string | null;
    user_name: string | null;
    ip_address: string | null;
    created_at: string;
}

export interface TrashItem {
    table_name: string;
    record_id: string;
    identifier: string | null;
    display_name: string | null;
    deleted_at: string;
    deleted_by: string | null;
    deleted_by_name: string | null;
}

export interface FieldDiff {
    field: string;
    old_value: unknown;
    new_value: unknown;
}

// ===========================================
// Core Tables
// ===========================================

export interface Profile {
    id: string;
    full_name: string | null;
    email: string | null;
    role: UserRole;
    account_status: AccountStatus;
    is_deleted: boolean;
    deleted_at: string | null;
    deleted_by: string | null;
    avatar_url: string | null;
    phone: string | null;
    company_name: string | null;
    secondary_emails: string[] | null;
    social_links: {
        linkedin?: string;
        twitter?: string;
        facebook?: string;
        instagram?: string;
    } | null;
    assessor_rate: number | null;
    created_at: string;
    updated_at: string;
}

export interface Qualification extends VersionControlFields {
    id: string;
    code: string;
    name: string;
    level: string | null;
    delivery_mode: string[] | null;
    status: QualificationStatus;
    tga_sync_status: TgaSyncStatus;
    release_date: string | null;
    superseded_by: string | null;
    notes: string | null;
    core_units: number | null;
    elective_units: number | null;
    total_units: number | null;
    entry_requirements: string | null;
    prerequisites: string[] | null;
    cricos_code: string | null;
    certificate_preview_path: string | null;
    certificate_preview_provider: 'supabase' | 'b2' | null;
    certificate_preview_bucket: string | null;
    certificate_preview_key: string | null;
    last_edited_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface Rto extends VersionControlFields {
    id: string;
    code: string;
    name: string;
    logo_url: string | null;
    status: RtoStatus;
    location: string | null;
    state: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    notes: string | null;
    cricos_provider_code: string | null;
    delivery_modes: string[];
    certificate_types: string[];
    tga_sync_status: TgaSyncStatus;
    tga_last_synced_at: string | null;
    tga_sync_error: string | null;
    // New contact/management fields
    contact_person_name: string | null;
    assigned_manager_id: string | null;
    provider_name: string | null;
    created_at: string;
    updated_at: string;
    // Relations (populated via joins)
    assigned_manager?: Profile;
}

export interface QualificationPriceList extends VersionControlFields {
    id: string;
    rto_id: string | null;
    qualification_id: string;
    tuition_fee_onshore: number | null;
    tuition_fee_miscellaneous: number | null;
    material_fee: number;
    application_fee: number;
    agent_fee: number;
    student_fee: number;
    enrollment_fee: number;
    misc_fee: number;
    assessor_fee: number;
    provider_fee: number;
    duration_weeks: number | null;
    intakes: string[] | null;
    is_active: boolean;
    effective_date: string;
    expiry_date: string | null;
    version: number;
    approval_status: ApprovalStatus;
    qualification?: Qualification;
    created_at: string;
    updated_at: string;
}

export type RtoOffering = QualificationPriceList;

export interface Partner extends VersionControlFields {
    id: string;
    type: PartnerType;
    company_name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    status: PartnerStatus;
    priority_level: PriorityLevel;
    commission_rate: number | null;
    notes: string | null;
    delivery_method: string | null;
    kpi_ontime_rate: number | null;
    kpi_conversion_rate: number | null;
    assigned_manager_id: string | null;
    preferred_channel: ContactChannel | null;
    linked_rto_id: string | null;
    parent_partner_id: string | null;
    user_id: string | null;
    address: string | null;
    created_at: string;
    updated_at: string;
    // Relations (populated via joins)
    linked_rto?: Rto;
    parent_partner?: Partner;
    assigned_manager?: Profile;
}

export interface Application extends VersionControlFields {
    id: string;
    student_uid: string;
    application_number: string;
    offering_id: string | null;
    qualification_id: string | null;
    partner_id: string | null;
    student_first_name: string;
    student_last_name: string;
    student_email: string | null;
    student_phone: string | null;
    student_dob: string | null;
    student_passport_number: string | null;
    student_nationality: string | null;
    student_address: string | null;
    student_usi: string | null;
    student_visa_number: string | null;
    student_visa_expiry: string | null;
    // New demographic fields
    student_gender: string | null;
    student_country_of_birth: string | null;
    application_from: string | null;
    // Split address fields
    student_street_no: string | null;
    student_suburb: string | null;
    student_state: string | null;
    student_postcode: string | null;
    // Workflow
    workflow_stage: WorkflowStage;
    workflow_stage_updated_at: string | null;
    source_application_id: string | null;
    source_portal: string;
    source_rto_id: string | null;
    source_qualification_code: string | null;
    transferred_at: string | null;
    transfer_event_id: string | null;
    payment_status: PaymentStatus;
    quoted_tuition: number | null;
    quoted_materials: number | null;
    appointment_date: string | null;
    appointment_time: string | null;
    notes: string | null;
    assessment_result: AssessmentResult;
    assessment_result_at: string | null;
    assessment_result_by: string | null;
    evaluation_started_at: string | null;
    evaluation_started_by: string | null;
    assessment_report_date: string | null;
    assessment_report_start_time: string | null;
    assessment_report_end_time: string | null;
    assessment_report_venue: AssessmentReportVenue | null;
    assessment_report_virtual_platform: AssessmentReportVirtualPlatform | null;
    assessment_report_meeting_record_document_id: string | null;
    assessment_report_outcome: string | null;
    assessment_report_overview: string | null;
    assessment_report_recommendation: string | null;
    assessment_report_completed_at: string | null;
    assessment_report_completed_by: string | null;
    dispatch_approval_requested_at: string | null;
    dispatch_approval_requested_by: string | null;
    dispatch_approval_approved_at: string | null;
    dispatch_approval_approved_by: string | null;
    dispatch_override_used: boolean;
    application_outcome: ApplicationOutcome;
    // Assignment and tracking
    assigned_staff_id: string | null;
    assigned_assessor_id: string | null;
    assigned_admin_id: string | null;
    assessor_fee: number | null;
    locked_by: string | null;
    lock_timestamp: string | null;
    student_master_id: string | null;
    received_by: string | null;
    received_at: string | null;
    last_updated_by: string | null;
    assigned_by: string | null;
    assigned_at: string | null;
    needs_attention: boolean;
    ready_to_check: boolean;
    ready_to_check_at: string | null;
    // Sign-off
    issue_date: string | null;
    signed_off_by: string | null;
    signed_off_at: string | null;
    // Document status
    docs_prepared_by: string | null;
    docs_prepared_at: string | null;
    docs_checked_by: string | null;
    docs_checked_at: string | null;
    docs_approved_by: string | null;
    docs_approved_at: string | null;
    // Document delivery
    provider_email: string | null;
    additional_emails: string[] | null;
    sent_by: string | null;
    sent_at: string | null;
    delivery_method: string | null;
    delivered_by: string | null;
    delivery_date: string | null;
    tracking_url: string | null;
    is_delivered: boolean;
    // Admin docs-review completion tasks
    admin_applicant_pdf_email_completed: boolean;
    admin_applicant_pdf_email_completed_at: string | null;
    admin_applicant_pdf_email_completed_by: string | null;
    admin_references_email_completed: boolean;
    admin_references_email_completed_at: string | null;
    admin_references_email_completed_by: string | null;
    admin_accounts_manager_bill_requested: boolean;
    admin_accounts_manager_bill_requested_at: string | null;
    admin_accounts_manager_bill_requested_by: string | null;
    // Agent docs-review completion tasks
    agent_applicant_pdf_email_completed: boolean;
    agent_applicant_pdf_email_completed_at: string | null;
    agent_applicant_pdf_email_completed_by: string | null;
    agent_references_email_completed: boolean;
    agent_references_email_completed_at: string | null;
    agent_references_email_completed_by: string | null;
    agent_enrollment_agreement_uploaded: boolean;
    agent_enrollment_agreement_uploaded_at: string | null;
    agent_enrollment_agreement_uploaded_by: string | null;
    agent_enrollment_agreement_document_id: string | null;
    agent_executive_manager_notified: boolean;
    agent_executive_manager_notified_at: string | null;
    agent_executive_manager_notified_by: string | null;
    agent_frontdesk_notified: boolean;
    agent_frontdesk_notified_at: string | null;
    agent_frontdesk_notified_by: string | null;
    // Document checklist
    has_qualifications_docs: boolean;
    has_id_docs: boolean;
    has_misc_docs: boolean;
    // Timestamps
    created_at: string;
    updated_at: string;
}

// ===========================================
// Extended Tables (Phase 2)
// ===========================================

export interface StudentMaster {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    passport_number: string | null;
    nationality: string | null;
    dob: string | null;
    address: string | null;
    created_at: string;
    updated_at: string;
}

export interface Document extends VersionControlFields {
    id: string;
    application_id: string | null;
    partner_id: string | null;
    document_type: string;
    file_name: string;
    file_url: string;
    file_size: number | null;
    mime_type: string | null;
    storage_provider: 'supabase' | 'b2' | null;
    storage_bucket: string | null;
    storage_key: string | null;
    is_remote: boolean;
    remote_source_url: string | null;
    remote_url_expires_at: string | null;
    remote_source_document_id: string | null;
    remote_source_application_id: string | null;
    remote_source_portal: string | null;
    remote_download_error: string | null;
    copied_to_local_at: string | null;
    version: number;
    is_verified: boolean;
    verified_by: string | null;
    verified_at: string | null;
    notes: string | null;
    uploaded_by: string | null;
    extracted_data: Record<string, unknown> | null;
    extraction_status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
    extraction_error: string | null;
    extracted_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface AuditLog {
    id: string;
    user_id: string | null;
    action: string;
    table_name: string;
    record_id: string | null;
    old_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
}

export interface CertificateRecord {
    id: string;
    application_id: string;
    qualification_id: string | null;
    document_id: string | null;
    certificate_number: string;
    certificate_title: string;
    issue_date: string;
    status: CertificateRecordStatus;
    version: number;
    includes_transcript: boolean;
    verification_url: string | null;
    request_payload: Record<string, unknown> | null;
    generated_by: string | null;
    generated_at: string;
    created_at: string;
    updated_at: string;
}

export interface CertificateUnitResult {
    id: string;
    certificate_id: string;
    qualification_unit_id: string | null;
    unit_code: string;
    unit_title: string;
    result: TranscriptUnitResult;
    year: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface CertificateGenerationJob {
    id: string;
    application_id: string;
    certificate_record_id: string | null;
    document_id: string | null;
    requested_by: string | null;
    status: CertificateGenerationJobStatus;
    certificate_number: string | null;
    verification_url: string | null;
    request_payload: Record<string, unknown> | null;
    attempt_count: number;
    last_error: string | null;
    queued_at: string;
    started_at: string | null;
    completed_at: string | null;
    failed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface Ticket {
    id: string;
    subject: string;
    description: string | null;
    status: TicketStatus;
    priority: TicketPriority;
    application_id: string | null;
    partner_id: string | null;
    created_by: string | null;
    assigned_to: string | null;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface TicketComment {
    id: string;
    ticket_id: string;
    user_id: string | null;
    content: string;
    is_internal: boolean;
    created_at: string;
}

export interface ApplicationComment {
    id: string;
    application_id: string;
    user_id: string | null;
    content: string;
    is_internal: boolean;
    created_at: string;
    user?: Profile;
}

export interface ApplicationHistory {
    id: string;
    application_id: string;
    from_stage: string | null;
    to_stage: string | null;
    changed_by: string | null;
    notes: string | null;
    action?: string | null;
    field_changed?: string | null;
    old_value?: string | null;
    new_value?: string | null;
    user_id?: string | null;
    metadata?: Record<string, unknown> | string | null;
    created_at: string;
    user?: Profile;
}

export interface PortalConnection {
    id: string;
    integration_key: string;
    portal_rto_id: string | null;
    sharp_future_base_url: string | null;
    sharp_future_rto_id: string | null;
    transfer_secret_encrypted: string | null;
    public_portal_url: string | null;
    webhook_receive_url: string | null;
    connection_status: ConnectionStatus;
    is_enabled: boolean;
    last_connected_at: string | null;
    last_ping_at: string | null;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface SharpFutureEventDelivery {
    id: string;
    event_id: string;
    application_id: string | null;
    event_type: string;
    payload: Record<string, unknown>;
    delivery_status: 'pending' | 'delivered' | 'failed';
    last_attempt_at: string | null;
    delivered_at: string | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}

export interface EmailTemplate extends VersionControlFields {
    id: string;
    name: string;
    subject: string;
    body: string;
    variables: string[];
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface PriceVersion {
    id: string;
    offering_id: string;
    tuition_fee_onshore: number | null;
    tuition_fee_miscellaneous: number | null;
    material_fee: number | null;
    application_fee: number | null;
    assessor_fee: number | null;
    provider_fee: number | null;
    agent_fee: number | null;
    student_fee: number | null;
    enrollment_fee: number | null;
    misc_fee: number | null;
    effective_from: string;
    effective_to: string | null;
    approved_by: string | null;
    approval_notes: string | null;
    created_at: string;
}

// ===========================================
// Partner Enhancement Tables
// ===========================================

export interface PartnerContactHistory {
    id: string;
    partner_id: string;
    channel: ContactChannel;
    subject: string | null;
    content: string | null;
    contacted_by: string | null;
    contacted_at: string;
    created_at: string;
    // Relations
    user?: Profile;
}

export interface PartnerReminder {
    id: string;
    partner_id: string;
    reminder_type: ReminderType | string;
    template_id: string | null;
    days_before: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Relations
    template?: EmailTemplate;
}

export interface DocumentRequestLink {
    id: string;
    partner_id: string;
    token: string;
    document_types: string[];
    notes: string | null;
    expires_at: string | null;
    max_uploads: number | null;
    current_uploads: number;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    // Relations
    creator?: Profile;
}

export interface PartnerCommissionRule {
    id: string;
    partner_id: string;
    name: string;
    qualification_id: string | null;
    min_volume: number | null;
    max_volume: number | null;
    commission_rate: number;
    effective_from: string;
    effective_to: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Relations
    qualification?: Qualification;
}

// ===========================================
// UI Constants
// ===========================================

export const WORKFLOW_STAGE_LABELS: Record<WorkflowStage, string> = {
    TRANSFERRED: 'Transferred',
    docs_review: 'Docs Review',
    enrolled: 'Enrolled',
    evaluate: 'Evaluate',
    accounts: 'Accounts',
    dispatch: 'Dispatch',
    completed: 'Completed',
};

export const WORKFLOW_STAGE_COLORS: Record<WorkflowStage, string> = {
    TRANSFERRED: 'bg-cyan-100 text-cyan-700',
    docs_review: 'bg-yellow-100 text-yellow-700',
    enrolled: 'bg-emerald-100 text-emerald-700',
    evaluate: 'bg-amber-100 text-amber-700',
    accounts: 'bg-violet-100 text-violet-700',
    dispatch: 'bg-indigo-100 text-indigo-700',
    completed: 'bg-slate-100 text-slate-700',
};

export const ASSESSMENT_RESULT_LABELS: Record<AssessmentResult, string> = {
    pending: 'Pending',
    pass: 'Pass',
    failed: 'Failed',
};

export const ASSESSMENT_RESULT_COLORS: Record<AssessmentResult, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    pass: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
};

export const APPLICATION_OUTCOME_LABELS: Record<ApplicationOutcome, string> = {
    active: 'Active',
    withdrawn: 'Withdrawn',
    rejected: 'Rejected',
};

export const DOCUMENT_TYPES = [
    'Passport',
    'Visa',
    'Transcript',
    'English Test',
    'TAS',
    'LLN Management',
    'Photo',
    'Resume/CV',
    'Offer Letter',
    'CoE',
    'Student Assessment Report',
    'Assessment Meeting Record',
    'Evaluation File',
    'Other',
] as const;

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    published: 'Published',
    archived: 'Archived',
};

export const APPROVAL_STATUS_COLORS: Record<ApprovalStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending_review: 'bg-yellow-100 text-yellow-700',
    published: 'bg-green-100 text-green-700',
    archived: 'bg-red-100 text-red-700',
};

export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = {
    email: 'Email',
    phone: 'Phone Call',
    whatsapp: 'WhatsApp',
    meeting: 'Meeting',
    other: 'Other',
};

export const CONTACT_CHANNEL_ICONS: Record<ContactChannel, string> = {
    email: 'Mail',
    phone: 'Phone',
    whatsapp: 'MessageCircle',
    meeting: 'Users',
    other: 'MessageSquare',
};

export const REMINDER_TYPE_LABELS: Record<string, string> = {
    intake_reminder: 'Intake Reminder',
    document_followup: 'Document Follow-up',
    payment_reminder: 'Payment Reminder',
};

export const PARTNER_STATUS_COLORS: Record<PartnerStatus, string> = {
    active: 'bg-green-100 text-green-700 border-green-200',
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    suspended: 'bg-red-100 text-red-700 border-red-200',
    inactive: 'bg-gray-100 text-gray-700 border-gray-200',
};

export const PRIORITY_LEVEL_COLORS: Record<PriorityLevel, string> = {
    standard: 'bg-gray-100 text-gray-700',
    preferred: 'bg-blue-100 text-blue-700',
    premium: 'bg-purple-100 text-purple-700',
};

// ===========================================
// Invoice Types (Phase 2)
// ===========================================

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export type InvoiceCollectionStatus = 'draft' | 'pending_approval' | 'open' | 'partially_paid' | 'paid' | 'overpaid' | 'voided' | 'deleted';

export type XeroInvoiceSyncStatus = InvoiceCollectionStatus;

export interface XeroConnectionRecord {
    id: string;
    org_id: string;
    access_token: string;
    refresh_token: string;
    expires_at: string;
    tenant_id: string;
    tenant_name: string | null;
    token_type: string;
    sales_account_code: string;
    purchases_account_code: string;
    sales_tax_type: string;
    purchases_tax_type: string;
    payment_account_code: string;
    last_refreshed_at: string | null;
    last_sync_at: string | null;
    last_error: string | null;
    last_error_at: string | null;
    error_count: number;
    created_at: string;
    updated_at: string;
}

export interface Invoice extends VersionControlFields {
    id: string;
    invoice_number: string;
    tenant_id?: string | null;
    application_id: string | null;
    customer_id?: string | null;
    partner_id: string | null;
    source_system?: string | null;
    type?: string | null;
    currency_code?: string | null;
    student_name: string;
    course_name: string | null;
    rto_name: string | null;
    tuition_fee: number;
    material_fee: number;
    application_fee: number;
    other_fees: number;
    discount: number;
    sub_total?: number | null;
    subtotal?: number | null;
    total?: number | null;
    total_tax?: number | null;
    total_amount: number;
    status: InvoiceStatus;
    internal_collection_status?: InvoiceCollectionStatus | null;
    amount_paid: number;
    amount_due: number | null;
    amount_credited?: number | null;
    date_issued?: string | null;
    due_date: string | null;
    fully_paid_at?: string | null;
    paid_at: string | null;
    pdf_url: string | null;
    notes: string | null;
    raw_payload: Record<string, unknown> | null;
    raw_xero_payload?: Record<string, unknown> | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    xero_invoice_id?: string | null;
    xero_invoice_url?: string | null;
    xero_sent_at?: string | null;
    xero_status?: string | null;
    xero_synced_at?: string | null;
    last_xero_synced_at?: string | null;
    xero_updated_date_utc?: string | null;
    sync_version?: number | null;
    // Relations
    application?: Application;
    partner?: Partner;
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
    draft: 'Draft',
    sent: 'Sent',
    paid: 'Paid',
    overdue: 'Overdue',
    cancelled: 'Cancelled',
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
};

// ===========================================
// Invoice Line Items
// ===========================================

export interface InvoiceLineItem {
    id: string;
    invoice_id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    sort_order: number;
    created_at: string;
}

export interface InvoicePayment {
    id: string;
    tenant_id?: string | null;
    invoice_id: string;
    xero_payment_id: string;
    amount: number;
    date: string;
    payment_date?: string | null;
    currency_code?: string | null;
    reference?: string | null;
    xero_account_id?: string | null;
    raw_payload: Record<string, unknown> | null;
    raw_xero_payload?: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

// ===========================================
// Bill Types (What we pay TO sources/RTOs)
// ===========================================

export type BillStatus = 'pending' | 'received' | 'paid' | 'overdue' | 'cancelled';
export type InvoiceType = 'customer' | 'agent';

export interface Bill extends VersionControlFields {
    id: string;
    bill_number: string;
    rto_id: string | null;
    application_id: string | null;
    description: string | null;
    rto_invoice_number: string | null;
    tuition_cost: number;
    material_cost: number;
    other_costs: number;
    total_amount: number;
    status: BillStatus;
    due_date: string | null;
    paid_at: string | null;
    payment_reference: string | null;
    payment_method: string | null;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    // Relations
    rto?: Rto;
    application?: Application;
}

export interface BillLineItem {
    id: string;
    bill_id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    sort_order: number;
    created_at: string;
}

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
    pending: 'Pending',
    received: 'Received',
    paid: 'Paid',
    overdue: 'Overdue',
    cancelled: 'Cancelled',
};

export const BILL_STATUS_COLORS: Record<BillStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    received: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
};

// ===========================================
// Bulk Operations
// ===========================================

export type BulkOperationType = 'invoice' | 'bill';
export type BulkOperationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BulkOperation {
    id: string;
    type: BulkOperationType;
    status: BulkOperationStatus;
    total_items: number;
    processed_items: number;
    failed_items: number;
    error_log: Array<{ item_id: string; error: string }>;
    created_by: string | null;
    created_at: string;
    completed_at: string | null;
}

// ===========================================
// Notification Types
// ===========================================

export type NotificationChannel = 'email' | 'whatsapp' | 'sms';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

export interface NotificationQueue {
    id: string;
    channel: NotificationChannel;
    recipient: string;
    subject: string | null;
    body: string;
    application_id: string | null;
    partner_id: string | null;
    template_id: string | null;
    status: NotificationStatus;
    scheduled_at: string;
    sent_at: string | null;
    error_message: string | null;
    retry_count: number;
    max_retries: number;
    metadata: Record<string, unknown> | null;
    created_by: string | null;
    created_at: string;
}

export interface NotificationLog {
    id: string;
    notification_id: string | null;
    channel: NotificationChannel;
    recipient: string;
    subject: string | null;
    status: NotificationStatus;
    provider_message_id: string | null;
    provider_response: Record<string, unknown> | null;
    created_at: string;
}

// ===========================================
// Lead Source Tracking Types
// ===========================================

export type QuerySourceType = 'web_form' | 'api' | 'manual' | 'import' | 'referral' | 'walk_in';

export interface LeadSource {
    id: string;
    name: string;
    source_type: QuerySourceType;
    identifier: string | null;
    description: string | null;
    is_active: boolean;
    total_leads: number;
    conversion_rate: number | null;
    created_at: string;
    updated_at: string;
}

export const QUERY_SOURCE_LABELS: Record<QuerySourceType, string> = {
    web_form: 'Web Form',
    api: 'API',
    manual: 'Manual Entry',
    import: 'CSV Import',
    referral: 'Referral',
    walk_in: 'Walk-in',
};

// ===========================================
// Scheduled Reminders Types
// ===========================================

export type ReminderStatusType = 'active' | 'paused' | 'completed' | 'expired';

export interface ScheduledReminder {
    id: string;
    name: string;
    description: string | null;
    trigger_type: string;
    trigger_config: Record<string, unknown>;
    notification_channel: NotificationChannel;
    template_id: string | null;
    custom_message: string | null;
    status: ReminderStatusType;
    last_run_at: string | null;
    next_run_at: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    // Relations
    template?: EmailTemplate;
}

// ===========================================
// Admin Impersonation Types
// ===========================================

export interface AdminImpersonationLog {
    id: string;
    admin_id: string;
    impersonated_user_id: string;
    reason: string;
    started_at: string;
    ended_at: string | null;
    ip_address: string | null;
    user_agent: string | null;
    actions_count: number;
    // Relations
    admin?: Profile;
    impersonated_user?: Profile;
}

// ===========================================
// Workflow Transitions
// ===========================================

export interface WorkflowTransition {
    id: string;
    from_stage: WorkflowStage;
    to_stage: WorkflowStage;
    is_allowed: boolean;
    requires_approval: boolean;
    required_role: UserRole | null;
    allowed_roles: UserRole[] | null;
}

export interface WorkflowTransitionApproval {
    id: string;
    application_id: string;
    from_stage: WorkflowStage;
    to_stage: WorkflowStage;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'executed';
    required_role: UserRole | null;
    requested_by: string;
    requested_at: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    transition_notes: string | null;
    review_notes: string | null;
    executed_at: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

// Valid workflow transitions map (client-side validation)
export const VALID_WORKFLOW_TRANSITIONS: Record<WorkflowStage, WorkflowStage[]> = {
    TRANSFERRED: ['docs_review'],
    docs_review: ['enrolled'],
    enrolled: ['evaluate'],
    evaluate: ['accounts'],
    accounts: ['dispatch'],
    dispatch: ['completed'],
    completed: [],
};

export function isValidTransition(from: WorkflowStage, to: WorkflowStage): boolean {
    return VALID_WORKFLOW_TRANSITIONS[from]?.includes(to) ?? false;
}
