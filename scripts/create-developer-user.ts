// Script to create a developer user with specific credentials
import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables:');
    console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    }
});

async function createDeveloperUser() {
    const email = 'muhit@clickbit.com.au';
    const password = 'host538@localau';
    const fullName = 'Muhit';
    const role = 'developer';

    try {
        console.log(`Creating developer user: ${email}...`);

        // Check if user already exists
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (existingUser) {
            console.log(`User already exists: ${email}`);
            console.log(`User ID: ${existingUser.id}`);
            
            // Update the user's password
            console.log('Updating password...');
            const { error: updateError } = await supabase.auth.admin.updateUserById(
                existingUser.id,
                { password }
            );

            if (updateError) {
                console.error('Error updating password:', updateError.message);
                process.exit(1);
            }

            // Update profile to ensure role is correct
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName,
                    role: role,
                })
                .eq('id', existingUser.id);

            if (profileError) {
                console.error('Error updating profile:', profileError.message);
            } else {
                console.log('Profile updated successfully');
            }

            console.log('✓ Password updated successfully');
            console.log(`\nUser Details:`);
            console.log(`  Email: ${email}`);
            console.log(`  Password: ${password}`);
            console.log(`  Role: ${role}`);
            console.log(`  User ID: ${existingUser.id}`);
            return;
        }

        // Create new user with password
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
                full_name: fullName,
                role: role,
            }
        });

        if (authError) {
            console.error(`Failed to create auth user:`, authError.message);
            process.exit(1);
        }

        if (!authData?.user) {
            console.error('User creation failed: No user data returned');
            process.exit(1);
        }

        const userId = authData.user.id;
        console.log(`✓ Created auth user: ${email} (${userId})`);

        // Update the profile (trigger should have created it, but ensure role is correct)
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                email,
                full_name: fullName,
                role: role,
            }, {
                onConflict: 'id',
            });

        if (profileError) {
            console.error('Error updating profile:', profileError.message);
            // Don't fail - user was created, profile update is secondary
        } else {
            console.log('✓ Profile created/updated successfully');
        }

        console.log('\n✓ User created successfully!');
        console.log(`\nUser Details:`);
        console.log(`  Email: ${email}`);
        console.log(`  Password: ${password}`);
        console.log(`  Role: ${role}`);
        console.log(`  User ID: ${userId}`);
        console.log(`\nYou can now log in with these credentials.`);

    } catch (error) {
        console.error('Error creating user:', error);
        process.exit(1);
    }
}

// Run the script
createDeveloperUser().catch(console.error);
