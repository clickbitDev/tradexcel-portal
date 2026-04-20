import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import {
    getAssessorQualifications,
    addAssessorQualification,
    removeAssessorQualification,
    getAvailableQualifications,
} from '@/lib/services/assessor-qualification-service';
import type { UserRole } from '@/types/database';

const ASSESSOR_QUAL_VIEW_ROLES: UserRole[] = [
    'ceo',
    'developer',
    'executive_manager',
    'admin',
    'assessor',
];

const ASSESSOR_QUAL_MANAGE_ROLES: UserRole[] = [
    'ceo',
    'developer',
    'executive_manager',
    'admin',
];

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'view',
        allowedRoles: ASSESSOR_QUAL_VIEW_ROLES,
    });
    if (!authz.ok) {
        return authz.response;
    }

    const { id: assessorId } = await params;
    const url = new URL(request.url);
    const available = url.searchParams.get('available');

    if (available === 'true') {
        const { data, error } = await getAvailableQualifications(assessorId);
        if (error) {
            return NextResponse.json({ error }, { status: 500 });
        }
        return NextResponse.json({ data });
    }

    const { data, error } = await getAssessorQualifications(assessorId);

    if (error) {
        return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ data });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'assign',
        allowedRoles: ASSESSOR_QUAL_MANAGE_ROLES,
    });
    if (!authz.ok) {
        return authz.response;
    }

    const { id: assessorId } = await params;

    try {
        const body = await request.json();

        if (!body.qualification_id) {
            return NextResponse.json({ error: 'Missing qualification_id' }, { status: 400 });
        }

        const { data, error } = await addAssessorQualification(assessorId, body.qualification_id);

        if (error) {
            return NextResponse.json({ error }, { status: 500 });
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'assign',
        allowedRoles: ASSESSOR_QUAL_MANAGE_ROLES,
    });
    if (!authz.ok) {
        return authz.response;
    }

    const { id: assessorId } = await params;
    const url = new URL(request.url);
    const qualificationId = url.searchParams.get('qualificationId');

    if (!qualificationId) {
        return NextResponse.json({ error: 'Missing qualificationId' }, { status: 400 });
    }

    const { error } = await removeAssessorQualification(assessorId, qualificationId);

    if (error) {
        return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
