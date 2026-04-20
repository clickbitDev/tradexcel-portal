import { createServerClient } from '@/lib/supabase/server';
import { WORKFLOW_STAGE_LABELS, WorkflowStage } from '@/types/database';
import { resolveApplicationId } from '@/lib/application-identifiers';
import { BRAND_COMPLIANCE_REPORT_TITLE } from '@/lib/brand';
import { ACTIVE_RECORD_FILTER } from '@/lib/soft-delete';

export interface ComplianceReportData {
    generatedAt: string;
    dateRange: { from: string; to: string };
    summary: {
        totalApplications: number;
        byStage: Record<string, number>;
        byPartner: { name: string; count: number }[];
    };
    auditLogs: {
        id: string;
        action: string;
        table_name: string;
        user_name: string | null;
        created_at: string;
    }[];
    documentStatus: {
        application_uid: string;
        student_name: string;
        documents_uploaded: number;
        documents_verified: number;
        missing_types: string[];
    }[];
}

/**
 * Generate compliance report data for the given date range
 */
export async function generateComplianceReport(
    fromDate: string,
    toDate: string
): Promise<ComplianceReportData> {
    const supabase = await createServerClient();

    // Fetch applications in date range
    const { data: applicationsData } = await supabase
        .from('applications')
        .select(`
            id,
            application_number,
            student_uid,
            student_first_name,
            student_last_name,
            workflow_stage,
            partner_id,
            created_at,
            partner:partners(company_name)
        `)
        .or(ACTIVE_RECORD_FILTER)
        .gte('created_at', fromDate)
        .lte('created_at', toDate)
        .order('created_at', { ascending: false });

    const applications = applicationsData ?? [];

    // Calculate stage counts
    const byStage: Record<string, number> = {};
    for (const stage of Object.keys(WORKFLOW_STAGE_LABELS)) {
        byStage[stage] = applications.filter(a => a.workflow_stage === stage).length;
    }

    // Calculate partner counts
    const partnerCounts: Record<string, number> = {};
    for (const app of applications) {
        // Partner relation may be array or object depending on Supabase config
        const partnerData = app.partner;
        const partner = Array.isArray(partnerData)
            ? partnerData[0] as { company_name: string } | undefined
            : partnerData as { company_name: string } | null;
        const name = partner?.company_name || 'No Partner';
        partnerCounts[name] = (partnerCounts[name] || 0) + 1;
    }
    const byPartner = Object.entries(partnerCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    // Fetch audit logs
    const { data: auditLogsData } = await supabase
        .from('audit_logs')
        .select(`
            id,
            action,
            table_name,
            created_at,
            user:profiles(full_name)
        `)
        .gte('created_at', fromDate)
        .lte('created_at', toDate)
        .order('created_at', { ascending: false })
        .limit(500);

    const auditLogs = auditLogsData ?? [];

    // Fetch documents for applications
    const applicationIds = applications.map(a => a.id);
    const { data: documentsData } = await supabase
        .from('documents')
        .select('application_id, document_type, is_verified')
        .in('application_id', applicationIds.length > 0 ? applicationIds : ['00000000-0000-0000-0000-000000000000']);

    const documents = documentsData ?? [];

    // Document status per application
    const requiredDocTypes = ['Passport', 'Visa', 'Transcript', 'English Test', 'Photo'];
    const documentStatus = applications.map(app => {
        const appDocs = documents.filter(d => d.application_id === app.id);
        const uploadedTypes = new Set(appDocs.map(d => d.document_type));
        const verifiedCount = appDocs.filter(d => d.is_verified).length;
        const missingTypes = requiredDocTypes.filter(t => !uploadedTypes.has(t));

        return {
            application_uid: resolveApplicationId(app.application_number, app.student_uid),
            student_name: `${app.student_first_name} ${app.student_last_name}`,
            documents_uploaded: appDocs.length,
            documents_verified: verifiedCount,
            missing_types: missingTypes,
        };
    });

    return {
        generatedAt: new Date().toISOString(),
        dateRange: { from: fromDate, to: toDate },
        summary: {
            totalApplications: applications.length,
            byStage,
            byPartner,
        },
        auditLogs: auditLogs.map(log => {
            // Supabase returns nested relations as arrays
            const userRaw = log.user;
            const userData = Array.isArray(userRaw) ? userRaw[0] : userRaw;
            return {
                id: log.id,
                action: log.action,
                table_name: log.table_name,
                user_name: userData?.full_name ?? null,
                created_at: log.created_at,
            };
        }),
        documentStatus,
    };
}

/**
 * Convert compliance data to CSV format
 */
export function complianceToCSV(data: ComplianceReportData): string {
    const lines: string[] = [];

    // Header
    lines.push(BRAND_COMPLIANCE_REPORT_TITLE);
    lines.push(`Generated: ${new Date(data.generatedAt).toLocaleString()}`);
    lines.push(`Date Range: ${data.dateRange.from} to ${data.dateRange.to}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push(`Total Applications,${data.summary.totalApplications}`);
    lines.push('');

    // By Stage
    lines.push('## Applications by Stage');
    lines.push('Stage,Count');
    for (const [stage, count] of Object.entries(data.summary.byStage)) {
        const label = WORKFLOW_STAGE_LABELS[stage as WorkflowStage] || stage;
        lines.push(`${label},${count}`);
    }
    lines.push('');

    // By Partner
    lines.push('## Applications by Partner');
    lines.push('Partner,Count');
    for (const { name, count } of data.summary.byPartner) {
        lines.push(`"${name}",${count}`);
    }
    lines.push('');

    // Document Status
    lines.push('## Document Status');
    lines.push('Application ID,Student Name,Uploaded,Verified,Missing Documents');
    for (const doc of data.documentStatus) {
        lines.push(`${doc.application_uid},"${doc.student_name}",${doc.documents_uploaded},${doc.documents_verified},"${doc.missing_types.join('; ')}"`);
    }
    lines.push('');

    // Audit Log Summary
    lines.push('## Audit Log (Last 500 entries)');
    lines.push('Timestamp,User,Action,Table');
    for (const log of data.auditLogs.slice(0, 100)) {
        const date = new Date(log.created_at).toLocaleString();
        lines.push(`${date},"${log.user_name || 'System'}",${log.action},${log.table_name}`);
    }

    return lines.join('\n');
}
