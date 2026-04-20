import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { insertApplicationHistory } from '@/lib/workflow/history';
import { executeWorkflowTransition } from '@/lib/workflow/transition-service';
import { getUserFriendlyWorkflowError } from '@/lib/workflow/error-messages';
import { ACTIVE_RECORD_FILTER } from '@/lib/soft-delete';
import { formatAppointmentDateTime } from '@/lib/date-utils';
import type { AssessmentReportVenue, AssessmentReportVirtualPlatform } from '@/types/database';

const SetAppointmentDateSchema = z.object({
    action: z.literal('set_appointment_date'),
    appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    appointmentTime: z.string().regex(/^\d{2}:\d{2}$/),
    expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
});

const StartEvaluationSchema = z.object({
    action: z.literal('start_evaluation'),
    expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
});

const SetAssessmentResultSchema = z.object({
    action: z.literal('set_assessment_result'),
    result: z.enum(['pass', 'failed']),
    notes: z.string().trim().max(1000).optional(),
    expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
});

const SaveAssessmentReportSchema = z.object({
    action: z.literal('save_assessment_report'),
    evaluationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    venue: z.enum(['on_campus', 'virtual']),
    virtualPlatform: z.enum(['google_meet', 'zoom']).nullable().optional(),
    meetingRecordDocumentId: z.string().uuid().nullable().optional(),
    outcome: z.string().trim().min(1).max(4000),
    overview: z.string().trim().min(1).max(4000),
    recommendation: z.string().trim().min(1).max(4000),
    expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
});

const AssessorTaskSchema = z.discriminatedUnion('action', [
    SetAppointmentDateSchema,
    StartEvaluationSchema,
    SaveAssessmentReportSchema,
    SetAssessmentResultSchema,
]);

const INTAKE_EDITABLE_STAGES: AssessorApplicationRow['workflow_stage'][] = ['enrolled', 'evaluate', 'accounts', 'dispatch', 'completed'];

interface AssessorApplicationRow {
    id: string;
    workflow_stage: 'TRANSFERRED' | 'docs_review' | 'enrolled' | 'evaluate' | 'accounts' | 'dispatch' | 'completed';
    updated_at: string;
    appointment_date: string | null;
    appointment_time: string | null;
    assessment_result: 'pending' | 'pass' | 'failed';
    assessment_result_at: string | null;
    assigned_assessor_id: string | null;
    assigned_admin_id: string | null;
    evaluation_started_at: string | null;
    assessment_report_date?: string | null;
    assessment_report_start_time?: string | null;
    assessment_report_end_time?: string | null;
    assessment_report_venue?: AssessmentReportVenue | null;
    assessment_report_virtual_platform?: AssessmentReportVirtualPlatform | null;
    assessment_report_meeting_record_document_id?: string | null;
    assessment_report_outcome?: string | null;
    assessment_report_overview?: string | null;
    assessment_report_recommendation?: string | null;
    assessment_report_completed_at?: string | null;
    student_uid: string;
    student_first_name: string | null;
    student_last_name: string | null;
}

const BASE_APPLICATION_SELECT = [
    'id',
    'workflow_stage',
    'updated_at',
    'appointment_date',
    'appointment_time',
    'assessment_result',
    'assessment_result_at',
    'assigned_assessor_id',
    'assigned_admin_id',
    'evaluation_started_at',
    'student_uid',
    'student_first_name',
    'student_last_name',
].join(', ');

const ASSESSMENT_REPORT_FIELDS = [
    'assessment_report_date',
    'assessment_report_start_time',
    'assessment_report_end_time',
    'assessment_report_venue',
    'assessment_report_virtual_platform',
    'assessment_report_meeting_record_document_id',
    'assessment_report_outcome',
    'assessment_report_overview',
    'assessment_report_recommendation',
    'assessment_report_completed_at',
].join(', ');

const FULL_APPLICATION_SELECT = `${BASE_APPLICATION_SELECT}, ${ASSESSMENT_REPORT_FIELDS}`;

function getApplicationSelectForAction(action: z.infer<typeof AssessorTaskSchema>['action']) {
    switch (action) {
        case 'set_appointment_date':
        case 'start_evaluation':
            return BASE_APPLICATION_SELECT;
        case 'save_assessment_report':
        case 'set_assessment_result':
            return FULL_APPLICATION_SELECT;
        default:
            return FULL_APPLICATION_SELECT;
    }
}

function getApplicationLookupErrorMessage(error: { code?: string; message?: string } | null) {
    if (!error) {
        return 'Unable to load application data for the assessor workflow.';
    }

    if (error.code === '42703') {
        return 'Required database migrations are missing for the assessor workflow. Apply the latest database migrations and try again.';
    }

    return error.message || 'Unable to load application data for the assessor workflow.';
}

