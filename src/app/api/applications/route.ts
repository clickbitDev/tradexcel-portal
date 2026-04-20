import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { ensureQualificationPriceListForQualification } from '@/lib/applications/qualification-price-list';
import { insertApplicationHistory } from '@/lib/workflow/history';
import { createAdminServerClient, createServerClient } from '@/lib/supabase/server';
import { AGENT_PARTNER_TYPES } from '@/lib/partners/constants';
import type { WorkflowStage } from '@/types/database';

const CreateApplicationSchema = z.object({
    student_first_name: z.string().trim().min(1).max(120),
    student_last_name: z.string().trim().min(1).max(120),
    offering_id: z.string().uuid().nullable().optional(),
    qualification_id: z.string().uuid().nullable().optional(),
    partner_id: z.string().uuid().nullable().optional(),
    student_email: z.string().email().nullable().optional(),
    student_phone: z.string().trim().max(50).nullable().optional(),
    student_dob: z.string().trim().max(20).nullable().optional(),
    student_usi: z.string().trim().max(20).nullable().optional(),
    student_passport_number: z.string().trim().max(60).nullable().optional(),
    student_nationality: z.string().trim().max(120).nullable().optional(),
    student_visa_number: z.string().trim().max(60).nullable().optional(),
    student_visa_expiry: z.string().trim().max(20).nullable().optional(),
    student_gender: z.string().trim().max(40).nullable().optional(),
    student_country_of_birth: z.string().trim().max(120).nullable().optional(),
    application_from: z.string().trim().max(120).nullable().optional(),
    student_street_no: z.string().trim().max(255).nullable().optional(),
    student_suburb: z.string().trim().max(120).nullable().optional(),
    student_state: z.string().trim().max(60).nullable().optional(),
    student_postcode: z.string().trim().max(20).nullable().optional(),
    quoted_tuition: z.number().finite().nullable().optional(),
    quoted_materials: z.number().finite().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    appointment_date: z.string().trim().max(20).nullable().optional(),
    appointment_time: z.string().trim().max(8).nullable().optional(),
    intake_date: z.string().trim().max(20).nullable().optional(),
    received_at: z.string().datetime().optional(),
});

type InsertedApplicationRow = {
    id: string;
    student_uid: string;
    application_number: string;
    workflow_stage: WorkflowStage;
    updated_at: string;
};

type AgentPartnerRow = {
    id: string;
    type: string;
    email: string | null;
    company_name: string;
    user_id: string | null;
    created_at: string;
};

type AgentProfileRow = {
    full_name: string | null;
    email: string | null;
};

type ResolveAgentPartnerResult = {
    partnerId: string | null;
    provisioned: boolean;
    error?: string;
    status?: number;
};

function normalizeNullableString(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
}

function buildAgentCompanyName(fullName: string | null, email: string | null, userId: string): string {
    if (fullName && fullName.trim().length > 0) {
        return fullName.trim();
    }

    if (email && email.includes('@')) {
        const localPart = email.split('@')[0]?.trim();
        if (localPart) {
            return localPart;
        }
    }

    return `Agent ${userId.slice(0, 8)}`;
}

