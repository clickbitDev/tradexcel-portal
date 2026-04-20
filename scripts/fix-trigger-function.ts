/**
 * Fix the trigger function to ensure it can find the payment_status enum
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function fixTrigger() {
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
        
        // Recreate the trigger function with explicit schema
        const fixSQL = `
-- Recreate the trigger function with explicit schema reference
CREATE OR REPLACE FUNCTION update_application_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  total_quoted numeric;
  new_status public.payment_status;
BEGIN
  -- Calculate total quoted amount
  total_quoted := COALESCE(NEW.quoted_tuition, 0) + COALESCE(NEW.quoted_materials, 0);
  
  -- Determine new payment status
  IF COALESCE(NEW.total_paid, 0) = 0 THEN
    new_status := 'unpaid'::public.payment_status;
  ELSIF NEW.total_paid < total_quoted THEN
    new_status := 'partial'::public.payment_status;
  ELSE
    new_status := 'paid'::public.payment_status;
  END IF;
  
  -- Update status if changed
  IF new_status IS DISTINCT FROM NEW.payment_status THEN
    NEW.payment_status := new_status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
        `;
        
        await client.query(fixSQL);
        console.log('✅ Trigger function recreated with explicit schema\n');
        
        // Verify the function exists
        const funcResult = await client.query(`
            SELECT proname, prosrc 
            FROM pg_proc 
            WHERE proname = 'update_application_payment_status';
        `);
        
        if (funcResult.rows.length > 0) {
            console.log('✅ Trigger function verified');
        }
        
    } finally {
        await client.end();
    }
}

fixTrigger();
