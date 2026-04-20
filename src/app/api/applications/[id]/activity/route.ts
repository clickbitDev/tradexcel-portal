import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { insertApplicationHistory } from '@/lib/workflow/history';

const ActivityEntrySchema = z.object({
    action: z.string().trim().min(1).max(100),
    fieldChanged: z.string().trim().max(100).nullable().optional(),
    oldValue: z.string().nullable().optional(),
    newValue: z.string().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    fromStage: z.string().trim().max(100).nullable().optional(),
    toStage: z.string().trim().max(100).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

const ActivityPayloadSchema = z.object({
    entries: z.array(ActivityEntrySchema).min(1).max(25),
});

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
    });

    if (!authz.ok) {
        return authz.response;
    }

    const parsedBody = ActivityPayloadSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json({ error: 'Invalid activity payload.' }, { status: 400 });
    }

    await Promise.all(parsedBody.data.entries.map((entry) =>
        insertApplicationHistory(authz.context.supabase, {
            applicationId: id,
            action: entry.action,
            fieldChanged: entry.fieldChanged || null,
            oldValue: entry.oldValue || null,
            newValue: entry.newValue || null,
            userId: authz.context.userId,
            metadata: entry.metadata || null,
            fromStage: entry.fromStage || null,
            toStage: entry.toStage || null,
            notes: entry.notes || null,
        })
    ));

    return NextResponse.json({ data: { ok: true } }, { status: 201 });
}
