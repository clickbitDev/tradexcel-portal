// Script to generate SQL for importing qualifications
import * as fs from 'fs';
import * as path from 'path';

interface Qualification {
    code: string;
    name: string;
    level: string | null;
    status: 'current' | 'superseded' | 'deleted';
    release_date: string | null;
}

function parseDate(dateStr: string): string | null {
    if (!dateStr || dateStr.trim() === '') return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function extractLevel(name: string): string | null {
    if (/Advanced Diploma/i.test(name)) return 'Advanced Diploma';
    if (/Graduate Diploma/i.test(name)) return 'Graduate Diploma';
    if (/Graduate Certificate/i.test(name)) return 'Graduate Certificate';
    if (/Diploma/i.test(name)) return 'Diploma';
    if (/Certificate IV/i.test(name)) return 'Certificate IV';
    if (/Certificate III/i.test(name)) return 'Certificate III';
    if (/Certificate II/i.test(name)) return 'Certificate II';
    if (/Certificate I(?!\s?[IVX])/i.test(name)) return 'Certificate I';
    return null;
}

function escapeSQL(str: string): string {
    return str.replace(/'/g, "''");
}

function parseCSV(content: string): Qualification[] {
    const lines = content.split('\n');
    const qualifications: Qualification[] = [];

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

        if (fields.length < 4) continue;

        const [code, name, releaseDateStr, statusStr] = fields;

        qualifications.push({
            code: code.replace(/"/g, ''),
            name: name.replace(/"/g, ''),
            level: extractLevel(name),
            status: statusStr.toLowerCase() === 'superseded' ? 'superseded' : 'current',
            release_date: parseDate(releaseDateStr.replace(/"/g, '')),
        });
    }

    return qualifications;
}

function generateSQL(qualifications: Qualification[]): string {
    let sql = `-- Qualifications Import
-- Generated at ${new Date().toISOString()}
-- Total: ${qualifications.length} qualifications

-- Disable triggers temporarily for bulk insert (optional - run as superuser)
-- SET session_replication_role = replica;

`;

    // Generate INSERT with ON CONFLICT for upsert behavior
    sql += `INSERT INTO qualifications (code, name, level, status, release_date, tga_sync_status, tga_last_synced_at)
VALUES\n`;

    const values = qualifications.map((q, i) => {
        const level = q.level ? `'${escapeSQL(q.level)}'` : 'NULL';
        const releaseDate = q.release_date ? `'${q.release_date}'` : 'NULL';
        return `  ('${escapeSQL(q.code)}', '${escapeSQL(q.name)}', ${level}, '${q.status}', ${releaseDate}, 'synced', NOW())`;
    });

    sql += values.join(',\n');
    sql += `
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  level = EXCLUDED.level,
  status = EXCLUDED.status,
  release_date = EXCLUDED.release_date,
  tga_sync_status = 'synced',
  tga_last_synced_at = NOW(),
  updated_at = NOW();

-- Re-enable triggers
-- SET session_replication_role = DEFAULT;

-- Verify import
SELECT COUNT(*) as total_qualifications FROM qualifications;
`;

    return sql;
}

// Main
const csvPath = '/home/clickbit/Export Files/qualifications_2026-01-16_20-32-04.csv';
const content = fs.readFileSync(csvPath, 'utf-8');
const qualifications = parseCSV(content);

console.log(`Parsed ${qualifications.length} qualifications`);

const sql = generateSQL(qualifications);
const outputPath = '/home/clickbit/lumiere-portal/scripts/import-qualifications.sql';
fs.writeFileSync(outputPath, sql);

console.log(`SQL file generated: ${outputPath}`);
console.log('\nTo import, run this SQL in the Supabase SQL Editor:');
console.log(`https://supabase.com/dashboard/project/vrurnquhemoohagrabbz/sql/new`);
