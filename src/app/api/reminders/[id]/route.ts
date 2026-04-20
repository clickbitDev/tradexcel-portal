import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import {
    getReminder,
    updateReminder,
    deleteReminder,
    toggleReminderStatus,
    getReminderHistory,
    type UpdateReminderInput
} from '@/lib/services/scheduled-reminder-service';
import type { UserRole } from '@/types/database';

const REMINDER_MANAGER_ROLES: UserRole[] = [
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
        resource: 'reminder',
        action: 'manage_reminders',
        allowedRoles: REMINDER_MANAGER_ROLES,
    });
    if (!authz.ok) {
        return authz.response;
    }

    const { id } = await params;
    const url = new URL(request.url);
    const history = url.searchParams.get('history');

    if (history === 'true') {
        const { data, error } = await getReminderHistory(id);
        if (error) {
            return NextResponse.json({ error }, { status: 500 });
        }
        return NextResponse.json({ data });
    }

    const { data, error } = await getReminder(id);

    if (error) {
        return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ data });
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'reminder',
        action: 'manage_reminders',
        allowedRoles: REMINDER_MANAGER_ROLES,
    });
    if (!authz.ok) {
        return authz.response;
    }

    const { id } = await params;

    try {
        const body: UpdateReminderInput = await request.json();
        const { data, error } = await updateReminder(id, body);

        if (error) {
            return NextResponse.json({ error }, { status: 500 });
        }

        return NextResponse.json({ data });
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
        resource: 'reminder',
        action: 'manage_reminders',
        allowedRoles: REMINDER_MANAGER_ROLES,
    });
    if (!authz.ok) {
        return authz.response;
    }

    const { id } = await params;
    const { error } = await deleteReminder(id);

    if (error) {
        return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'reminder',
        action: 'manage_reminders',
        allowedRoles: REMINDER_MANAGER_ROLES,
    });
    if (!authz.ok) {
        return authz.response;
    }

    const { id } = await params;
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'toggle') {
        const { data, error } = await toggleReminderStatus(id);
        if (error) {
            return NextResponse.json({ error }, { status: 500 });
        }
        return NextResponse.json({ data });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
