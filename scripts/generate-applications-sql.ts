// Script to generate SQL for importing Applications
// Links applications to partners (agents) and rto_offerings
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../.env.local') });

interface Application {
    appNumber: string;
    status: string;
    paymentStatus: string;
    createdOn: string;
    agentName: string;
    applicantName: string;
    qualCode: string;
    qualName: string;
    providerName: string;
    providerRto: string;
    totalAmount: number;
    paymentAmount: number;
}

function escapeSQL(str: string): string {
    if (!str) return '';
    return str.replace(/'/g, "''");
}

function parseNumber(str: string): number {
    if (!str || str.trim() === '') return 0;
    const cleaned = str.replace(/"/g, '').replace(/,/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

// Map CSV workflow status to enum
function mapWorkflowStatus(csvStatus: string): string {
    const statusMap: Record<string, string> = {
        'draft': 'draft',
        'processing': 'submitted',
        'ready to send': 'docs_review',
        'sent to rto': 'rto_processing',
        'cert received': 'coe_issued',
        'cert receive': 'coe_issued',
        'cert sent': 'enrolled',
        'cancelled': 'withdrawn',
    };
    return statusMap[csvStatus.toLowerCase()] || 'draft';
}

// Map CSV payment status to enum
function mapPaymentStatus(csvPayment: string): string {
    const paymentMap: Record<string, string> = {
        'unpaid': 'unpaid',
        'partial paid': 'partial',
        'fully paid': 'paid',
    };
    return paymentMap[csvPayment.toLowerCase()] || 'unpaid';
}

// Parse date from "DD Mon YYYY" format to ISO
function parseDate(dateStr: string): string {
    if (!dateStr) return 'NOW()';
    const months: Record<string, string> = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
    };
    const parts = dateStr.trim().split(' ');
    if (parts.length !== 3) return 'NOW()';
    const day = parts[0].padStart(2, '0');
    const month = months[parts[1].toLowerCase()] || '01';
    const year = parts[2];
    return `'${year}-${month}-${day}'::date`;
}

// Parse name into first/last
function parseName(fullName: string): { first: string; last: string } {
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return { first: parts[0], last: '' };
    const first = parts[0];
    const last = parts.slice(1).join(' ');
    return { first, last };
}

function parseCSV(content: string): Application[] {
    const lines = content.split('\n');
    const apps: Application[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const fields: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                fields.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        fields.push(current.trim());

        // #,Application Status,Payment Status,Created On,Agent,Applicant Name,Qual Code,Qual Name,Provider Name,Provider RTO,Total Amount,Payment Amount
        const appNumber = fields[0]?.replace(/"/g, '') || '';
        if (!appNumber) continue;

        apps.push({
            appNumber,
            status: fields[1]?.replace(/"/g, '') || 'Processing',
            paymentStatus: fields[2]?.replace(/"/g, '') || 'Unpaid',
            createdOn: fields[3]?.replace(/"/g, '') || '',
            agentName: fields[4]?.replace(/"/g, '') || '',
            applicantName: fields[5]?.replace(/"/g, '') || 'Unknown',
            qualCode: fields[6]?.replace(/"/g, '') || '',
            qualName: fields[7]?.replace(/"/g, '') || '',
            providerName: fields[8]?.replace(/"/g, '') || '',
            providerRto: fields[9]?.replace(/"/g, '') || '',
            totalAmount: parseNumber(fields[10] || '0'),
            paymentAmount: parseNumber(fields[11] || '0'),
        });
    }

    return apps;
}

function generateSQL(apps: Application[]): string {
    let sql = `-- Applications Import
-- Generated at ${new Date().toISOString()}
-- Total applications: ${apps.length}

-- Create temp table for staging
CREATE TEMP TABLE IF NOT EXISTS temp_applications (
    app_number TEXT,
    workflow_stage TEXT,
    payment_status TEXT,
    created_on DATE,
    agent_name TEXT,
    student_first_name TEXT,
    student_last_name TEXT,
    qual_code TEXT,
    rto_code TEXT,
    quoted_tuition NUMERIC(10,2),
    total_paid NUMERIC(10,2)
);

TRUNCATE temp_applications;

-- Insert staging data
INSERT INTO temp_applications (app_number, workflow_stage, payment_status, created_on, agent_name, student_first_name, student_last_name, qual_code, rto_code, quoted_tuition, total_paid)
VALUES
`;

    const values: string[] = [];
    for (const app of apps) {
        const { first, last } = parseName(app.applicantName);
        const workflowStage = mapWorkflowStatus(app.status);
        const paymentStatus = mapPaymentStatus(app.paymentStatus);
        const createdDate = parseDate(app.createdOn);

        values.push(`  ('${escapeSQL(app.appNumber)}', '${workflowStage}', '${paymentStatus}', ${createdDate}, '${escapeSQL(app.agentName)}', '${escapeSQL(first)}', '${escapeSQL(last)}', '${escapeSQL(app.qualCode)}', '${escapeSQL(app.providerRto)}', ${app.totalAmount}, ${app.paymentAmount})`);
    }

    sql += values.join(',\n');
    sql += `;

-- Insert applications with proper relationships
INSERT INTO applications (
    student_uid, 
    student_first_name, 
    student_last_name, 
    partner_id,
    offering_id,
    workflow_stage,
    payment_status,
    quoted_tuition,
    total_paid,
    created_at
)
SELECT DISTINCT ON (t.app_number)
    'APP-' || t.app_number as student_uid,
    t.student_first_name,
    t.student_last_name,
    p.id as partner_id,
    COALESCE(ro.id, (SELECT id FROM rto_offerings LIMIT 1)) as offering_id,
    t.workflow_stage::workflow_stage,
    t.payment_status::payment_status,
    t.quoted_tuition,
    t.total_paid,
    t.created_on::timestamp with time zone
FROM temp_applications t
LEFT JOIN partners p ON LOWER(p.company_name) = LOWER(t.agent_name)
LEFT JOIN qualifications q ON q.code = t.qual_code
LEFT JOIN rtos r ON LOWER(r.name) = LOWER(t.rto_code)
LEFT JOIN rto_offerings ro ON ro.qualification_id = q.id AND ro.rto_id = r.id;

-- Report results
SELECT 'Total Applications Imported' as metric, COUNT(*) as value FROM applications
UNION ALL
SELECT 'With Partner Link', COUNT(*) FROM applications WHERE partner_id IS NOT NULL
UNION ALL
SELECT 'With Valid Offering', COUNT(*) FROM applications a JOIN rto_offerings ro ON a.offering_id = ro.id
UNION ALL
SELECT 'Workflow: submitted', COUNT(*) FROM applications WHERE workflow_stage = 'submitted'
UNION ALL
SELECT 'Workflow: coe_issued', COUNT(*) FROM applications WHERE workflow_stage = 'coe_issued'
UNION ALL
SELECT 'Payment: paid', COUNT(*) FROM applications WHERE payment_status = 'paid'
UNION ALL
SELECT 'Payment: partial', COUNT(*) FROM applications WHERE payment_status = 'partial'
UNION ALL
SELECT 'Payment: unpaid', COUNT(*) FROM applications WHERE payment_status = 'unpaid'
;

-- Report unmatched agents
SELECT 'Unmatched Agent' as issue, t.agent_name, COUNT(*) as count
FROM temp_applications t
LEFT JOIN partners p ON LOWER(p.company_name) = LOWER(t.agent_name)
WHERE t.agent_name != '' AND p.id IS NULL
GROUP BY t.agent_name
ORDER BY count DESC
LIMIT 10;

-- Clean up
DROP TABLE IF EXISTS temp_applications;
`;

    return sql;
}

// Main
const csvPath = '/home/clickbit/Export Files/applications_2026-01-16_21-13-54.csv';
const content = fs.readFileSync(csvPath, 'utf-8');
const apps = parseCSV(content);

console.log(`Parsed ${apps.length} applications from CSV`);

// Stats
const statuses = new Map<string, number>();
const paymentStatuses = new Map<string, number>();
for (const app of apps) {
    statuses.set(app.status, (statuses.get(app.status) || 0) + 1);
    paymentStatuses.set(app.paymentStatus, (paymentStatuses.get(app.paymentStatus) || 0) + 1);
}
console.log('\nApplication Statuses:');
for (const [status, count] of statuses) {
    console.log(`  ${status}: ${count}`);
}
console.log('\nPayment Statuses:');
for (const [status, count] of paymentStatuses) {
    console.log(`  ${status}: ${count}`);
}

const sql = generateSQL(apps);
const outputPath = '/home/clickbit/lumiere-portal/scripts/import-applications.sql';
fs.writeFileSync(outputPath, sql);

console.log(`\nSQL file generated: ${outputPath}`);
