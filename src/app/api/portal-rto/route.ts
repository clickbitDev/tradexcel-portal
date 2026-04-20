import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { getResolvedPortalRto } from '@/lib/portal-rto';
import { saveSharpFutureConnection } from '@/lib/rto-integration/connection';
import { createAdminServerClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

const GET_ALLOWED_ROLES: UserRole[] = [
    'ceo',
    'developer',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
];

const MANAGE_ALLOWED_ROLES: UserRole[] = ['ceo', 'developer'];

const PortalRtoPayloadSchema = z.object({
    code: z.string().trim().min(1, 'RTO code is required.'),
    name: z.string().trim().min(1, 'RTO name is required.'),
    status: z.enum(['active', 'pending', 'suspended', 'inactive']).default('active'),
    location: z.string().trim().nullable().optional(),
    state: z.string().trim().nullable().optional(),
    phone: z.string().trim().nullable().optional(),
    email: z.string().trim().email('Enter a valid email address.').nullable().optional().or(z.literal('')),
    website: z.string().trim().url('Enter a valid website URL.').nullable().optional().or(z.literal('')),
    notes: z.string().trim().nullable().optional(),
    providerName: z.string().trim().nullable().optional(),
    contactPersonName: z.string().trim().nullable().optional(),
});

function formatPortalRtoResponse(input: Awaited<ReturnType<typeof getResolvedPortalRto>>) {
    return {
        configuredRtoId: input.configuredRtoId,
        isImplicit: input.isImplicit,
        rto: input.rto
            ? {
                id: input.rto.id,
                code: input.rto.code,
                name: input.rto.name,
                status: input.rto.status,
                location: input.rto.location,
                state: input.rto.state,
                phone: input.rto.phone,
                email: input.rto.email,
                website: input.rto.website,
                notes: input.rto.notes,
                providerName: input.rto.provider_name,
                contactPersonName: input.rto.contact_person_name,
            }
            : null,
    };
}

export async function GET(request: NextRequest) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'rto',
        allowedRoles: GET_ALLOWED_ROLES,
        audit: false,
    });

    if (!authz.ok) {
        return authz.response;
    }

    const portalRto = await getResolvedPortalRto(authz.context.supabase as never);
    return NextResponse.json({ data: formatPortalRtoResponse(portalRto) });
}

export async function POST(request: NextRequest) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'rto',
        action: 'manage_rtos',
        allowedRoles: MANAGE_ALLOWED_ROLES,
    });

    if (!authz.ok) {
        return authz.response;
    }

    const parsedBody = PortalRtoPayloadSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: 'Invalid portal RTO payload.',
                details: parsedBody.error.issues,
            },
            { status: 400 }
        );
    }

    const adminSupabase = createAdminServerClient();
    const currentPortalRto = await getResolvedPortalRto(adminSupabase as never);

    const upsertPayload = {
        code: parsedBody.data.code,
        name: parsedBody.data.name,
        status: parsedBody.data.status,
        location: parsedBody.data.location || null,
        state: parsedBody.data.state || null,
        phone: parsedBody.data.phone || null,
        email: parsedBody.data.email || null,
        website: parsedBody.data.website || null,
        notes: parsedBody.data.notes || null,
        provider_name: parsedBody.data.providerName || null,
        contact_person_name: parsedBody.data.contactPersonName || null,
    };

    const targetRtoId = currentPortalRto.configuredRtoId || currentPortalRto.rto?.id || null;

    const { data: savedRto, error: saveError } = targetRtoId
        ? await adminSupabase
            .from('rtos')
            .update(upsertPayload)
            .eq('id', targetRtoId)
            .eq('is_deleted', false)
            .select('id, code, name, status, location, state, phone, email, website, notes, provider_name, contact_person_name')
            .single()
        : await adminSupabase
            .from('rtos')
            .insert(upsertPayload)
            .select('id, code, name, status, location, state, phone, email, website, notes, provider_name, contact_person_name')
            .single();

    if (saveError || !savedRto) {
        return NextResponse.json(
            { error: saveError?.message || 'Unable to save the portal RTO.' },
            { status: 500 }
        );
    }

    await saveSharpFutureConnection({
        supabase: adminSupabase as never,
        portalRtoId: savedRto.id,
        updatedBy: authz.context.userId,
    });

    const refreshedPortalRto = await getResolvedPortalRto(adminSupabase as never);
    return NextResponse.json({ data: formatPortalRtoResponse(refreshedPortalRto) });
}
