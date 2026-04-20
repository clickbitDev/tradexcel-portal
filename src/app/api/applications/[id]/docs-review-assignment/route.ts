import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { insertApplicationHistory } from '@/lib/workflow/history';
import { getUserFriendlyWorkflowError } from '@/lib/workflow/error-messages';
import { NON_DELETED_PROFILE_FILTER } from '@/lib/staff/profile-filters';
import type { WorkflowStage } from '@/types/database';

const DocsReviewAssignmentSchema = z.object({
    rtoId: z.string().uuid(),
    assessorId: z.string().uuid(),
    expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
    notes: z.string().trim().max(500).optional(),
});

type RtoSummaryRow = {
    id: string;
    name: string;
    code: string | null;
    status?: string | null;
};

type OfferingSummaryRow = {
    id: string;
    qualification_id: string;
    rto_id: string;
    is_active: boolean;
    tuition_fee_onshore: number | null;
    material_fee: number | null;
    updated_at: string;
    rto?: RtoSummaryRow | RtoSummaryRow[] | null;
};

type ApplicationLookupRow = {
    id: string;
    workflow_stage: WorkflowStage;
    qualification_id: string | null;
    offering_id: string | null;
    updated_at: string;
    assigned_assessor_id: string | null;
    offering?: {
        id: string;
        qualification_id: string;
        rto?: RtoSummaryRow | RtoSummaryRow[] | null;
    } | {
        id: string;
        qualification_id: string;
        rto?: RtoSummaryRow | RtoSummaryRow[] | null;
    }[] | null;
};

type AssessorRow = {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
};

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
    if (!value) {
        return null;
    }

    return Array.isArray(value) ? value[0] ?? null : value;
}

function selectPreferredOffering(
    offerings: OfferingSummaryRow[],
    currentOfferingId: string | null
): OfferingSummaryRow | null {
    if (offerings.length === 0) {
        return null;
    }

    const currentOffering = currentOfferingId
        ? offerings.find((offering) => offering.id === currentOfferingId) || null
        : null;

    const activeOffering = offerings.find((offering) => offering.is_active) || null;
    return activeOffering || currentOffering || offerings[0] || null;
}

function mapOfferingOptions(
    offerings: OfferingSummaryRow[],
    currentOfferingId: string | null
) {
    const byRto = new Map<string, OfferingSummaryRow[]>();

    offerings.forEach((offering) => {
        const rto = normalizeOne(offering.rto);
        if (!rto?.id || rto.status === 'inactive') {
            return;
        }

        const rows = byRto.get(rto.id) || [];
        rows.push(offering);
        byRto.set(rto.id, rows);
    });

    return Array.from(byRto.entries())
        .map(([rtoId, rtoOfferings]) => {
            const preferredOffering = selectPreferredOffering(rtoOfferings, currentOfferingId);
            const rto = normalizeOne(preferredOffering?.rto);

            if (!preferredOffering || !rto) {
                return null;
            }

            return {
                rtoId,
                name: rto.name,
                code: rto.code,
                offeringId: preferredOffering.id,
                isActiveOffering: preferredOffering.is_active,
            };
        })
        .filter((value): value is {
            rtoId: string;
            name: string;
            code: string | null;
            offeringId: string;
            isActiveOffering: boolean;
        } => Boolean(value))
        .sort((a, b) => a.name.localeCompare(b.name));
}