async function resolveAgentPartnerId(
    supabase: Awaited<ReturnType<typeof createServerClient>>,
    userId: string
): Promise<ResolveAgentPartnerResult> {
    const { data: ownedPartners, error: ownedPartnersError } = await supabase
        .from('partners')
        .select('id')
        .eq('user_id', userId)
        .in('type', AGENT_PARTNER_TYPES)
        .order('created_at', { ascending: true })
        .limit(1);

    if (ownedPartnersError) {
        console.warn('Failed to check owned agent partner:', ownedPartnersError.message);
    }

    const ownedPartnerId = ownedPartners?.[0]?.id || null;
    if (ownedPartnerId) {
        return {
            partnerId: ownedPartnerId,
            provisioned: false,
        };
    }

    let adminClient: ReturnType<typeof createAdminServerClient>;
    try {
        adminClient = createAdminServerClient();
    } catch {
        return {
            partnerId: null,
            provisioned: false,
            error: 'Failed to resolve your agent partner profile. Please contact support.',
            status: 500,
        };
    }

    const { data: authUserResult } = await supabase.auth.getUser();
    const authEmail = normalizeEmail(authUserResult.user?.email || null);

    const { data: profileResult, error: profileError } = await adminClient
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .maybeSingle<AgentProfileRow>();

    if (profileError) {
        console.warn('Failed to read profile for agent partner resolution:', profileError.message);
    }

    const profileEmail = normalizeEmail(profileResult?.email || null);
    const lookupEmail = authEmail || profileEmail;

    if (lookupEmail) {
        const { data: emailMatches, error: emailMatchError } = await adminClient
            .from('partners')
            .select('id, type, email, company_name, user_id, created_at')
            .ilike('email', lookupEmail)
            .order('created_at', { ascending: true });

        if (emailMatchError) {
            console.warn('Failed to query partners by email during auto-link:', emailMatchError.message);
        }

        const matchedRows = (emailMatches || []) as AgentPartnerRow[];
        const agentLikeMatches = matchedRows.filter((row) => AGENT_PARTNER_TYPES.includes(row.type as (typeof AGENT_PARTNER_TYPES)[number]));

        const matchedByUser = agentLikeMatches.find((row) => row.user_id === userId);
        if (matchedByUser?.id) {
            return {
                partnerId: matchedByUser.id,
                provisioned: false,
            };
        }

        const linkedToAnotherUser = agentLikeMatches.find((row) => row.user_id && row.user_id !== userId);
        if (linkedToAnotherUser) {
            return {
                partnerId: null,
                provisioned: false,
                error: 'Your agent account is linked to another partner profile. Please contact support.',
                status: 403,
            };
        }

        const unlinkedAgentLike = agentLikeMatches.find((row) => !row.user_id);
        if (unlinkedAgentLike) {
            const { error: linkError } = await adminClient
                .from('partners')
                .update({
                    user_id: userId,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', unlinkedAgentLike.id)
                .is('user_id', null);

            if (linkError) {
                return {
                    partnerId: null,
                    provisioned: false,
                    error: 'Failed to link your existing partner profile. Please contact support.',
                    status: 500,
                };
            }

            return {
                partnerId: unlinkedAgentLike.id,
                provisioned: false,
            };
        }

        const nonAgentMatch = matchedRows.find((row) => !AGENT_PARTNER_TYPES.includes(row.type as (typeof AGENT_PARTNER_TYPES)[number]));
        if (nonAgentMatch) {
            return {
                partnerId: null,
                provisioned: false,
                error: 'Your email is already used by a non-agent partner profile. Please contact support.',
                status: 403,
            };
        }
    }

    const companyName = buildAgentCompanyName(profileResult?.full_name || null, lookupEmail, userId);
    const { data: insertedPartner, error: insertPartnerError } = await adminClient
        .from('partners')
        .insert({
            type: 'agent',
            company_name: companyName,
            contact_name: profileResult?.full_name?.trim() || null,
            email: lookupEmail,
            user_id: userId,
            status: 'active',
            priority_level: 'standard',
        })
        .select('id')
        .single<{ id: string }>();

    if (insertPartnerError || !insertedPartner?.id) {
        return {
            partnerId: null,
            provisioned: false,
            error: insertPartnerError?.message || 'Failed to create your agent partner profile. Please contact support.',
            status: 500,
        };
    }

    return {
        partnerId: insertedPartner.id,
        provisioned: true,
    };
}

export async function POST(request: NextRequest) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'create',
    });

    if (!authz.ok) {
        return authz.response;
    }

    const parsedBody = CreateApplicationSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: 'Invalid application payload',
                details: parsedBody.error.issues,
            },
            { status: 400 }
        );
    }

    const body = parsedBody.data;

    let partnerIdForInsert = body.partner_id ?? null;
    let agentPartnerProvisioned = false;

    if (authz.context.role === 'agent') {
        const partnerResolution = await resolveAgentPartnerId(
            authz.context.supabase,
            authz.context.userId
        );

        if (!partnerResolution.partnerId) {
            return NextResponse.json(
                {
                    error: partnerResolution.error || 'Your agent account is not linked to a partner profile. Please contact support.',
                },
                { status: partnerResolution.status || 400 }
            );
        }

        partnerIdForInsert = partnerResolution.partnerId;
        agentPartnerProvisioned = partnerResolution.provisioned;
    }

    const requestedOfferingId = body.offering_id ?? null;
    let resolvedQualificationId = body.qualification_id ?? null;

    if (!requestedOfferingId && !resolvedQualificationId) {
        return NextResponse.json(
            {
                error: 'Either offering_id or qualification_id is required',
            },
            { status: 400 }
        );
    }

    if (requestedOfferingId) {
        const { data: offering, error: offeringError } = await authz.context.supabase
            .from('rto_offerings')
            .select('id, qualification_id')
            .eq('id', requestedOfferingId)
            .maybeSingle<{ id: string; qualification_id: string }>();

        if (offeringError || !offering) {
            return NextResponse.json(
                {
                    error: 'Invalid offering selected',
                },
                { status: 400 }
            );
        }

        if (resolvedQualificationId && resolvedQualificationId !== offering.qualification_id) {
            return NextResponse.json(
                {
                    error: 'Selected offering does not match the provided qualification',
                },
                { status: 400 }
            );
        }

        resolvedQualificationId = offering.qualification_id;
    } else if (resolvedQualificationId) {
        const { data: qualification, error: qualificationError } = await authz.context.supabase
            .from('qualifications')
            .select('id')
            .eq('id', resolvedQualificationId)
            .maybeSingle<{ id: string }>();

        if (qualificationError || !qualification) {
            return NextResponse.json(
                {
                    error: 'Invalid qualification selected',
                },
                { status: 400 }
            );
        }
    }

    if (!resolvedQualificationId) {
        return NextResponse.json(
            {
                error: 'A qualification is required to assign the qualification price list.',
            },
            { status: 400 }
        );
    }

    const adminClient = createAdminServerClient();

    let priceList;
    try {
        priceList = await ensureQualificationPriceListForQualification(adminClient, resolvedQualificationId);
    } catch (error) {
        const message = error instanceof Error
            ? error.message
            : 'Unable to resolve the qualification price list for this application.';
        const status = 500;
        return NextResponse.json({ error: message }, { status });
    }

    const insertPayload = {
        student_first_name: body.student_first_name.trim(),
        student_last_name: body.student_last_name.trim(),
        qualification_id: resolvedQualificationId,
        offering_id: priceList.id,
        partner_id: partnerIdForInsert,
        student_email: normalizeNullableString(body.student_email),
        student_phone: normalizeNullableString(body.student_phone),
        student_dob: normalizeNullableString(body.student_dob),
        student_usi: normalizeNullableString(body.student_usi),
        student_passport_number: normalizeNullableString(body.student_passport_number),
        student_nationality: normalizeNullableString(body.student_nationality),
        student_visa_number: normalizeNullableString(body.student_visa_number),
        student_visa_expiry: normalizeNullableString(body.student_visa_expiry),
        student_gender: normalizeNullableString(body.student_gender),
        student_country_of_birth: normalizeNullableString(body.student_country_of_birth),
        application_from: normalizeNullableString(body.application_from),
        student_street_no: normalizeNullableString(body.student_street_no),
        student_suburb: normalizeNullableString(body.student_suburb),
        student_state: normalizeNullableString(body.student_state),
        student_postcode: normalizeNullableString(body.student_postcode),
        quoted_tuition: priceList.tuition_fee_onshore ?? body.quoted_tuition ?? null,
        quoted_materials: priceList.material_fee ?? body.quoted_materials ?? null,
        notes: normalizeNullableString(body.notes),
        appointment_date: normalizeNullableString(body.appointment_date ?? body.intake_date),
        appointment_time: normalizeNullableString(body.appointment_time),
        workflow_stage: 'docs_review' as WorkflowStage,
        received_by: authz.context.userId,
        created_by: authz.context.userId,
        last_updated_by: authz.context.userId,
        received_at: body.received_at ?? new Date().toISOString(),
    };

    let insertedApplication: InsertedApplicationRow | null = null;
    const { data: insertedWithUserClient, error: insertError } = await authz.context.supabase
        .from('applications')
        .insert(insertPayload)
        .select('id, student_uid, application_number, workflow_stage, updated_at')
        .single<InsertedApplicationRow>();

    insertedApplication = insertedWithUserClient ?? null;

    if (insertError && authz.context.role === 'agent' && partnerIdForInsert) {
        const maybeRlsError = insertError.code === '42501' || insertError.message?.toLowerCase().includes('row-level security');

        if (maybeRlsError) {
            try {
                const adminClient = createAdminServerClient();

                const { data: confirmedOwnedPartner } = await adminClient
                    .from('partners')
                    .select('id')
                    .eq('id', partnerIdForInsert)
                    .eq('user_id', authz.context.userId)
                    .in('type', AGENT_PARTNER_TYPES)
                    .maybeSingle<{ id: string }>();

                if (!confirmedOwnedPartner) {
                    return NextResponse.json(
                        {
                            error: 'Your agent account is not linked to an allowed partner profile. Please contact support.',
                        },
                        { status: 403 }
                    );
                }

                const { data: insertedWithAdminClient, error: adminInsertError } = await adminClient
                    .from('applications')
                    .insert(insertPayload)
                    .select('id, student_uid, application_number, workflow_stage, updated_at')
                    .single<InsertedApplicationRow>();

                if (adminInsertError || !insertedWithAdminClient) {
                    return NextResponse.json(
                        {
                            error: adminInsertError?.message || 'Failed to create application',
                        },
                        { status: 500 }
                    );
                }

                insertedApplication = insertedWithAdminClient;
            } catch {
                return NextResponse.json(
                    {
                        error: insertError.message || 'Failed to create application',
                    },
                    { status: 500 }
                );
            }
        }
    }

    if (!insertedApplication) {
        return NextResponse.json(
            {
                error: insertError?.message || 'Failed to create application',
            },
            { status: 500 }
        );
    }

    await insertApplicationHistory(authz.context.supabase, {
        applicationId: insertedApplication.id,
        action: 'created',
        fieldChanged: 'workflow_stage',
        oldValue: null,
        newValue: insertedApplication.workflow_stage,
        userId: authz.context.userId,
        metadata: {
            source: 'api.applications.create',
        },
        fromStage: null,
        toStage: insertedApplication.workflow_stage,
        notes: 'Application created',
    });

    const transitionInsert = await authz.context.supabase
        .from('workflow_transition_events')
        .insert({
            application_id: insertedApplication.id,
            from_stage: 'docs_review',
            to_stage: 'docs_review',
            actor_id: authz.context.userId,
            notes: 'Application intake created',
            metadata: {
                source: 'api.applications.create',
                event_type: 'created',
            },
        });

    if (transitionInsert.error) {
        console.warn('Application create transition event insert failed:', transitionInsert.error.message);
    }

    return NextResponse.json(
        {
            data: insertedApplication,
            meta: {
                agentPartnerProvisioned,
            },
        },
        { status: 201 }
    );
}
