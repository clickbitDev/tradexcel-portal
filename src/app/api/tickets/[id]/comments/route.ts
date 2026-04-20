import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import {
    getTicketComments,
    addTicketComment,
    deleteTicketComment,
    type CreateCommentInput
} from '@/lib/services/ticket-comment-service';
import type { UserRole } from '@/types/database';

const TICKET_COMMENT_VIEW_ROLES: UserRole[] = [
    'ceo',
    'developer',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'agent',
];

const TICKET_COMMENT_DELETE_ROLES: UserRole[] = [
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
        allowedRoles: TICKET_COMMENT_VIEW_ROLES,
    });
    if (!authz.ok) {
        return authz.response;
    }

    const { id } = await params;
    const { data, error } = await getTicketComments(id);

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
        action: 'view',
        allowedRoles: TICKET_COMMENT_VIEW_ROLES,
    });
    if (!authz.ok) {
        return authz.response;
    }

    const { id: ticket_id } = await params;

    try {
        const body = await request.json();

        if (!body.content) {
            return NextResponse.json({ error: 'Missing content' }, { status: 400 });
        }

        const input: CreateCommentInput = {
            ticket_id,
            content: body.content,
            is_internal: body.is_internal ?? false,
        };

        const { data, error } = await addTicketComment(input);

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
        allowedRoles: TICKET_COMMENT_DELETE_ROLES,
    });
    if (!authz.ok) {
        return authz.response;
    }

    await params; // Unused but required by Next.js
    const url = new URL(request.url);
    const commentId = url.searchParams.get('commentId');

    if (!commentId) {
        return NextResponse.json({ error: 'Missing commentId' }, { status: 400 });
    }

    const { error } = await deleteTicketComment(commentId);

    if (error) {
        return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
