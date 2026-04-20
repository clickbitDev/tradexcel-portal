/**
 * One-off / CLI: import qualifications from edward-qualifications-list.csv using the service role.
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local or .env
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import Papa from 'papaparse';

config({ path: path.resolve(__dirname, '../.env.local') });
config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function parseOptionalInt(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    if (s === '') return null;
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
}

async function main() {
    if (!supabaseUrl || !serviceKey) {
        console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const csvPath = path.resolve(__dirname, '../edward-qualifications-list.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    const parsed = Papa.parse<Record<string, string>>(csvContent, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
    });

    const fatal = parsed.errors.find((e) => e.type === 'Quotes' || e.type === 'Delimiter');
    if (fatal) {
        console.error('CSV parse error:', fatal.message);
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const rows = parsed.data
        .map((raw) => {
            const code = raw.code?.trim();
            const name = raw.name?.trim();
            if (!code || !name) return null;
            return {
                code,
                name,
                level: raw.level?.trim() || null,
                status: (raw.status?.trim() || 'current') as 'current' | 'superseded' | 'deleted',
                release_date: raw.release_date?.trim() || null,
                superseded_by: raw.superseded_by?.trim() || null,
                entry_requirements: raw.entry_requirements?.trim() || null,
                cricos_code: raw.cricos_code?.trim() || null,
                core_units: parseOptionalInt(raw.core_units),
                elective_units: parseOptionalInt(raw.elective_units),
                total_units: parseOptionalInt(raw.total_units),
            };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

    console.log(`Upserting ${rows.length} qualifications from ${csvPath}`);

    const { data, error } = await supabase.from('qualifications').upsert(rows, {
        onConflict: 'code',
        ignoreDuplicates: false,
    });

    if (error) {
        console.error('Supabase error:', error.message, error);
        process.exit(1);
    }

    console.log('Done.', data?.length ?? rows.length, 'rows affected (check Supabase for upsert behaviour).');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
