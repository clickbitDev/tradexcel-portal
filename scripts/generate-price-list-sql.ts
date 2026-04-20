// Script to generate SQL for importing RTO Offerings (price list)
// This connects qualifications and RTOs via the rto_offerings table
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: path.resolve(__dirname, '../.env.local') });

interface PriceRow {
    qualificationCode: string;
    rtoCode: string;
    providerName: string;
    collegeFee: number;
    enrolmentFee: number;
    miscFees: number;
    studentFee: number;
}

function parseNumber(str: string): number {
    if (!str || str.trim() === '') return 0;
    // Remove quotes, commas, and parse
    const cleaned = str.replace(/"/g, '').replace(/,/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

function escapeSQL(str: string): string {
    return str.replace(/'/g, "''");
}

function parseCSV(content: string): PriceRow[] {
    const lines = content.split('\n');
    const rows: PriceRow[] = [];

    let lastQualCode = '';
    let lastRtoCode = '';

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

        if (fields.length < 6) continue;

        // Qualification Code,Qualification Name,RTO Code,RTO Name,Provider Name(s),College Fee(s),Enrolment Fee,Misc Fees,Student Fee
        let qualCode = fields[0].replace(/"/g, '');
        let rtoCode = fields[2].replace(/"/g, '');
        const providerName = fields[4]?.replace(/"/g, '') || '';
        const collegeFee = parseNumber(fields[5]);
        const enrolmentFee = parseNumber(fields[6] || '0');
        const miscFees = parseNumber(fields[7] || '0');
        const studentFee = parseNumber(fields[8] || '0');

        // Handle continuation rows (empty qual/rto codes inherit from previous)
        if (!qualCode && lastQualCode) {
            qualCode = lastQualCode;
        }
        if (!rtoCode && lastRtoCode) {
            rtoCode = lastRtoCode;
        }

        // Skip if we still don't have valid codes
        if (!qualCode || !rtoCode) continue;

        // Update last known codes
        if (qualCode) lastQualCode = qualCode;
        if (rtoCode) lastRtoCode = rtoCode;

        rows.push({
            qualificationCode: qualCode,
            rtoCode,
            providerName,
            collegeFee,
            enrolmentFee,
            miscFees,
            studentFee,
        });
    }

    return rows;
}

function groupByRtoQualification(rows: PriceRow[]): Map<string, PriceRow> {
    // Group by rto_code + qualification_code, keep the first (or best) entry
    // If there are multiple providers, we'll use the first one's fees
    const map = new Map<string, PriceRow>();

    for (const row of rows) {
        const key = `${row.rtoCode}|${row.qualificationCode}`;
        if (!map.has(key)) {
            map.set(key, row);
        }
        // Note: In a more sophisticated system, we'd create separate provider records
    }

    return map;
}

function generateSQL(offerings: Map<string, PriceRow>): string {
    let sql = `-- RTO Offerings Import (Price List)
-- Generated at ${new Date().toISOString()}
-- Total unique RTO-Qualification combinations: ${offerings.size}

-- First, we'll create a temp table to store the mappings
CREATE TEMP TABLE IF NOT EXISTS temp_offerings (
    rto_code TEXT,
    qualification_code TEXT,
    tuition_fee NUMERIC(10,2),
    material_fee NUMERIC(10,2),
    application_fee NUMERIC(10,2),
    enrolment_fee NUMERIC(10,2)
);

-- Clear temp table
TRUNCATE temp_offerings;

-- Insert data into temp table
INSERT INTO temp_offerings (rto_code, qualification_code, tuition_fee, material_fee, application_fee, enrolment_fee)
VALUES
`;

    const values: string[] = [];
    for (const [, row] of offerings) {
        values.push(`  ('${escapeSQL(row.rtoCode)}', '${escapeSQL(row.qualificationCode)}', ${row.collegeFee}, ${row.miscFees}, ${row.studentFee}, ${row.enrolmentFee})`);
    }

    sql += values.join(',\n');
    sql += `;

-- Now insert/update rto_offerings by looking up the UUIDs
INSERT INTO rto_offerings (rto_id, qualification_id, tuition_fee_onshore, material_fee, application_fee)
SELECT 
    r.id as rto_id,
    q.id as qualification_id,
    t.tuition_fee as tuition_fee_onshore,
    t.material_fee,
    t.application_fee
FROM temp_offerings t
JOIN rtos r ON r.code = t.rto_code
JOIN qualifications q ON q.code = t.qualification_code
ON CONFLICT (rto_id, qualification_id) DO UPDATE SET
    tuition_fee_onshore = EXCLUDED.tuition_fee_onshore,
    material_fee = EXCLUDED.material_fee,
    application_fee = EXCLUDED.application_fee,
    updated_at = NOW();

-- Report on what was imported
SELECT 'Imported RTO Offerings' as result, COUNT(*) as count FROM rto_offerings;

-- Report any unmatched qualification codes
SELECT 'Unmatched Qualifications' as issue, t.qualification_code 
FROM temp_offerings t
LEFT JOIN qualifications q ON q.code = t.qualification_code
WHERE q.id IS NULL
GROUP BY t.qualification_code;

-- Report any unmatched RTO codes
SELECT 'Unmatched RTOs' as issue, t.rto_code
FROM temp_offerings t
LEFT JOIN rtos r ON r.code = t.rto_code
WHERE r.id IS NULL
GROUP BY t.rto_code;

-- Clean up
DROP TABLE IF EXISTS temp_offerings;
`;

    return sql;
}

// Main
const csvPath = '/home/clickbit/Export Files/price list.csv';
const content = fs.readFileSync(csvPath, 'utf-8');
const rows = parseCSV(content);

console.log(`Parsed ${rows.length} rows from CSV`);

const grouped = groupByRtoQualification(rows);
console.log(`Grouped into ${grouped.size} unique RTO-Qualification combinations`);

// Find potentially problematic codes
const qualCodes = new Set<string>();
const rtoCodes = new Set<string>();
for (const [, row] of grouped) {
    qualCodes.add(row.qualificationCode);
    rtoCodes.add(row.rtoCode);
}
console.log(`\nUnique qualification codes: ${qualCodes.size}`);
console.log(`Unique RTO codes: ${rtoCodes.size}`);

const sql = generateSQL(grouped);
const outputPath = '/home/clickbit/lumiere-portal/scripts/import-price-list.sql';
fs.writeFileSync(outputPath, sql);

console.log(`\nSQL file generated: ${outputPath}`);
