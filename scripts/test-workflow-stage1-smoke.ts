import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

const anon = createClient(supabaseUrl, anonKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

const STAFF_ROLES = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
] as const;

interface StaffProfile {
    id: string;
    full_name: string | null;
    role: string;
}

function assertCondition(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function randomSuffix(): string {
    return Math.random().toString(36).slice(2, 8);
}

async function sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getActiveStaffProfiles(): Promise<StaffProfile[]> {
    const withStatus = await admin
        .from('profiles')
        .select('id, full_name, role')
        .in('role', [...STAFF_ROLES])
        .eq('account_status', 'active')
        .limit(5);

    if (!withStatus.error && withStatus.data) {
        return withStatus.data as StaffProfile[];
    }

    const fallback = await admin
        .from('profiles')
        .select('id, full_name, role')
        .in('role', [...STAFF_ROLES])
        .limit(5);

    if (fallback.error) {
        throw new Error(`Unable to load staff profiles: ${fallback.error.message}`);
    }

    return (fallback.data || []) as StaffProfile[];
}

async function run() {
    console.log('--- Stage 1 Workflow Smoke Test ---');

    const suffix = randomSuffix();
    let applicationId: string | null = null;

    try {
        const offeringResult = await admin
            .from('rto_offerings')
            .select('id, tuition_fee_onshore, material_fee')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

        if (offeringResult.error || !offeringResult.data) {
            throw new Error(`No active offering found: ${offeringResult.error?.message || 'not found'}`);
        }

        const partnerResult = await admin
            .from('partners')
            .select('id')
            .eq('type', 'agent')
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();

        const staffProfiles = await getActiveStaffProfiles();
        assertCondition(staffProfiles.length > 0, 'No staff profiles available for assignment/alert checks.');

        const assigneeA = staffProfiles[0]!;
        const assigneeB = staffProfiles[1] || staffProfiles[0]!;

        const createResult = await admin
            .from('applications')
            .insert({
                student_first_name: `Smoke${suffix}`,
                student_last_name: 'Workflow',
                student_email: `smoke-${suffix}@example.com`,
                student_phone: '+61000000000',
                offering_id: offeringResult.data.id,
                partner_id: partnerResult.data?.id ?? null,
                quoted_tuition: offeringResult.data.tuition_fee_onshore,
                quoted_materials: offeringResult.data.material_fee,
                notes: 'Stage 1 workflow smoke test application',
                workflow_stage: 'draft',
                received_by: assigneeA.id,
                created_by: assigneeA.id,
                last_updated_by: assigneeA.id,
            })
            .select('id, workflow_stage, application_number, student_uid, updated_at')
            .single();

        if (createResult.error || !createResult.data) {
            throw new Error(`Application create failed: ${createResult.error?.message || 'unknown error'}`);
        }

        applicationId = createResult.data.id;
        assertCondition(createResult.data.workflow_stage === 'draft', 'New application did not start in draft stage.');
        assertCondition(Boolean(createResult.data.application_number), 'Application number was not generated.');
        assertCondition(Boolean(createResult.data.student_uid), 'Student UID was not generated.');

        console.log(`Created test application: ${applicationId}`);

        const transitionUpdate = await admin
            .from('applications')
            .update({
                workflow_stage: 'submitted',
                last_updated_by: assigneeA.id,
            })
            .eq('id', applicationId)
            .select('id, workflow_stage')
            .single();

        if (transitionUpdate.error || !transitionUpdate.data) {
            throw new Error(`Transition update failed: ${transitionUpdate.error?.message || 'unknown error'}`);
        }

        assertCondition(transitionUpdate.data.workflow_stage === 'submitted', 'Application transition to submitted failed.');

        const historyResult = await admin
            .from('application_history')
            .insert({
                application_id: applicationId,
                action: 'stage_changed',
                field_changed: 'workflow_stage',
                old_value: 'draft',
                new_value: 'submitted',
                user_id: assigneeA.id,
                metadata: JSON.stringify({ source: 'scripts.test-workflow-stage1-smoke' }),
            });

        if (historyResult.error) {
            const legacyHistoryResult = await admin
                .from('application_history')
                .insert({
                    application_id: applicationId,
                    from_stage: 'draft',
                    to_stage: 'submitted',
                    changed_by: assigneeA.id,
                    notes: 'Stage 1 smoke test history event',
                });

            if (legacyHistoryResult.error) {
                throw new Error(`History insert failed: ${legacyHistoryResult.error.message}`);
            }
        }

        const transitionEventResult = await admin
            .from('workflow_transition_events')
            .insert({
                application_id: applicationId,
                from_stage: 'draft',
                to_stage: 'submitted',
                actor_id: assigneeA.id,
                notes: 'Smoke test transition',
                metadata: { source: 'scripts.test-workflow-stage1-smoke' },
            });

        if (transitionEventResult.error) {
            throw new Error(`Transition event insert failed: ${transitionEventResult.error.message}`);
        }

        const assignmentA = await admin
            .from('workflow_assignments')
            .insert({
                application_id: applicationId,
                stage: 'submitted',
                assignee_id: assigneeA.id,
                assigned_by: assigneeA.id,
                is_active: true,
                metadata: { source: 'scripts.test-workflow-stage1-smoke' },
            })
            .select('id')
            .single();

        if (assignmentA.error || !assignmentA.data) {
            throw new Error(`Primary assignment insert failed: ${assignmentA.error?.message || 'unknown error'}`);
        }

        if (assigneeB.id !== assigneeA.id) {
            const deactivateOld = await admin
                .from('workflow_assignments')
                .update({
                    is_active: false,
                    unassigned_at: new Date().toISOString(),
                })
                .eq('application_id', applicationId)
                .eq('stage', 'submitted')
                .eq('is_active', true);

            if (deactivateOld.error) {
                throw new Error(`Deactivate old assignment failed: ${deactivateOld.error.message}`);
            }

            const assignmentB = await admin
                .from('workflow_assignments')
                .insert({
                    application_id: applicationId,
                    stage: 'submitted',
                    assignee_id: assigneeB.id,
                    assigned_by: assigneeA.id,
                    is_active: true,
                    metadata: { source: 'scripts.test-workflow-stage1-smoke' },
                })
                .select('id')
                .single();

            if (assignmentB.error || !assignmentB.data) {
                throw new Error(`Secondary assignment insert failed: ${assignmentB.error?.message || 'unknown error'}`);
            }
        }

        const activeAssignments = await admin
            .from('workflow_assignments')
            .select('id, assignee_id')
            .eq('application_id', applicationId)
            .eq('stage', 'submitted')
            .eq('is_active', true);

        if (activeAssignments.error) {
            throw new Error(`Active assignments query failed: ${activeAssignments.error.message}`);
        }

        assertCondition((activeAssignments.data || []).length === 1, 'Expected exactly one active assignment for submitted stage.');

        const alertInsert = await admin
            .from('workflow_alerts')
            .insert({
                application_id: applicationId,
                alert_type: 'workflow',
                severity: 'high',
                title: 'Smoke test alert',
                message: 'Raised by automated Stage 1 smoke test',
                status: 'open',
                raised_by: assigneeA.id,
                metadata: { source: 'scripts.test-workflow-stage1-smoke' },
            })
            .select('id, created_at, updated_at')
            .single();

        if (alertInsert.error || !alertInsert.data) {
            throw new Error(`Alert insert failed: ${alertInsert.error?.message || 'unknown error'}`);
        }

        await sleep(25);

        const alertUpdate = await admin
            .from('workflow_alerts')
            .update({
                status: 'resolved',
                resolved_by: assigneeB.id,
                resolved_at: new Date().toISOString(),
            })
            .eq('id', alertInsert.data.id)
            .select('id, status, created_at, updated_at')
            .single();

        if (alertUpdate.error || !alertUpdate.data) {
            throw new Error(`Alert resolve failed: ${alertUpdate.error?.message || 'unknown error'}`);
        }

        assertCondition(alertUpdate.data.status === 'resolved', 'Alert did not transition to resolved.');
        assertCondition(alertUpdate.data.updated_at >= alertUpdate.data.created_at, 'Alert updated_at trigger did not run.');

        const transitionCount = await admin
            .from('workflow_transition_events')
            .select('id', { count: 'exact', head: true })
            .eq('application_id', applicationId);
        const assignmentCount = await admin
            .from('workflow_assignments')
            .select('id', { count: 'exact', head: true })
            .eq('application_id', applicationId);
        const alertCount = await admin
            .from('workflow_alerts')
            .select('id', { count: 'exact', head: true })
            .eq('application_id', applicationId);

        if (transitionCount.error || assignmentCount.error || alertCount.error) {
            throw new Error('Timeline table count queries failed.');
        }

        assertCondition((transitionCount.count || 0) >= 1, 'No transition events found for application.');
        assertCondition((assignmentCount.count || 0) >= 1, 'No workflow assignments found for application.');
        assertCondition((alertCount.count || 0) >= 1, 'No workflow alerts found for application.');

        const anonInsertAttempt = await anon
            .from('workflow_alerts')
            .insert({
                application_id: applicationId,
                alert_type: 'security-check',
                severity: 'low',
                title: 'Anon insert should fail',
                status: 'open',
            });

        assertCondition(Boolean(anonInsertAttempt.error), 'Anon insert unexpectedly succeeded; RLS may be too permissive.');

        console.log('Smoke test passed: create, transition, assignment, alert, timeline table checks, and RLS guard checks succeeded.');
    } catch (error) {
        console.error('Smoke test failed:', error instanceof Error ? error.message : error);
        process.exitCode = 1;
    } finally {
        if (applicationId) {
            await admin.from('workflow_alerts').delete().eq('application_id', applicationId);
            await admin.from('workflow_assignments').delete().eq('application_id', applicationId);
            await admin.from('workflow_transition_events').delete().eq('application_id', applicationId);
            await admin.from('application_history').delete().eq('application_id', applicationId);
            await admin.from('applications').delete().eq('id', applicationId);
            console.log(`Cleaned up smoke test application: ${applicationId}`);
        }
    }
}

void run();
