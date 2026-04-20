/**
 * Script to run migration 042_fix_payment_status_enum.sql programmatically
 * 
 * This script uses Supabase Management API or direct PostgreSQL connection
 * to execute the migration SQL.
 * 
 * Usage: npx tsx scripts/run-migration-042.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseDbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing Supabase environment variables');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nPlease set these in your .env.local file');
    process.exit(1);
}

// TypeScript type narrowing: after the check above, we know these are strings
const supabaseUrlString = supabaseUrl as string;
const supabaseServiceKeyString = supabaseServiceKey as string;

// Read migration file
const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '042_fix_payment_status_enum.sql');
if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

async function runMigrationViaRPC() {
    console.log('🔄 Attempting to run migration via Supabase RPC...\n');

    const supabase = createClient(supabaseUrlString, supabaseServiceKeyString, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // Try to execute via a custom RPC function (if it exists)
        // Most Supabase projects don't have a generic SQL executor, so this will likely fail
        const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
        
        if (error) {
            throw error;
        }
        
        console.log('✅ Migration executed successfully via RPC');
        return true;
    } catch (error: any) {
        console.log('⚠️  RPC method not available:', error.message);
        return false;
    }
}

async function runMigrationViaManagementAPI() {
    console.log('🔄 Attempting to run migration via Supabase Management API...\n');

    try {
        // Supabase Management API endpoint for running SQL
        const response = await fetch(`${supabaseUrlString}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseServiceKeyString,
                'Authorization': `Bearer ${supabaseServiceKeyString}`,
            },
            body: JSON.stringify({ sql: migrationSQL }),
        });

        if (response.ok) {
            console.log('✅ Migration executed successfully via Management API');
            return true;
        } else {
            const errorText = await response.text();
            console.log('⚠️  Management API method not available:', errorText);
            return false;
        }
    } catch (error: any) {
        console.log('⚠️  Management API method failed:', error.message);
        return false;
    }
}

async function runMigrationViaPostgREST() {
    console.log('🔄 Attempting to run migration via PostgREST...\n');

    try {
        // Split SQL into statements and try to execute via PostgREST
        // This is a workaround - PostgREST doesn't support arbitrary SQL
        // We'll create a temporary function to execute the migration
        
        const supabase = createClient(supabaseUrlString, supabaseServiceKeyString, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // Create a temporary function to run the migration
        const createFunctionSQL = `
            CREATE OR REPLACE FUNCTION temp_run_migration_042()
            RETURNS void
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            BEGIN
                ${migrationSQL}
            END;
            $$;
        `;

        // Try to execute via RPC
        let createError;
        try {
            const result = await supabase.rpc('exec_sql', { 
                sql: createFunctionSQL 
            });
            createError = result.error;
        } catch (error: any) {
            createError = { message: 'RPC not available', ...error };
        }

        if (createError) {
            throw createError;
        }

        // Execute the function
        const { error: execError } = await supabase.rpc('temp_run_migration_042');
        
        if (execError) {
            throw execError;
        }

        console.log('✅ Migration executed successfully');
        return true;
    } catch (error: any) {
        console.log('⚠️  PostgREST method failed:', error.message);
        return false;
    }
}

async function main() {
    console.log('='.repeat(70));
    console.log('Migration 042: Fix payment_status enum type');
    console.log('='.repeat(70));
    console.log('\n📋 Running migration programmatically...\n');

    // Try different methods
    let success = false;

    // Method 1: Try RPC
    if (!success) {
        success = await runMigrationViaRPC();
    }

    // Method 2: Try Management API
    if (!success) {
        success = await runMigrationViaManagementAPI();
    }

    // Method 3: Try PostgREST workaround
    if (!success) {
        success = await runMigrationViaPostgREST();
    }

    if (!success) {
        console.log('\n' + '='.repeat(70));
        console.log('⚠️  Could not execute migration programmatically');
        console.log('='.repeat(70));
        console.log('\n📝 Please run this migration manually in Supabase SQL Editor:\n');
        console.log('─'.repeat(70));
        console.log(migrationSQL);
        console.log('─'.repeat(70));
        console.log('\n📋 Steps:');
        console.log('   1. Go to your Supabase Dashboard');
        console.log('   2. Navigate to SQL Editor (left sidebar)');
        console.log('   3. Paste the SQL above');
        console.log('   4. Click "Run" button\n');
        console.log('💡 Alternative: Install Supabase CLI and run:');
        console.log('   supabase db push\n');
        process.exit(1);
    } else {
        console.log('\n✅ Migration completed successfully!');
        console.log('You can now try creating an application again.\n');
    }
}

main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});
