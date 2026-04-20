/**
 * Verify that payment_status enum exists
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function verifyEnum() {
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
        
        // Check if enum exists
        const result = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'payment_status'
            ) as enum_exists;
        `);
        
        if (result.rows[0]?.enum_exists) {
            console.log('✅ payment_status enum EXISTS');
            
            // Get enum values
            const enumValues = await client.query(`
                SELECT enumlabel 
                FROM pg_enum 
                WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_status')
                ORDER BY enumsortorder;
            `);
            
            console.log('Enum values:', enumValues.rows.map(r => r.enumlabel).join(', '));
        } else {
            console.log('❌ payment_status enum DOES NOT EXIST');
            console.log('Running migration...\n');
            
            const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '042_fix_payment_status_enum.sql');
            const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
            await client.query(migrationSQL);
            
            console.log('✅ Migration executed');
            
            // Verify again
            const verifyResult = await client.query(`
                SELECT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'payment_status'
                ) as enum_exists;
            `);
            
            if (verifyResult.rows[0]?.enum_exists) {
                console.log('✅ Verified: payment_status enum now exists');
            }
        }
    } finally {
        await client.end();
    }
}

verifyEnum();
