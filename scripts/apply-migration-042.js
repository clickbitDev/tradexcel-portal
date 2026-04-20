/**
 * Script to apply migration 042_fix_payment_status_enum.sql
 * 
 * This script outputs the SQL that needs to be run in Supabase SQL Editor
 * 
 * Usage:
 *   1. Run: node scripts/apply-migration-042.js
 *   2. Copy the SQL output
 *   3. Paste it into Supabase Dashboard > SQL Editor
 *   4. Click "Run"
 */

const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '042_fix_payment_status_enum.sql');

if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

console.log('='.repeat(70));
console.log('Migration 042: Fix payment_status enum type');
console.log('='.repeat(70));
console.log('\n📋 Copy the SQL below and run it in your Supabase SQL Editor:\n');
console.log('─'.repeat(70));
console.log(migrationSQL);
console.log('─'.repeat(70));
console.log('\n📝 Instructions:');
console.log('   1. Go to your Supabase Dashboard');
console.log('   2. Navigate to SQL Editor (left sidebar)');
console.log('   3. Paste the SQL above');
console.log('   4. Click "Run" button');
console.log('   5. Verify the migration completed successfully\n');
console.log('✅ After running this migration, try creating an application again.\n');
