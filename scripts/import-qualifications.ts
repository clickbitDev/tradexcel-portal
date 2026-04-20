// Script to import qualifications from CSV into Supabase
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface QualificationRow {
    code: string;
    name: string;
    level: string | null;
    status: 'current' | 'superseded' | 'deleted';
    release_date: string | null;
    tga_sync_status: 'synced' | 'pending' | 'error' | 'never';
}

function parseDate(dateStr: string): string | null {
    if (!dateStr || dateStr.trim() === '') return null;

    // Parse DD/MM/YYYY format
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;

    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function extractLevel(name: string): string | null {
    // Extract qualification level from name
    const levelPatterns = [
        /Certificate II/i,
        /Certificate III/i,
        /Certificate IV/i,
        /Certificate I(?!\s?[IVX])/i,
        /Diploma/i,
        /Advanced Diploma/i,
        /Graduate Diploma/i,
        /Graduate Certificate/i,
    ];

    for (const pattern of levelPatterns) {
        const match = name.match(pattern);
        if (match) {
            return match[0];
        }
    }

    // Check for Statement of Attainment and Skill Sets
    if (name.includes('Statement of Attainment') || name.startsWith('SOA')) {
        return 'Statement of Attainment';
    }
    if (name.includes('Skill Set')) {
        return 'Skill Set';
    }

    return null;
}

function parseCSV(content: string): QualificationRow[] {
    const lines = content.split('\n');
    const qualifications: QualificationRow[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV properly handling quoted fields
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

        // Map status
        let status: 'current' | 'superseded' | 'deleted' = 'current';
        if (statusStr.toLowerCase() === 'superseded') {
            status = 'superseded';
        }

        qualifications.push({
            code: code.replace(/"/g, ''),
            name: name.replace(/"/g, ''),
            level: extractLevel(name),
            status,
            release_date: parseDate(releaseDateStr.replace(/"/g, '')),
            tga_sync_status: 'synced',
        });
    }

    return qualifications;
}

async function importQualifications() {
    console.log('Reading CSV file...');

    const csvPath = '/home/clickbit/Export Files/qualifications_2026-01-16_20-32-04.csv';
    const content = fs.readFileSync(csvPath, 'utf-8');

    const qualifications = parseCSV(content);
    console.log(`Parsed ${qualifications.length} qualifications`);

    // Import in batches of 50
    const batchSize = 50;
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < qualifications.length; i += batchSize) {
        const batch = qualifications.slice(i, i + batchSize);

        const { data, error } = await supabase
            .from('qualifications')
            .upsert(batch, {
                onConflict: 'code',
                ignoreDuplicates: false
            })
            .select();

        if (error) {
            console.error(`Error importing batch ${i / batchSize + 1}:`, error.message);
            errors += batch.length;
        } else {
            imported += data?.length || 0;
            console.log(`Imported batch ${i / batchSize + 1}: ${data?.length || 0} records`);
        }
    }

    console.log('\n=== Import Complete ===');
    console.log(`Total parsed: ${qualifications.length}`);
    console.log(`Successfully imported: ${imported}`);
    console.log(`Errors: ${errors}`);
}

importQualifications().catch(console.error);