async function loadAssessors(
    supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createServerClient>>
): Promise<AssessorRow[]> {
    const withStatus = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'assessor')
        .eq('account_status', 'active')
        .or(NON_DELETED_PROFILE_FILTER)
        .order('full_name', { ascending: true });

    if (!withStatus.error) {
        return (withStatus.data || []) as AssessorRow[];
    }

    const fallback = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'assessor')
        .or(NON_DELETED_PROFILE_FILTER)
        .order('full_name', { ascending: true });

    return (fallback.data || []) as AssessorRow[];
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'view',
        applicationId: id,
    });

    if (!authz.ok) {
        return authz.response;
    }

    const { data: application, error: applicationError } = await authz.context.supabase
        .from('applications')
        .select('id, workflow_stage, qualification_id, offering_id, updated_at, assigned_assessor_id, offering:rto_offerings(id, qualification_id, rto:rtos(id, name, code, status))')
        .eq('id', id)
        .single<ApplicationLookupRow>();

    if (applicationError || !application) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const currentOffering = normalizeOne(application.offering);
    const qualificationId = application.qualification_id || currentOffering?.qualification_id || null;

    if (!qualificationId) {
        return NextResponse.json(
            {
                error: 'This application has no qualification assigned yet. Assign a qualification before choosing an RTO.',
            },
            { status: 400 }
        );
    }

    let offeringQuery = authz.context.supabase
        .from('rto_offerings')
        .select('id, qualification_id, rto_id, is_active, tuition_fee_onshore, material_fee, updated_at, rto:rtos(id, name, code, status)')
        .eq('qualification_id', qualificationId);

    if (application.offering_id) {
        offeringQuery = offeringQuery.or(`is_active.eq.true,id.eq.${application.offering_id}`);
    } else {
        offeringQuery = offeringQuery.eq('is_active', true);
    }

    const { data: offeringRows, error: offeringError } = await offeringQuery
        .order('is_active', { ascending: false })
        .order('updated_at', { ascending: false });

    if (offeringError) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'DOCS_REVIEW_ASSIGNMENT_OPTIONS_FAILED',
                    message: offeringError.message,
                    fallback: 'Unable to load RTO options right now. Please refresh and try again.',
                }),
                code: 'DOCS_REVIEW_ASSIGNMENT_OPTIONS_FAILED',
            },
            { status: 500 }
        );
    }

    const offeringOptions = mapOfferingOptions(
        (offeringRows || []) as OfferingSummaryRow[],
        application.offering_id
    );

    const assessors = await loadAssessors(authz.context.supabase);
    const currentRto = normalizeOne(currentOffering?.rto);

    return NextResponse.json({
        data: {
            applicationId: application.id,
            workflowStage: application.workflow_stage,
            updatedAt: application.updated_at,
            qualificationId,
            current: {
                offeringId: application.offering_id,
                rtoId: currentRto?.id || null,
                assessorId: application.assigned_assessor_id,
            },
            rtoOptions: offeringOptions,
            assessorOptions: assessors,
        },
    });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'assign',
        applicationId: id,
    });

    if (!authz.ok) {
        return authz.response;
    }

    if (authz.context.role !== 'executive_manager') {
        return NextResponse.json(
            {
                error: 'Only Executive Managers can assign RTO and assessor for enrolled applications.',
            },
            { status: 403 }
        );
    }

    const parsedBody = DocsReviewAssignmentSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: 'Invalid docs review assignment payload',
                details: parsedBody.error.issues,
            },
            { status: 400 }
        );
    }

    const { rtoId, assessorId, expectedUpdatedAt, notes } = parsedBody.data;

    const { data: application, error: applicationError } = await authz.context.supabase
        .from('applications')
        .select('id, workflow_stage, qualification_id, offering_id, updated_at, assigned_assessor_id, offering:rto_offerings(id, qualification_id, rto:rtos(id, name, code, status))')
        .eq('id', id)
        .single<ApplicationLookupRow>();

    if (applicationError || !application) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    if (application.workflow_stage !== 'enrolled') {
        return NextResponse.json(
            {
                error: 'RTO and assessor can only be assigned while the application is in Enrolled stage.',
            },
            { status: 409 }
        );
    }

    if (expectedUpdatedAt && expectedUpdatedAt !== application.updated_at) {
        return NextResponse.json(
            {
                error: 'This application was updated by another user. Refresh and try again.',
                code: 'APPLICATION_CONFLICT',
                currentUpdatedAt: application.updated_at,
            },
            { status: 409 }
        );
    }

    const currentOffering = normalizeOne(application.offering);
    const previousRto = normalizeOne(currentOffering?.rto);
    const previousAssessorId = application.assigned_assessor_id;
    const qualificationId = application.qualification_id || currentOffering?.qualification_id || null;

    if (!qualificationId) {
        return NextResponse.json(
            {
                error: 'This application has no qualification assigned yet. Assign a qualification before choosing an RTO.',
            },
            { status: 400 }
        );
    }

    const { data: assessorWithStatus, error: assessorWithStatusError } = await authz.context.supabase
        .from('profiles')
        .select('id, full_name, email, role, account_status, is_deleted')
        .eq('id', assessorId)
        .maybeSingle<{ id: string; full_name: string | null; email: string | null; role: string; account_status: string | null; is_deleted: boolean | null }>();

    const assessorProfile = assessorWithStatusError && assessorWithStatusError.message?.includes('account_status')
        ? await authz.context.supabase
            .from('profiles')
            .select('id, full_name, email, role, is_deleted')
            .eq('id', assessorId)
            .maybeSingle<AssessorRow & { is_deleted?: boolean | null }>()
        : {
            data: assessorWithStatus,
            error: assessorWithStatusError,
        };

    if (assessorProfile.error || !assessorProfile.data || assessorProfile.data.role !== 'assessor') {
        return NextResponse.json(
            {
                error: 'Selected assessor is invalid.',
            },
            { status: 400 }
        );
    }

    if ('account_status' in assessorProfile.data && assessorProfile.data.account_status === 'disabled') {
        return NextResponse.json(
            {
                error: 'Selected assessor is inactive.',
            },
            { status: 400 }
        );
    }

    if ('is_deleted' in assessorProfile.data && assessorProfile.data.is_deleted === true) {
        return NextResponse.json(
            {
                error: 'Selected assessor is deleted.',
            },
            { status: 400 }
        );
    }

    const { data: matchingOfferings, error: matchingOfferingError } = await authz.context.supabase
        .from('rto_offerings')
        .select('id, qualification_id, rto_id, is_active, tuition_fee_onshore, material_fee, updated_at, rto:rtos(id, name, code, status)')
        .eq('qualification_id', qualificationId)
        .eq('rto_id', rtoId)
        .order('is_active', { ascending: false })
        .order('updated_at', { ascending: false });

    if (matchingOfferingError) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'DOCS_REVIEW_ASSIGNMENT_FAILED',
                    message: matchingOfferingError.message,
                    fallback: 'Unable to validate the selected RTO right now. Please try again.',
                }),
                code: 'DOCS_REVIEW_ASSIGNMENT_FAILED',
            },
            { status: 500 }
        );
    }

    const chosenOffering = selectPreferredOffering(
        ((matchingOfferings || []) as OfferingSummaryRow[]).filter((offering) => {
            const rto = normalizeOne(offering.rto);
            if (!rto) {
                return false;
            }

            if (offering.is_active) {
                return true;
            }

            return offering.id === application.offering_id;
        }),
        application.offering_id
    );

    const chosenRto = normalizeOne(chosenOffering?.rto);

    if (!chosenOffering || !chosenRto || chosenRto.status === 'inactive') {
        return NextResponse.json(
            {
                error: 'Selected RTO is not available for this qualification.',
            },
            { status: 400 }
        );
    }

    const now = new Date().toISOString();
    const assignmentStage: WorkflowStage = 'enrolled';

    const { error: deactivateAssignmentsError } = await authz.context.supabase
        .from('workflow_assignments')
        .update({
            is_active: false,
            unassigned_at: now,
        })
        .eq('application_id', id)
        .eq('stage', assignmentStage)
        .eq('is_active', true)
        .neq('assignee_id', assessorId);

    if (deactivateAssignmentsError) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'DOCS_REVIEW_ASSIGNMENT_FAILED',
                    message: deactivateAssignmentsError.message,
                    fallback: 'Unable to update existing enrolled assignments right now. Please try again.',
                }),
                code: 'DOCS_REVIEW_ASSIGNMENT_FAILED',
            },
            { status: 500 }
        );
    }

    const { data: existingAssignment, error: existingAssignmentError } = await authz.context.supabase
        .from('workflow_assignments')
        .select('id')
        .eq('application_id', id)
        .eq('stage', assignmentStage)
        .eq('assignee_id', assessorId)
        .eq('is_active', true)
        .maybeSingle<{ id: string }>();

    if (existingAssignmentError) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'DOCS_REVIEW_ASSIGNMENT_FAILED',
                    message: existingAssignmentError.message,
                    fallback: 'Unable to verify enrolled assignment right now. Please try again.',
                }),
                code: 'DOCS_REVIEW_ASSIGNMENT_FAILED',
            },
            { status: 500 }
        );
    }

    if (!existingAssignment) {
        const { error: assignmentInsertError } = await authz.context.supabase
            .from('workflow_assignments')
            .insert({
                application_id: id,
                stage: assignmentStage,
                assignee_id: assessorId,
                assigned_by: authz.context.userId,
                is_active: true,
                metadata: {
                    notes: notes || null,
                    source: 'api.docs_review_assignment',
                },
            });

        if (assignmentInsertError) {
            return NextResponse.json(
                {
                    error: getUserFriendlyWorkflowError({
                        code: 'DOCS_REVIEW_ASSIGNMENT_FAILED',
                        message: assignmentInsertError.message,
                        fallback: 'Unable to assign the assessor for enrolled stage right now. Please try again.',
                    }),
                    code: 'DOCS_REVIEW_ASSIGNMENT_FAILED',
                },
                { status: 500 }
            );
        }
    }

    const { data: updatedApplication, error: updateApplicationError } = await authz.context.supabase
        .from('applications')
        .update({
            offering_id: chosenOffering.id,
            qualification_id: qualificationId,
            quoted_tuition: chosenOffering.tuition_fee_onshore,
            quoted_materials: chosenOffering.material_fee,
            assigned_assessor_id: assessorId,
            assigned_by: authz.context.userId,
            assigned_at: now,
            last_updated_by: authz.context.userId,
        })
        .eq('id', id)
        .select('id, updated_at, offering_id, assigned_assessor_id, offering:rto_offerings(id, rto:rtos(id, name, code))')
        .single<{
            id: string;
            updated_at: string;
            offering_id: string;
            assigned_assessor_id: string | null;
            offering?: {
                id: string;
                rto?: RtoSummaryRow | RtoSummaryRow[] | null;
            } | {
                id: string;
                rto?: RtoSummaryRow | RtoSummaryRow[] | null;
            }[] | null;
        }>();

    if (updateApplicationError || !updatedApplication) {
        return NextResponse.json(
            {
                error: getUserFriendlyWorkflowError({
                    code: 'DOCS_REVIEW_ASSIGNMENT_FAILED',
                    message: updateApplicationError?.message || 'Failed to update application assignment',
                    fallback: 'Unable to save enrolled assignment right now. Please try again.',
                }),
                code: 'DOCS_REVIEW_ASSIGNMENT_FAILED',
            },
            { status: 500 }
        );
    }

    await insertApplicationHistory(authz.context.supabase, {
        applicationId: id,
        action: 'assigned',
        fieldChanged: 'enrolled_assignment',
        oldValue: `rto:${previousRto?.id || 'none'};assessor:${previousAssessorId || 'none'}`,
        newValue: `rto:${chosenRto.id};assessor:${assessorId}`,
        userId: authz.context.userId,
        metadata: {
            stage: assignmentStage,
            previous: {
                rtoId: previousRto?.id || null,
                assessorId: previousAssessorId,
            },
            next: {
                rtoId: chosenRto.id,
                assessorId,
                offeringId: chosenOffering.id,
            },
            notes: notes || null,
            source: 'api.docs_review_assignment',
        },
        toStage: assignmentStage,
        notes: notes || null,
    });

    if (assessorId !== authz.context.userId && previousAssessorId !== assessorId) {
        const notificationResult = await authz.context.supabase
            .from('notifications')
            .insert({
                user_id: assessorId,
                type: 'assignment',
                title: 'Enrolled assignment updated',
                message: `You were assigned to an enrolled application ${id}.`,
                related_table: 'applications',
                related_id: id,
                priority: 'normal',
                metadata: {
                    stage: assignmentStage,
                    assigned_by: authz.context.userId,
                    rto_id: chosenRto.id,
                },
            });

        if (notificationResult.error) {
            console.warn('Docs review assignment notification failed:', notificationResult.error.message);
        }
    }

    const updatedRto = normalizeOne(normalizeOne(updatedApplication.offering)?.rto) || chosenRto;

    return NextResponse.json({
        data: {
            applicationId: updatedApplication.id,
            workflowStage: assignmentStage,
            updatedAt: updatedApplication.updated_at,
            offeringId: updatedApplication.offering_id,
            rto: {
                id: updatedRto.id,
                name: updatedRto.name,
                code: updatedRto.code,
            },
            assessor: {
                id: assessorProfile.data.id,
                fullName: assessorProfile.data.full_name,
                email: assessorProfile.data.email,
            },
        },
    });
}
