// Script to generate SQL for importing RTOs
import * as fs from 'fs';

interface RTO {
    code: string;
    name: string;
    phone: string | null;
    email: string | null;
    status: 'active' | 'inactive' | 'pending';
}

function escapeSQL(str: string): string {
    return str.replace(/'/g, "''");
}

function mapStatus(statusStr: string): 'active' | 'inactive' | 'pending' {
    const lower = statusStr.toLowerCase();
    if (lower.includes('cancel') || lower.includes('dead')) return 'inactive';
    if (lower.includes('pending')) return 'pending';
    return 'active';
}

function parseCSV(content: string): RTO[] {
    const lines = content.split('\n');
    const rtos: RTO[] = [];

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

        // RTO Code, RTO Name, Contact Person Name, Mobile, Email, Status, State
        const [code, name, , mobile, email, statusStr] = fields;

        rtos.push({
            code: code.replace(/"/g, ''),
            name: name.replace(/"/g, ''),
            phone: mobile?.replace(/"/g, '') || null,
            email: email?.replace(/"/g, '') || null,
            status: mapStatus(statusStr),
        });
    }

    return rtos;
}

function generateSQL(rtos: RTO[]): string {
    let sql = `-- RTOs Import
-- Generated at ${new Date().toISOString()}
-- Total: ${rtos.length} RTOs

INSERT INTO rtos (code, name, phone, email, status, tga_sync_status, tga_last_synced_at)
VALUES
`;

    const values = rtos.map((r) => {
        const phone = r.phone ? `'${escapeSQL(r.phone)}'` : 'NULL';
        const email = r.email ? `'${escapeSQL(r.email)}'` : 'NULL';
        return `  ('${escapeSQL(r.code)}', '${escapeSQL(r.name)}', ${phone}, ${email}, '${r.status}', 'synced', NOW())`;
    });

    sql += values.join(',\n');
    sql += `
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  status = EXCLUDED.status,
  tga_sync_status = 'synced',
  tga_last_synced_at = NOW(),
  updated_at = NOW();

-- Verify import
SELECT COUNT(*) as total_rtos FROM rtos;
`;

    return sql;
}

// Main
const csvPath = '/home/clickbit/Export Files/rtos_2026-01-16_21-07-40.csv';
const content = fs.readFileSync(csvPath, 'utf-8');
const rtos = parseCSV(content);

console.log(`Parsed ${rtos.length} RTOs`);

const sql = generateSQL(rtos);
const outputPath = '/home/clickbit/lumiere-portal/scripts/import-rtos.sql';
fs.writeFileSync(outputPath, sql);

console.log(`SQL file generated: ${outputPath}`);