function isAssessmentReportComplete(application: AssessorApplicationRow): boolean {
    if (
        !application.assessment_report_date
        || !application.assessment_report_start_time
        || !application.assessment_report_end_time
        || !application.assessment_report_venue
        || !application.assessment_report_outcome?.trim()
        || !application.assessment_report_overview?.trim()
        || !application.assessment_report_recommendation?.trim()
        || !application.assessment_report_completed_at
    ) {
        return false;
    }

    if (application.assessment_report_venue === 'virtual') {
        return Boolean(
            application.assessment_report_virtual_platform
            && application.assessment_report_meeting_record_document_id
        );
    }

    return true;
}

function buildStudentName(application: AssessorApplicationRow): string {
    return `${application.student_first_name || ''} ${application.student_last_name || ''}`.trim() || 'Student';
}

async function notifyAssignedAdmin(input: {
    requestSupabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createServerClient>>;
    application: AssessorApplicationRow;
    actorId: string;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
}) {
    if (!input.application.assigned_admin_id || input.application.assigned_admin_id === input.actorId) {
        return;
    }

    const notifyResult = await input.requestSupabase
        .from('notifications')
        .insert({
            user_id: input.application.assigned_admin_id,
            type: 'application_update',
            title: input.title,
            message: input.message,
            related_table: 'applications',
            related_id: input.application.id,
            priority: 'normal',
            metadata: {
                source: 'api.applications.assessor-tasks',
                ...input.metadata,
            },
        });

    if (notifyResult.error) {
        console.warn('Assessor task notification insert failed:', notifyResult.error.message);
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'view',
        applicationId: id,
        allowedRoles: ['assessor'],
    });

    if (!authz.ok) {
        return authz.response;
    }

    const parsedBody = AssessorTaskSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: 'Invalid assessor task payload',
                details: parsedBody.error.issues,
            },
            { status: 400 }
        );
    }

    const payload = parsedBody.data;

    const applicationSelect = getApplicationSelectForAction(payload.action);
    const { data: application, error: applicationError } = await authz.context.supabase
        .from('applications')
        .select(applicationSelect)
        .eq('id', id)
        .maybeSingle<AssessorApplicationRow>();

    if (applicationError) {
        console.error('Assessor task application lookup failed:', applicationError);
        return NextResponse.json(
            { error: getApplicationLookupErrorMessage(applicationError) },
            { status: 500 }
        );
    }

    if (!application) {
        return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    }

    if (application.assigned_assessor_id !== authz.context.userId) {
        return NextResponse.json(
            {
                error: 'Only the assigned assessor can update this application.',
            },
            { status: 403 }
        );
    }

    const studentName = buildStudentName(application);

    if (payload.action === 'set_appointment_date') {
        if (!INTAKE_EDITABLE_STAGES.includes(application.workflow_stage)) {
            return NextResponse.json(
                {
                    error: 'Appointment date can only be edited once the application has reached Enrolled.',
                },
                { status: 409 }
            );
        }

        const updateQuery = authz.context.supabase
            .from('applications')
            .update({
                appointment_date: payload.appointmentDate,
                appointment_time: payload.appointmentTime,
                last_updated_by: authz.context.userId,
            })
            .eq('id', id);

        const guardedUpdateQuery = payload.expectedUpdatedAt
            ? updateQuery.eq('updated_at', payload.expectedUpdatedAt)
            : updateQuery;

        const { data: updatedApplication, error: updateError } = await guardedUpdateQuery
            .select(BASE_APPLICATION_SELECT)
            .maybeSingle<AssessorApplicationRow>();

        if (updateError || !updatedApplication) {
            return NextResponse.json(
                {
                    error: 'Application has changed since you loaded it. Refresh and try again.',
                },
                { status: 409 }
            );
        }

        await insertApplicationHistory(authz.context.supabase, {
            applicationId: id,
            action: 'updated',
            fieldChanged: 'appointment_date',
            oldValue: formatAppointmentDateTime(application.appointment_date, application.appointment_time),
            newValue: formatAppointmentDateTime(payload.appointmentDate, payload.appointmentTime),
            userId: authz.context.userId,
            metadata: {
                source: 'api.applications.assessor-tasks',
                task: 'set_appointment_date',
                appointment_time: payload.appointmentTime,
            },
            toStage: updatedApplication.workflow_stage,
            notes: 'Assessor assigned appointment date',
        });

        await notifyAssignedAdmin({
            requestSupabase: authz.context.supabase,
            application: updatedApplication,
            actorId: authz.context.userId,
            title: 'Appointment date assigned',
            message: `${studentName} appointment date was set to ${formatAppointmentDateTime(payload.appointmentDate, payload.appointmentTime)}.`,
            metadata: {
                action: 'set_appointment_date',
                appointment_date: payload.appointmentDate,
                appointment_time: payload.appointmentTime,
            },
        });

        return NextResponse.json({
            data: {
                action: payload.action,
                application: updatedApplication,
            },
        });
    }

    if (payload.action === 'start_evaluation') {
        if (!application.appointment_date || !application.appointment_time) {
            return NextResponse.json(
                {
                    error: 'Set the appointment date and time before moving this application to Evaluate.',
                },
                { status: 409 }
            );
        }

        const transitionResult = await executeWorkflowTransition({
            supabase: authz.context.supabase,
            actorId: authz.context.userId,
            actorRole: authz.context.role,
            applicationId: id,
            toStage: 'evaluate',
            expectedUpdatedAt: payload.expectedUpdatedAt,
            notes: 'Assessor moved the application to Evaluate.',
        });

        if (!transitionResult.ok) {
            return NextResponse.json(
                {
                    error: getUserFriendlyWorkflowError({
                        code: transitionResult.code,
                        message: transitionResult.message,
                        fallback: 'Unable to move this application to Evaluate right now. Please try again.',
                    }),
                    code: transitionResult.code,
                    currentUpdatedAt: transitionResult.currentUpdatedAt,
                },
                { status: transitionResult.status }
            );
        }

        const evaluationStartedAt = new Date().toISOString();
        const { data: updatedApplication, error: updateError } = await authz.context.supabase
            .from('applications')
            .update({
                evaluation_started_at: application.evaluation_started_at || evaluationStartedAt,
                evaluation_started_by: authz.context.userId,
                last_updated_by: authz.context.userId,
            })
            .eq('id', id)
            .select(BASE_APPLICATION_SELECT)
            .single<AssessorApplicationRow>();

        if (updateError || !updatedApplication) {
            return NextResponse.json(
                {
                    error: 'Application moved to Evaluate, but evaluation metadata could not be saved.',
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            data: {
                action: payload.action,
                transition: transitionResult.data,
                application: updatedApplication,
            },
        });
    }

    if (payload.action === 'save_assessment_report') {
        if (application.workflow_stage !== 'evaluate') {
            return NextResponse.json(
                {
                    error: 'Assessment reports can only be completed while the application is in Evaluate stage.',
                },
                { status: 409 }
            );
        }

        if (payload.endTime <= payload.startTime) {
            return NextResponse.json(
                {
                    error: 'End time must be later than start time.',
                },
                { status: 400 }
            );
        }

        const { count: reportFileCount, error: reportFileError } = await authz.context.supabase
            .from('documents')
            .select('id', { count: 'exact', head: true })
            .eq('application_id', id)
            .in('document_type', ['Student Assessment Report', 'Evaluation File'])
            .or(ACTIVE_RECORD_FILTER);

        if (reportFileError) {
            return NextResponse.json(
                { error: 'Unable to verify the uploaded student assessment report right now. Please try again.' },
                { status: 500 }
            );
        }

        if (!reportFileCount) {
            return NextResponse.json(
                { error: 'Upload the student assessment report before completing the assessment report form.' },
                { status: 409 }
            );
        }

        if (payload.venue === 'virtual') {
            if (!payload.virtualPlatform) {
                return NextResponse.json({ error: 'Select the virtual platform.' }, { status: 400 });
            }

            if (!payload.meetingRecordDocumentId) {
                return NextResponse.json({ error: 'Upload the meeting record before saving a virtual assessment report.' }, { status: 409 });
            }

            const { data: meetingRecord, error: meetingRecordError } = await authz.context.supabase
                .from('documents')
                .select('id')
                .eq('id', payload.meetingRecordDocumentId)
                .eq('application_id', id)
                .eq('document_type', 'Assessment Meeting Record')
                .or(ACTIVE_RECORD_FILTER)
                .maybeSingle<{ id: string }>();

            if (meetingRecordError) {
                return NextResponse.json(
                    { error: 'Unable to verify the uploaded meeting record right now. Please try again.' },
                    { status: 500 }
                );
            }

            if (!meetingRecord) {
                return NextResponse.json(
                    { error: 'The uploaded meeting record could not be found for this application.' },
                    { status: 409 }
                );
            }
        }

        const updateQuery = authz.context.supabase
            .from('applications')
            .update({
                assessment_report_date: payload.evaluationDate,
                assessment_report_start_time: payload.startTime,
                assessment_report_end_time: payload.endTime,
                assessment_report_venue: payload.venue,
                assessment_report_virtual_platform: payload.venue === 'virtual' ? payload.virtualPlatform : null,
                assessment_report_meeting_record_document_id: payload.venue === 'virtual' ? payload.meetingRecordDocumentId : null,
                assessment_report_outcome: payload.outcome,
                assessment_report_overview: payload.overview,
                assessment_report_recommendation: payload.recommendation,
                assessment_report_completed_at: new Date().toISOString(),
                assessment_report_completed_by: authz.context.userId,
                last_updated_by: authz.context.userId,
            })
            .eq('id', id);

        const guardedUpdateQuery = payload.expectedUpdatedAt
            ? updateQuery.eq('updated_at', payload.expectedUpdatedAt)
            : updateQuery;

        const { data: updatedApplication, error: updateError } = await guardedUpdateQuery
            .select(FULL_APPLICATION_SELECT)
            .maybeSingle<AssessorApplicationRow>();

        if (updateError || !updatedApplication) {
            return NextResponse.json(
                { error: 'Application has changed since you loaded it. Refresh and try again.' },
                { status: 409 }
            );
        }

        await insertApplicationHistory(authz.context.supabase, {
            applicationId: id,
            action: 'updated',
            fieldChanged: 'assessment_report',
            oldValue: application.assessment_report_completed_at ? 'completed' : 'pending',
            newValue: 'completed',
            userId: authz.context.userId,
            metadata: {
                source: 'api.applications.assessor-tasks',
                task: 'save_assessment_report',
                venue: payload.venue,
                virtual_platform: payload.virtualPlatform || null,
                meeting_record_document_id: payload.meetingRecordDocumentId || null,
            },
            toStage: updatedApplication.workflow_stage,
            notes: 'Assessor completed the assessment report.',
        });

        await notifyAssignedAdmin({
            requestSupabase: authz.context.supabase,
            application: updatedApplication,
            actorId: authz.context.userId,
            title: 'Assessment report completed',
            message: `${studentName} assessment report has been completed by the assigned assessor.`,
            metadata: {
                action: 'save_assessment_report',
                venue: payload.venue,
                virtual_platform: payload.virtualPlatform || null,
            },
        });

        return NextResponse.json({
            data: {
                action: payload.action,
                application: updatedApplication,
            },
        });
    }

    if (application.workflow_stage !== 'evaluate') {
        return NextResponse.json(
            {
                error: 'Assessment result can only be recorded while the application is in Evaluate stage.',
            },
            { status: 409 }
        );
    }

    const { count: evaluationFileCount, error: evaluationFileError } = await authz.context.supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('application_id', id)
        .in('document_type', ['Student Assessment Report', 'Evaluation File'])
        .or(ACTIVE_RECORD_FILTER);

    if (evaluationFileError) {
        return NextResponse.json(
            {
                error: 'Unable to verify the uploaded evaluation files right now. Please try again.',
            },
            { status: 500 }
        );
    }

    if (!evaluationFileCount) {
        return NextResponse.json(
            {
                error: 'Upload the student assessment report before recording the assessment result.',
            },
            { status: 409 }
        );
    }

    if (!isAssessmentReportComplete(application)) {
        return NextResponse.json(
            {
                error: 'Complete the assessment report before recording the assessment result.',
            },
            { status: 409 }
        );
    }

    const updateQuery = authz.context.supabase
        .from('applications')
        .update({
            assessment_result: payload.result,
            assessment_result_at: new Date().toISOString(),
            assessment_result_by: authz.context.userId,
            last_updated_by: authz.context.userId,
        })
        .eq('id', id);

    const guardedUpdateQuery = payload.expectedUpdatedAt
        ? updateQuery.eq('updated_at', payload.expectedUpdatedAt)
        : updateQuery;

    const { data: updatedApplication, error: updateError } = await guardedUpdateQuery
        .select(FULL_APPLICATION_SELECT)
        .maybeSingle<AssessorApplicationRow>();

    if (updateError || !updatedApplication) {
        return NextResponse.json(
            {
                error: 'Application has changed since you loaded it. Refresh and try again.',
            },
            { status: 409 }
        );
    }

    await insertApplicationHistory(authz.context.supabase, {
        applicationId: id,
        action: 'updated',
        fieldChanged: 'assessment_result',
        oldValue: application.assessment_result,
        newValue: payload.result,
        userId: authz.context.userId,
        metadata: {
            source: 'api.applications.assessor-tasks',
            task: 'set_assessment_result',
            notes: payload.notes || null,
        },
        toStage: updatedApplication.workflow_stage,
        notes: payload.notes || `Assessor marked application as ${payload.result}.`,
    });

    await notifyAssignedAdmin({
        requestSupabase: authz.context.supabase,
        application: updatedApplication,
        actorId: authz.context.userId,
        title: 'Assessment result updated',
        message: `${studentName} was marked as ${payload.result}.`,
        metadata: {
            action: 'set_assessment_result',
            assessment_result: payload.result,
            notes: payload.notes || null,
        },
    });

    return NextResponse.json({
        data: {
            action: payload.action,
            application: updatedApplication,
        },
    });
}
