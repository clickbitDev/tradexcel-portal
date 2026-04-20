/**
 * Script to run migration 042_fix_payment_status_enum.sql programmatically
 * 
 * This script uses PostgreSQL client (pg) to directly execute the migration SQL.
 * 
 * Usage: npx tsx scripts/run-migration-042-direct.ts
 * 
 * Required environment variables:
 * - SUPABASE_DB_URL or DATABASE_URL (PostgreSQL connection string)
 * - Or SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Read migration file
const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '042_fix_payment_status_enum.sql');
if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

async function getDatabaseUrl(): Promise<string> {
    // Try different environment variable names
    const dbUrl = 
        process.env.SUPABASE_DB_URL || 
        process.env.DATABASE_URL || 
        process.env.POSTGRES_URL;

    if (dbUrl) {
        return dbUrl;
    }

    // Try to construct from Supabase URL and service key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
        // Extract project ref from Supabase URL
        // Format: https://[project-ref].supabase.co
        const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
        if (match) {
            const projectRef = match[1];
            // Try to read from pooler-url file (but it needs password)
            const poolerUrlPath = path.join(process.cwd(), 'supabase', '.temp', 'pooler-url');
            if (fs.existsSync(poolerUrlPath)) {
                let poolerUrl = fs.readFileSync(poolerUrlPath, 'utf-8').trim();
                // If URL doesn't have password, try to add it from env
                if (poolerUrl && !poolerUrl.includes(':')) {
                    const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
                    if (dbPassword) {
                        // Insert password into connection string
                        poolerUrl = poolerUrl.replace('@', `:${dbPassword}@`);
                        return poolerUrl;
                    }
                } else if (poolerUrl.includes('@')) {
                    // Already has password or format is correct
                    return poolerUrl;
                }
            }
            // Construct connection string (requires password from env)
            const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
            if (dbPassword) {
                return `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres`;
            }
        }
    }

    throw new Error(
        'Database connection URL not found. Please set one of:\n' +
        '  - SUPABASE_DB_URL\n' +
        '  - DATABASE_URL\n' +
        '  - POSTGRES_URL\n' +
        'Or set SUPABASE_DB_PASSWORD with NEXT_PUBLIC_SUPABASE_URL'
    );
}

async function runMigration() {
    console.log('='.repeat(70));
    console.log('Migration 042: Fix payment_status enum type');
    console.log('='.repeat(70));
    console.log('\n🔄 Connecting to database...\n');

    let client: Client | null = null;

    try {
        const databaseUrl = await getDatabaseUrl();
        
        // Create PostgreSQL client
        client = new Client({
            connectionString: databaseUrl,
            ssl: {
                rejectUnauthorized: false // Supabase uses SSL
            }
        });

        await client.connect();
        console.log('✅ Connected to database\n');

        // Execute migration SQL
        console.log('🔄 Executing migration...\n');
        await client.query(migrationSQL);
        
        console.log('✅ Migration executed successfully!\n');
        
        // Verify the enum was created
        const result = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'payment_status'
            ) as enum_exists;
        `);
        
        if (result.rows[0]?.enum_exists) {
            console.log('✅ Verified: payment_status enum type exists\n');
        } else {
            console.log('⚠️  Warning: Could not verify enum creation\n');
        }

        console.log('='.repeat(70));
        console.log('✅ Migration completed successfully!');
        console.log('You can now try creating an application again.');
        console.log('='.repeat(70));

    } catch (error: any) {
        console.error('\n❌ Error running migration:', error.message);
        console.error('\n💡 Troubleshooting:');
        console.error('   1. Make sure your database connection string is correct');
        console.error('   2. Check that you have the necessary permissions');
        console.error('   3. Verify your Supabase project credentials\n');
        process.exit(1);
    } finally {
        if (client) {
            await client.end();
        }
    }
}

runMigration();
