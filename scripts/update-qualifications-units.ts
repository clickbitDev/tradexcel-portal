// Script to update qualifications with unit counts
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../.env.local') });

interface QualificationUpdate {
    code: string;
    totalUnits: number;
    coreUnits: number;
    electiveUnits: number;
}

function parseCSV(content: string): QualificationUpdate[] {
    const lines = content.split('\n');
    const updates: QualificationUpdate[] = [];

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

        // Q.Code,Qualification,Package Release Date,Package Status,Total No. of Units,Core Units,Elective Units
        const code = fields[0]?.replace(/"/g, '') || '';
        if (!code) continue;

        const totalUnits = parseInt(fields[4]?.replace(/"/g, '') || '0', 10) || 0;
        const coreUnits = parseInt(fields[5]?.replace(/"/g, '') || '0', 10) || 0;
        const electiveUnits = parseInt(fields[6]?.replace(/"/g, '') || '0', 10) || 0;

        updates.push({ code, totalUnits, coreUnits, electiveUnits });
    }

    return updates;
}

function generateSQL(updates: QualificationUpdate[]): string {
    let sql = `-- Update Qualifications with Unit Counts
-- Generated at ${new Date().toISOString()}
-- Total: ${updates.length} qualifications

`;

    for (const u of updates) {
        sql += `UPDATE qualifications SET total_units = ${u.totalUnits}, core_units = ${u.coreUnits}, elective_units = ${u.electiveUnits} WHERE code = '${u.code}';\n`;
    }

    sql += `\n-- Verify updates\nSELECT code, name, total_units, core_units, elective_units FROM qualifications WHERE total_units IS NOT NULL LIMIT 10;\n`;

    return sql;
}

// Main
const csvPath = '/home/clickbit/Export Files/qualifications_2026-01-16_20-32-04.csv';
const content = fs.readFileSync(csvPath, 'utf-8');
const updates = parseCSV(content);

console.log(`Parsed ${updates.length} qualifications with unit counts`);

const sql = generateSQL(updates);
const outputPath = '/home/clickbit/lumiere-portal/scripts/update-qualifications-units.sql';
fs.writeFileSync(outputPath, sql);

console.log(`SQL file generated: ${outputPath}`);
