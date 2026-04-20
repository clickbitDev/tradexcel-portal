import { NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { ensureQualificationPriceListForQualification } from '@/lib/applications/qualification-price-list';
import { getResolvedPortalRto } from '@/lib/portal-rto';
import { getSharpFutureConnection } from '@/lib/rto-integration/connection';
import { verifyTransferToken } from '@/lib/rto-integration/security';
import type { ApplicationTransferPayload } from '@/lib/rto-integration/types';
import { insertApplicationHistory } from '@/lib/workflow/history';

type IntakeTransferClaims = {
    rtoId: string;
    sourceApplicationId: string;
    transferredAt: string;
};

type TransferNotificationProfile = {
    id: string;
    role: string;
};

type QualificationMatch = {
    id: string;
    code: string;
};

function normalizeQualificationCode(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed.toUpperCase() : null;
}

async function insertTransferNotifications(input: {
    supabase: ReturnType<typeof createAdminServerClient>;
    applicationId: string;
    message: string;
}) {
    const { data: recipients } = await input.supabase
        .from('profiles')
        .select('id, role')
        .in('role', ['ceo', 'executive_manager'])
        .returns<TransferNotificationProfile[]>();

    if (!recipients || recipients.length === 0) {
        return;
    }

    await input.supabase.from('notifications').insert(
        recipients.map((profile) => ({
            user_id: profile.id,
            type: 'assignment',
            title: 'Transferred application received',
            message: input.message,
            related_table: 'applications',
            related_id: input.applicationId,
            priority: 'high',
            metadata: {
                source: 'sharp_future.transfer',
            },
        }))
    );
}

export async function POST(request: NextRequest) {
    const authorizationHeader = request.headers.get('authorization') || '';
    const bearerToken = authorizationHeader.startsWith('Bearer ')
        ? authorizationHeader.slice('Bearer '.length)
        : null;

    const rawBody = await request.text();
    const payload = JSON.parse(rawBody || '{}') as ApplicationTransferPayload;

    const adminSupabase = createAdminServerClient();
    const connection = await getSharpFutureConnection(adminSupabase as never);
    if (!connection?.transferSecret || !connection.sharp_future_rto_id) {
        return NextResponse.json({ error: 'Sharp Future connection is not configured.' }, { status: 503 });
    }

    const portalRto = await getResolvedPortalRto(adminSupabase as never);
    if (!portalRto.rto?.id) {
        return NextResponse.json(
            { error: 'Portal RTO is not configured. Configure it in Settings > Portal RTO before receiving transfers.' },
            { status: 503 }
        );
    }

    if (!bearerToken) {
        return NextResponse.json({ error: 'Missing transfer token.' }, { status: 401 });
    }

    const claims = verifyTransferToken<IntakeTransferClaims>(connection.transferSecret, bearerToken);
    if (!claims) {
        return NextResponse.json({ error: 'Invalid or expired transfer token.' }, { status: 401 });
    }

    if (claims.rtoId !== connection.sharp_future_rto_id || claims.sourceApplicationId !== payload.sourceApplicationId) {
        return NextResponse.json({ error: 'Transfer token does not match the payload.' }, { status: 401 });
    }

    const { data: existingApplication } = await adminSupabase
        .from('applications')
        .select('id')
        .eq('source_application_id', payload.sourceApplicationId)
        .eq('source_portal', 'sharp_future')
        .maybeSingle<{ id: string }>();

    if (existingApplication) {
        return NextResponse.json({ data: { applicationId: existingApplication.id, duplicate: true } });
    }

    const qualificationCode = normalizeQualificationCode(payload.application.qualificationCode);
    const partnerId = payload.application.partnerId || null;

    const { data: qualificationMatch } = qualificationCode
        ? await adminSupabase
            .from('qualifications')
            .select('id, code')
            .eq('code', qualificationCode)
            .maybeSingle<QualificationMatch>()
        : { data: null };

    let offeringMatch: { id: string } | null = null;
    if (qualificationMatch?.id) {
        try {
            offeringMatch = await ensureQualificationPriceListForQualification(adminSupabase, qualificationMatch.id);
        } catch (error) {
            return NextResponse.json(
                { error: error instanceof Error ? error.message : 'Unable to assign the qualification price list.' },
                { status: 500 }
            );
        }
    }

    const { data: partnerMatch } = partnerId
        ? await adminSupabase
            .from('partners')
            .select('id')
            .eq('id', partnerId)
            .maybeSingle<{ id: string }>()
        : { data: null };

    const insertPayload = {
        student_uid: payload.application.studentUid,
        application_number: payload.application.applicationNumber || payload.application.studentUid,
        qualification_id: qualificationMatch?.id || null,
        offering_id: offeringMatch?.id || null,
        partner_id: partnerMatch?.id || null,
        student_first_name: payload.application.studentFirstName,
        student_last_name: payload.application.studentLastName,
        student_email: payload.application.studentEmail,
        student_phone: payload.application.studentPhone,
        student_dob: payload.application.studentDob,
        student_passport_number: payload.application.studentPassportNumber,
        student_nationality: payload.application.studentNationality,
        student_usi: payload.application.studentUsi,
        student_visa_number: payload.application.studentVisaNumber,
        student_visa_expiry: payload.application.studentVisaExpiry,
        student_gender: payload.application.studentGender,
        student_country_of_birth: payload.application.studentCountryOfBirth,
        application_from: payload.application.applicationFrom,
        student_street_no: payload.application.studentStreetNo,
        student_suburb: payload.application.studentSuburb,
        student_state: payload.application.studentState,
        student_postcode: payload.application.studentPostcode,
        quoted_tuition: payload.application.quotedTuition,
        quoted_materials: payload.application.quotedMaterials,
        notes: payload.application.notes,
        appointment_date: payload.application.intakeDate,
        payment_status: payload.application.paymentStatus || 'unpaid',
        workflow_stage: 'TRANSFERRED',
        source_application_id: payload.sourceApplicationId,
        source_portal: 'sharp_future',
        source_rto_id: connection.sharp_future_rto_id,
        source_qualification_code: qualificationCode,
        transferred_at: payload.transferredAt,
        transfer_event_id: claims.sourceApplicationId,
    };

    const { data: insertedApplication, error: insertError } = await adminSupabase
        .from('applications')
        .insert(insertPayload)
        .select('id, workflow_stage')
        .single<{ id: string; workflow_stage: string }>();

    if (insertError || !insertedApplication) {
        return NextResponse.json({ error: insertError?.message || 'Failed to create transferred application.' }, { status: 500 });
    }

    if (payload.documents.length > 0) {
        const documentRows = payload.documents.map((document) => ({
            application_id: insertedApplication.id,
            document_type: document.documentType,
            file_name: document.fileName,
            file_url: document.fileUrl,
            file_size: document.fileSize,
            mime_type: document.mimeType,
            notes: document.notes,
            storage_provider: document.storageProvider,
            storage_bucket: document.storageBucket,
            storage_key: document.storageKey,
            is_remote: true,
            remote_source_url: document.fileUrl,
            remote_url_expires_at: document.remoteUrlExpiresAt,
            remote_source_document_id: document.sourceDocumentId,
            remote_source_application_id: payload.sourceApplicationId,
            remote_source_portal: 'sharp_future',
        }));

        const documentInsert = await adminSupabase.from('documents').insert(documentRows);
        if (documentInsert.error) {
            return NextResponse.json({ error: documentInsert.error.message }, { status: 500 });
        }
    }

    await insertApplicationHistory(adminSupabase as never, {
        applicationId: insertedApplication.id,
        action: 'created',
        fieldChanged: 'workflow_stage',
        oldValue: null,
        newValue: 'TRANSFERRED',
        userId: null,
        metadata: {
            source: 'sharp_future.transfer',
            sourceApplicationId: payload.sourceApplicationId,
        },
        toStage: 'TRANSFERRED',
        notes: 'Application transferred from Sharp Future',
    });

    await adminSupabase.from('workflow_transition_events').insert({
        application_id: insertedApplication.id,
        from_stage: 'docs_review',
        to_stage: 'TRANSFERRED',
        actor_id: null,
        notes: 'Application transferred from Sharp Future',
        metadata: {
            source: 'sharp_future.transfer',
            sourceApplicationId: payload.sourceApplicationId,
        },
    });

    await insertTransferNotifications({
        supabase: adminSupabase,
        applicationId: insertedApplication.id,
        message: `${payload.application.studentFirstName} ${payload.application.studentLastName} was transferred from Sharp Future.`,
    });

    return NextResponse.json({ data: { applicationId: insertedApplication.id } }, { status: 201 });
}
