// Script to import Users into Supabase Auth and create their profiles
// Uses Supabase Admin API (service role key) to create auth users
import * as fs from 'fs';
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

interface User {
    name: string;
    email: string;
    designation: string;
    phone: string;
    role: string;
    status: string;
}

// Map CSV roles to database enum values
function mapRole(csvRole: string): string {
    const roleMap: Record<string, string> = {
        'admin': 'admin',
        'manager': 'manager',
        'staff': 'staff',
        'agent': 'agent',
        'ceo': 'ceo',
        'executive manager': 'executive_manager',
        'accounts manager': 'accounts_manager',
        'assessor': 'assessor',
        'dispatch coordinator': 'dispatch_coordinator',
        'frontdesk': 'frontdesk',
        'developer': 'developer',
    };
    return roleMap[csvRole.toLowerCase()] || 'staff';
}

function parseCSV(content: string): User[] {
    const lines = content.split('\n');
    const users: User[] = [];
    const seenEmails = new Set<string>();

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

        // Name,Email,Designation,Phone,Role,Status
        const email = fields[1]?.replace(/"/g, '').toLowerCase().trim();
        if (!email || !email.includes('@')) continue;

        // Skip duplicates
        if (seenEmails.has(email)) {
            console.log(`Skipping duplicate email: ${email}`);
            continue;
        }
        seenEmails.add(email);

        const name = fields[0]?.replace(/"/g, '') || '';
        const status = fields[5]?.replace(/"/g, '') || 'Active';

        // Skip inactive users
        if (status.toLowerCase() !== 'active') continue;

        users.push({
            name,
            email,
            designation: fields[2]?.replace(/"/g, '') || '',
            phone: fields[3]?.replace(/"/g, '') || '',
            role: fields[4]?.replace(/"/g, '') || 'Staff',
            status,
        });
    }

    return users;
}

async function importUsers(users: User[]) {
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
        try {
            // First, check if user already exists
            const { data: existingUsers } = await supabase.auth.admin.listUsers();
            const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === user.email.toLowerCase());

            let userId: string;

            if (existingUser) {
                console.log(`User already exists: ${user.email}`);
                userId = existingUser.id;
                skipped++;
            } else {
                // Create auth user with a temporary secure password
                // Users will need to reset password to log in
                const tempPassword = `Temp${Math.random().toString(36).slice(2)}!${Date.now()}`;

                const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                    email: user.email,
                    password: tempPassword,
                    email_confirm: true, // Auto-confirm email
                    user_metadata: {
                        full_name: user.name,
                        role: mapRole(user.role),
                    }
                });

                if (authError) {
                    console.error(`Failed to create auth user ${user.email}:`, authError.message);
                    errors++;
                    continue;
                }

                userId = authData.user.id;
                console.log(`Created auth user: ${user.email} (${userId})`);
                created++;
            }

            // Now create/update the profile
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    email: user.email,
                    full_name: user.name,
                    phone: user.phone || null,
                    role: mapRole(user.role),
                }, {
                    onConflict: 'id',
                });

            if (profileError) {
                console.error(`Failed to create profile for ${user.email}:`, profileError.message);
            }

        } catch (e) {
            console.error(`Error processing ${user.email}:`, e);
            errors++;
        }
    }

    console.log(`\n=== Import Complete ===`);
    console.log(`Created: ${created}`);
    console.log(`Skipped (existing): ${skipped}`);
    console.log(`Errors: ${errors}`);
}

// Main
const csvPath = '/home/clickbit/Export Files/users_2026-01-16_21-22-34.csv';
const content = fs.readFileSync(csvPath, 'utf-8');
const users = parseCSV(content);

console.log(`Parsed ${users.length} unique users from CSV`);
console.log(`\nRoles found:`);
const roleCounts = new Map<string, number>();
for (const u of users) {
    roleCounts.set(u.role, (roleCounts.get(u.role) || 0) + 1);
}
for (const [role, count] of roleCounts) {
    console.log(`  ${role}: ${count}`);
}

console.log('\nStarting import...\n');
importUsers(users).catch(console.error);
