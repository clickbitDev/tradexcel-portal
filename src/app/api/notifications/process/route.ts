import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
    processNotificationQueue,
    getQueueStats,
    getRecentNotifications
} from '@/lib/services/notification-processor';
import { evaluateReminders } from '@/lib/services/scheduled-reminder-service';

const STAFF_ROLES = [
    'ceo',
    'executive_manager',
    'admin',
    'frontdesk',
    'developer',
];

function hasValidCronToken(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET || process.env.CORN_SECRET;
    if (!cronSecret) return false;

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return false;

    const token = authHeader.slice('Bearer '.length).trim();
    return token === cronSecret;
}

async function isAuthenticatedStaff(): Promise<boolean> {
    try {
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return false;
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile?.role) {
            return false;
        }

        return STAFF_ROLES.includes(profile.role);
    } catch {
        return false;
    }
}

async function authorizeRequest(request: NextRequest): Promise<boolean> {
    if (hasValidCronToken(request)) {
        return true;
    }

    return isAuthenticatedStaff();
}

function parseLimit(rawValue: string | null, fallback: number): number {
    const parsed = Number.parseInt(rawValue || String(fallback), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }

    return Math.min(parsed, 500);
}

export async function GET(request: NextRequest) {
    const authorized = await authorizeRequest(request);
    if (!authorized) {
        return NextResponse.json(
            { error: 'Unauthorized. Provide a valid Bearer token or staff session.' },
            { status: 401 }
        );
    }

    const url = new URL(request.url);
    const stats = url.searchParams.get('stats');

    if (stats === 'true') {
        const { data, error } = await getQueueStats();
        if (error) {
            return NextResponse.json({ error }, { status: 500 });
        }
        return NextResponse.json({ data });
    }

    // Get recent notifications for monitoring
    const limit = parseLimit(url.searchParams.get('limit'), 100);
    const { data, error } = await getRecentNotifications(limit);

    if (error) {
        return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
    const authorized = await authorizeRequest(request);
    if (!authorized) {
        return NextResponse.json(
            { error: 'Unauthorized. Provide a valid Bearer token or staff session.' },
            { status: 401 }
        );
    }

    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get('limit'), 50);
    const includeReminders = url.searchParams.get('includeReminders') !== 'false';

    let remindersProcessed = 0;
    let reminderErrors: string[] = [];

    if (includeReminders) {
        const reminderResult = await evaluateReminders();
        remindersProcessed = reminderResult.processed;
        reminderErrors = reminderResult.errors;
    }

    // Process the notification queue
    const result = await processNotificationQueue(limit);
    const errors = [...reminderErrors, ...result.errors];

    return NextResponse.json({
        remindersProcessed,
        processed: result.processed,
        success: result.success,
        failed: result.failed,
        errors: errors.length > 0 ? errors : undefined,
    });
}
