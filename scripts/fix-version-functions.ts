/**
 * Fix version control functions to work with empty search_path
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function fixFunctions() {
    const poolerUrlPath = path.join(process.cwd(), 'supabase', '.temp', 'pooler-url');
    let databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    
    if (!databaseUrl && fs.existsSync(poolerUrlPath)) {
        let poolerUrl = fs.readFileSync(poolerUrlPath, 'utf-8').trim();
        const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
        if (dbPassword && poolerUrl && !poolerUrl.includes(':')) {
            poolerUrl = poolerUrl.replace('@', `:${dbPassword}@`);
            databaseUrl = poolerUrl;
        }
    }
    
    if (!databaseUrl) {
        console.error('❌ Database URL not found');
        process.exit(1);
    }
    
    const client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        console.log('✅ Connected to database\n');
        
        // Fix get_next_version_number function with explicit schema
        const fixSQL = `
-- Fix get_next_version_number to work with empty search_path
CREATE OR REPLACE FUNCTION public.get_next_version_number(p_table_name VARCHAR, p_record_id UUID)
RETURNS INTEGER AS $$
DECLARE
    next_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version
    FROM public.record_versions
    WHERE table_name = p_table_name AND record_id = p_record_id;
    
    RETURN next_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
        `;
        
        await client.query(fixSQL);
        console.log('✅ Fixed get_next_version_number function\n');
        
    } finally {
        await client.end();
    }
}

fixFunctions();
