import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import {
    findDuplicates,
    mergeStudents,
    getStudents,
} from '@/lib/services/student-master-service';
import type { UserRole } from '@/types/database';

const STUDENT_DATA_MANAGER_ROLES: UserRole[] = [
    'ceo',
    'developer',
    'executive_manager',
    'admin',
    'frontdesk',
];

export async function GET(request: NextRequest) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'view',
        allowedRoles: STUDENT_DATA_MANAGER_ROLES,
    });
    if (!authz.ok) {
        return authz.response;
    }

    const url = new URL(request.url);
    const search = url.searchParams.get('search');
    const all = url.searchParams.get('all');

    if (all === 'true') {
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const { data, error } = await getStudents(search || undefined, limit);
        if (error) {
            return NextResponse.json({ error }, { status: 500 });
        }
        return NextResponse.json({ data });
    }

    // Default: find duplicates
    const { data, error } = await findDuplicates();

    if (error) {
        return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'application',
        action: 'assign',
        allowedRoles: ['ceo', 'developer', 'executive_manager', 'admin'],
    });
    if (!authz.ok) {
        return authz.response;
    }

    try {
        const body = await request.json();

        if (!body.keepId || !body.mergeIds || !Array.isArray(body.mergeIds)) {
            return NextResponse.json(
                { error: 'Missing required fields: keepId, mergeIds (array)' },
                { status: 400 }
            );
        }

        const { error } = await mergeStudents(body.keepId, body.mergeIds);

        if (error) {
            return NextResponse.json({ error }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
