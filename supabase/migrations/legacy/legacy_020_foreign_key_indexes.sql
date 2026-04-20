-- ============================================
-- FOREIGN KEY INDEXES
-- Migration: 020_foreign_key_indexes
-- ============================================
-- Adds indexes on all foreign key columns for improved query performance
-- ============================================

-- admin_impersonation_logs
CREATE INDEX IF NOT EXISTS idx_admin_impersonation_logs_impersonated_user 
    ON admin_impersonation_logs(impersonated_user_id);

-- application_comments
CREATE INDEX IF NOT EXISTS idx_application_comments_user 
    ON application_comments(user_id);

-- application_history
CREATE INDEX IF NOT EXISTS idx_application_history_changed_by 
    ON application_history(changed_by);

-- applications (multiple foreign keys)
CREATE INDEX IF NOT EXISTS idx_applications_archived_by ON applications(archived_by);
CREATE INDEX IF NOT EXISTS idx_applications_assigned_staff ON applications(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_applications_assigned_to ON applications(assigned_to);
CREATE INDEX IF NOT EXISTS idx_applications_created_by ON applications(created_by);
CREATE INDEX IF NOT EXISTS idx_applications_deleted_by ON applications(deleted_by);
CREATE INDEX IF NOT EXISTS idx_applications_delivered_by ON applications(delivered_by);
CREATE INDEX IF NOT EXISTS idx_applications_docs_approved_by ON applications(docs_approved_by);
CREATE INDEX IF NOT EXISTS idx_applications_docs_checked_by ON applications(docs_checked_by);
CREATE INDEX IF NOT EXISTS idx_applications_docs_prepared_by ON applications(docs_prepared_by);
CREATE INDEX IF NOT EXISTS idx_applications_last_updated_by ON applications(last_updated_by);
CREATE INDEX IF NOT EXISTS idx_applications_latest_bill ON applications(latest_bill_id);
CREATE INDEX IF NOT EXISTS idx_applications_latest_invoice ON applications(latest_invoice_id);
CREATE INDEX IF NOT EXISTS idx_applications_locked_by ON applications(locked_by);
CREATE INDEX IF NOT EXISTS idx_applications_offering ON applications(offering_id);
CREATE INDEX IF NOT EXISTS idx_applications_sent_by ON applications(sent_by);
CREATE INDEX IF NOT EXISTS idx_applications_signed_off_by ON applications(signed_off_by);
CREATE INDEX IF NOT EXISTS idx_applications_student_master ON applications(student_master_id);

-- bills
CREATE INDEX IF NOT EXISTS idx_bills_archived_by ON bills(archived_by);
CREATE INDEX IF NOT EXISTS idx_bills_created_by ON bills(created_by);
CREATE INDEX IF NOT EXISTS idx_bills_deleted_by ON bills(deleted_by);

-- bulk_operations
CREATE INDEX IF NOT EXISTS idx_bulk_operations_created_by ON bulk_operations(created_by);

-- document_request_links
CREATE INDEX IF NOT EXISTS idx_document_request_links_created_by ON document_request_links(created_by);

-- documents
CREATE INDEX IF NOT EXISTS idx_documents_archived_by ON documents(archived_by);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_by ON documents(deleted_by);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_verified_by ON documents(verified_by);

-- email_templates
CREATE INDEX IF NOT EXISTS idx_email_templates_archived_by ON email_templates(archived_by);
CREATE INDEX IF NOT EXISTS idx_email_templates_created_by ON email_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_email_templates_deleted_by ON email_templates(deleted_by);

-- invoices
CREATE INDEX IF NOT EXISTS idx_invoices_archived_by ON invoices(archived_by);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_by ON invoices(deleted_by);

-- notification_logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_bill ON notification_logs(bill_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_notification ON notification_logs(notification_id);

-- notification_queue
CREATE INDEX IF NOT EXISTS idx_notification_queue_application ON notification_queue(application_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_created_by ON notification_queue(created_by);
CREATE INDEX IF NOT EXISTS idx_notification_queue_partner ON notification_queue(partner_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_template ON notification_queue(template_id);

-- partner_contact_history
CREATE INDEX IF NOT EXISTS idx_partner_contact_history_contacted_by ON partner_contact_history(contacted_by);

-- partner_reminders
CREATE INDEX IF NOT EXISTS idx_partner_reminders_template ON partner_reminders(template_id);

-- partners
CREATE INDEX IF NOT EXISTS idx_partners_archived_by ON partners(archived_by);
CREATE INDEX IF NOT EXISTS idx_partners_assigned_manager ON partners(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_partners_deleted_by ON partners(deleted_by);
CREATE INDEX IF NOT EXISTS idx_partners_linked_rto ON partners(linked_rto_id);
CREATE INDEX IF NOT EXISTS idx_partners_parent_partner ON partners(parent_partner_id);
CREATE INDEX IF NOT EXISTS idx_partners_user ON partners(user_id);

-- price_versions
CREATE INDEX IF NOT EXISTS idx_price_versions_approved_by ON price_versions(approved_by);
CREATE INDEX IF NOT EXISTS idx_price_versions_offering ON price_versions(offering_id);

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_by ON profiles(deleted_by);

-- qualifications
CREATE INDEX IF NOT EXISTS idx_qualifications_archived_by ON qualifications(archived_by);
CREATE INDEX IF NOT EXISTS idx_qualifications_deleted_by ON qualifications(deleted_by);

-- reminder_history
CREATE INDEX IF NOT EXISTS idx_reminder_history_application ON reminder_history(application_id);
CREATE INDEX IF NOT EXISTS idx_reminder_history_notification ON reminder_history(notification_id);
CREATE INDEX IF NOT EXISTS idx_reminder_history_reminder ON reminder_history(reminder_id);

-- rto_offerings
CREATE INDEX IF NOT EXISTS idx_rto_offerings_archived_by ON rto_offerings(archived_by);
CREATE INDEX IF NOT EXISTS idx_rto_offerings_deleted_by ON rto_offerings(deleted_by);

-- rtos
CREATE INDEX IF NOT EXISTS idx_rtos_archived_by ON rtos(archived_by);
CREATE INDEX IF NOT EXISTS idx_rtos_deleted_by ON rtos(deleted_by);

-- scheduled_reminders
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_created_by ON scheduled_reminders(created_by);
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_template ON scheduled_reminders(template_id);

-- tga_sync_log
CREATE INDEX IF NOT EXISTS idx_tga_sync_log_synced_by ON tga_sync_log(synced_by);

-- ticket_comments
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_user ON ticket_comments(user_id);

-- tickets
CREATE INDEX IF NOT EXISTS idx_tickets_application ON tickets(application_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_partner ON tickets(partner_id);
