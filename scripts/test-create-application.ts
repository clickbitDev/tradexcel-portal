/**
 * Test script to create a new application with mock data
 * 
 * This script tests the application creation form by inserting
 * a test application directly into the database.
 * 
 * Usage: npx tsx scripts/test-create-application.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing Supabase environment variables');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON_KEY)');
    process.exit(1);
}

// TypeScript type narrowing: after the check above, we know these are strings
const supabaseUrlString = supabaseUrl as string;
const supabaseServiceKeyString = supabaseServiceKey as string;

const supabase = createClient(supabaseUrlString, supabaseServiceKeyString, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Mock data matching the form structure
const mockApplicationData = {
    // Required fields
    student_first_name: 'John',
    student_last_name: 'Smith',
    offering_id: '', // Will be fetched
    partner_id: null, // Optional for testing
    
    // Optional student info
    student_email: 'john.smith@example.com',
    student_phone: '+61 400 123 456',
    student_dob: '1995-05-15',
    student_usi: '1234567890',
    student_passport_number: 'N1234567',
    student_visa_number: '1234567890123',
    student_visa_expiry: '2026-12-31',
    student_gender: 'male',
    student_country_of_birth: 'Australia',
    application_from: 'Australia',
    
    // Address fields
    student_street_no: '123 Main Street',
    student_suburb: 'Sydney',
    student_state: 'NSW',
    student_postcode: '2000',
    
    // Workflow
    workflow_stage: 'draft',
    
    // Notes
    notes: 'Test application created by automated test script',
    
    // Received info
    received_by: null, // Will try to get current user
    received_at: new Date().toISOString(),
};

async function getTestOffering() {
    console.log('📋 Fetching available RTO offerings...\n');
    
    const { data: offerings, error } = await supabase
        .from('rto_offerings')
        .select('id, rto:rtos(name, code), qualification:qualifications(name, code)')
        .eq('is_active', true)
        .limit(1)
        .single();
    
    if (error || !offerings) {
        console.error('❌ Error fetching offerings:', error?.message);
        console.error('💡 Make sure you have at least one active RTO offering in the database');
        return null;
    }
    
    // Handle rto as array or object (Supabase relationships can return either)
    const rto = Array.isArray(offerings.rto) ? offerings.rto[0] : offerings.rto;
    const qualification = Array.isArray(offerings.qualification) ? offerings.qualification[0] : offerings.qualification;
    
    console.log(`✅ Found offering: ${qualification?.name} at ${rto?.name}`);
    return offerings.id;
}

async function getTestPartner() {
    console.log('📋 Fetching available partners...\n');
    
    const { data: partners, error } = await supabase
        .from('partners')
        .select('id, company_name')
        .eq('status', 'active')
        .eq('type', 'agent')
        .limit(1)
        .single();
    
    if (error || !partners) {
        console.log('⚠️  No active agent partners found, will create application without partner');
        return null;
    }
    
    console.log(`✅ Found partner: ${partners.company_name}`);
    return partners.id;
}

async function getCurrentUser() {
    // Try to get a staff user for received_by
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['admin', 'manager', 'staff'])
        .limit(1)
        .single();
    
    if (error || !profiles) {
        console.log('⚠️  No staff user found, will create application without received_by');
        return null;
    }
    
    return profiles.id;
}

async function getOfferingDetails(offeringId: string) {
    const { data: offering, error } = await supabase
        .from('rto_offerings')
        .select('tuition_fee_onshore, material_fee')
        .eq('id', offeringId)
        .single();
    
    if (error || !offering) {
        return { tuition: null, materials: null };
    }
    
    return {
        tuition: offering.tuition_fee_onshore,
        materials: offering.material_fee,
    };
}

async function testCreateApplication() {
    console.log('='.repeat(70));
    console.log('Test: Create New Application with Mock Data');
    console.log('='.repeat(70));
    console.log();
    
    try {
        // Get required data
        const offeringId = await getTestOffering();
        if (!offeringId) {
            console.error('❌ Cannot proceed without an offering');
            process.exit(1);
        }
        
        const partnerId = await getTestPartner();
        const receivedBy = await getCurrentUser();
        const offeringDetails = await getOfferingDetails(offeringId);
        
        // Prepare insert data (matching the form structure)
        const insertData: any = {
            student_first_name: mockApplicationData.student_first_name,
            student_last_name: mockApplicationData.student_last_name,
            student_email: mockApplicationData.student_email,
            student_phone: mockApplicationData.student_phone,
            student_dob: mockApplicationData.student_dob,
            student_usi: mockApplicationData.student_usi,
            student_passport_number: mockApplicationData.student_passport_number,
            student_visa_number: mockApplicationData.student_visa_number,
            student_visa_expiry: mockApplicationData.student_visa_expiry,
            student_gender: mockApplicationData.student_gender,
            student_country_of_birth: mockApplicationData.student_country_of_birth,
            application_from: mockApplicationData.application_from,
            student_street_no: mockApplicationData.student_street_no,
            student_suburb: mockApplicationData.student_suburb,
            student_state: mockApplicationData.student_state,
            student_postcode: mockApplicationData.student_postcode,
            offering_id: offeringId,
            partner_id: partnerId,
            quoted_tuition: offeringDetails.tuition,
            quoted_materials: offeringDetails.materials,
            workflow_stage: mockApplicationData.workflow_stage,
            notes: mockApplicationData.notes,
            received_by: receivedBy,
            received_at: mockApplicationData.received_at,
        };
        
        console.log('🔄 Creating application with data:');
        console.log(JSON.stringify(insertData, null, 2));
        console.log();
        
        // Insert the application
        const { data: insertedApp, error: insertError } = await supabase
            .from('applications')
            .insert([insertData])
            .select('id, student_uid, student_first_name, student_last_name, workflow_stage, payment_status')
            .single();
        
        if (insertError) {
            console.error('❌ Error creating application:');
            console.error('Code:', insertError.code);
            console.error('Message:', insertError.message);
            console.error('Details:', insertError.details);
            console.error('Hint:', insertError.hint);
            console.error('\nFull error:', JSON.stringify(insertError, null, 2));
            process.exit(1);
        }
        
        if (!insertedApp) {
            console.error('❌ Application was not created - no data returned');
            process.exit(1);
        }
        
        console.log('='.repeat(70));
        console.log('✅ Application created successfully!');
        console.log('='.repeat(70));
        console.log();
        console.log('Application Details:');
        console.log('  ID:', insertedApp.id);
        console.log('  Student UID:', insertedApp.student_uid);
        console.log('  Name:', `${insertedApp.student_first_name} ${insertedApp.student_last_name}`);
        console.log('  Workflow Stage:', insertedApp.workflow_stage);
        console.log('  Payment Status:', insertedApp.payment_status);
        console.log();
        console.log('📋 You can view this application in the portal at:');
        console.log(`   http://localhost:3000/portal/applications/${insertedApp.id}`);
        console.log();
        console.log('='.repeat(70));
        
    } catch (error: any) {
        console.error('❌ Unexpected error:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the test
testCreateApplication();
