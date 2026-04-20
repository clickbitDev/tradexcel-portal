// Script to ensure all partners/agents have Supabase auth accounts
// Uses Supabase Admin API (service role key) to create auth users
import * as path from 'path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    }
});

interface Partner {
    id: string;
    company_name: string;
    email: string;
    contact_name: string | null;
    type: string;
}

async function syncAgentAccounts() {
    console.log('Fetching all partners from database...\n');

    // Get all partners (agents) from the database
    const { data: partners, error: fetchError } = await supabase
        .from('partners')
        .select('id, company_name, email, contact_name, type')
        .eq('status', 'active');

    if (fetchError) {
        console.error('Failed to fetch partners:', fetchError.message);
        process.exit(1);
    }

    console.log(`Found ${partners?.length || 0} active partners\n`);

    // Get all existing auth users
    const { data: existingUsersData } = await supabase.auth.admin.listUsers();
    const existingEmails = new Set(
        existingUsersData?.users?.map(u => u.email?.toLowerCase()) || []
    );

    console.log(`Found ${existingEmails.size} existing auth users\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;
    const createdAccounts: { email: string; password: string; name: string }[] = [];

    for (const partner of partners || []) {
        // Skip partners without valid emails
        if (!partner.email ||
            !partner.email.includes('@') ||
            partner.email.includes('fake.com') ||
            partner.email.includes('nomail') ||
            partner.email.includes('noemail') ||
            partner.email === 'nomail@xyz.com' ||
            partner.email === 'xyz@gmail.com') {
            console.log(`Skipping invalid email: ${partner.email} (${partner.company_name})`);
            skipped++;
            continue;
        }

        const email = partner.email.toLowerCase().trim();

        // Check if user already exists
        if (existingEmails.has(email)) {
            console.log(`Already exists: ${email}`);
            skipped++;
            continue;
        }

        try {
            // Generate a temporary password
            const tempPassword = `Agent${Math.random().toString(36).slice(2, 8)}!${Date.now().toString().slice(-4)}`;
            const displayName = partner.contact_name || partner.company_name;

            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: email,
                password: tempPassword,
                email_confirm: true, // Auto-confirm email
                user_metadata: {
                    full_name: displayName,
                    role: 'agent',
                    partner_id: partner.id,
                }
            });

            if (authError) {
                console.error(`Failed to create: ${email} - ${authError.message}`);
                errors++;
                continue;
            }

            // Create profile for the user
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: authData.user.id,
                    email: email,
                    full_name: displayName,
                    role: 'agent',
                }, {
                    onConflict: 'id',
                });

            if (profileError) {
                console.error(`Failed to create profile for ${email}: ${profileError.message}`);
            }

            // Link partner to auth user
            const { error: linkError } = await supabase
                .from('partners')
                .update({ user_id: authData.user.id })
                .eq('id', partner.id);

            if (linkError) {
                console.error(`Failed to link partner ${partner.id}: ${linkError.message}`);
            }

            console.log(`Created: ${email} (${displayName})`);
            created++;
            createdAccounts.push({
                email,
                password: tempPassword,
                name: displayName,
            });

        } catch (e) {
            console.error(`Error processing ${email}:`, e);
            errors++;
        }
    }

    console.log(`\n=== Sync Complete ===`);
    console.log(`Created: ${created}`);
    console.log(`Skipped (existing/invalid): ${skipped}`);
    console.log(`Errors: ${errors}`);

    if (createdAccounts.length > 0) {
        console.log(`\n=== New Account Credentials ===`);
        console.log(`(Save these - users will need to reset passwords)`);
        console.log(`\n${'Email'.padEnd(50)} | Password`);
        console.log('-'.repeat(80));
        for (const account of createdAccounts) {
            console.log(`${account.email.padEnd(50)} | ${account.password}`);
        }
    }
}

// Run the sync
syncAgentAccounts().catch(console.error);
