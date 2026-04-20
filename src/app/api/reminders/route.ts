import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import {
    getReminders,
    createReminder,
    type CreateReminderInput
} from '@/lib/services/scheduled-reminder-service';
import type { UserRole } from '@/types/database';

const REMINDER_MANAGER_ROLES: UserRole[] = [
    'ceo',
    'developer',
    'executive_manager',
    'admin',
];

export async function GET() {
    const authz = await authorizeApiRequest({
        resource: 'reminder',
        action: 'manage_reminders',
        allowedRoles: REMINDER_MANAGER_ROLES,
    });
    if (!authz.ok) {
        return authz.response;
    }

    const { data, error } = await getReminders();

    if (error) {
        return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'reminder',
        action: 'manage_reminders',
        allowedRoles: REMINDER_MANAGER_ROLES,
    });
    if (!authz.ok) {
        return authz.response;
    }

    try {
        const body: CreateReminderInput = await request.json();

        if (!body.name || !body.trigger_type || !body.notification_channel) {
            return NextResponse.json(
                { error: 'Missing required fields: name, trigger_type, notification_channel' },
                { status: 400 }
            );
        }

        const { data, error } = await createReminder(body);

        if (error) {
            return NextResponse.json({ error }, { status: 500 });
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
