type ServerSupabaseClient = Awaited<
    ReturnType<typeof import('@/lib/supabase/server').createServerClient>
>;

async function emitSharpFutureHistoryEvent(input: {
    supabase: ServerSupabaseClient;
    applicationId: string;
    action: string | null;
    fieldChanged: string | null;
    oldValue: string | null;
    newValue: string | null;
    userId: string | null;
    metadata: Record<string, unknown> | null;
    fromStage: string | null;
    toStage: string | null;
    notes: string | null;
}) {
    const { emitSharpFutureHistoryEvent: emitEvent } = await import('@/lib/rto-integration/sync');
    await emitEvent({
        supabase: input.supabase,
        applicationId: input.applicationId,
        entry: {
            action: input.action,
            fieldChanged: input.fieldChanged,
            oldValue: input.oldValue,
            newValue: input.newValue,
            userId: input.userId,
            metadata: input.metadata,
            fromStage: input.fromStage,
            toStage: input.toStage,
            notes: input.notes,
        },
    });
}

export interface InsertApplicationHistoryInput {
    applicationId: string;
    action?: string | null;
    fieldChanged?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    userId?: string | null;
    metadata?: Record<string, unknown> | string | null;
    fromStage?: string | null;
    toStage?: string | null;
    notes?: string | null;
}

function stringifyMetadata(value: InsertApplicationHistoryInput['metadata']): string | null {
    if (!value) {
        return null;
    }

    if (typeof value === 'string') {
        return value;
    }

    return JSON.stringify(value);
}

function normalizeObjectMetadata(value: InsertApplicationHistoryInput['metadata']): Record<string, unknown> | null {
    if (!value) {
        return null;
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? parsed as Record<string, unknown>
                : null;
        } catch {
            return null;
        }
    }

    return value;
}

function getFallbackHistoryStage(input: InsertApplicationHistoryInput): string {
    return input.toStage
        || input.fromStage
        || 'docs_review';
}

function getFallbackHistoryNotes(input: InsertApplicationHistoryInput): string | null {
    const rawNotes = input.notes
        || input.action
        || input.fieldChanged
        || null;

    return rawNotes ? rawNotes.slice(0, 50) : null;
}

export async function insertApplicationHistory(
    supabase: ServerSupabaseClient,
    input: InsertApplicationHistoryInput
): Promise<void> {
    const modernResult = await supabase
        .from('application_history')
        .insert({
            application_id: input.applicationId,
            action: input.action || 'updated',
            field_changed: input.fieldChanged || null,
            old_value: input.oldValue || null,
            new_value: input.newValue || null,
            user_id: input.userId || null,
            metadata: stringifyMetadata(input.metadata),
        });

    if (!modernResult.error) {
        await emitSharpFutureHistoryEvent({
            supabase,
            applicationId: input.applicationId,
            action: input.action || 'updated',
            fieldChanged: input.fieldChanged || null,
            oldValue: input.oldValue || null,
            newValue: input.newValue || null,
            userId: input.userId || null,
            metadata: normalizeObjectMetadata(input.metadata),
            fromStage: input.fromStage || input.oldValue || null,
            toStage: input.toStage || input.newValue || null,
            notes: input.notes || null,
        });
        return;
    }

    const fallbackToStage = getFallbackHistoryStage(input);

    const fallbackResult = await supabase
        .from('application_history')
        .insert({
            application_id: input.applicationId,
            from_stage: input.fromStage || input.oldValue || null,
            to_stage: fallbackToStage,
            changed_by: input.userId || null,
            notes: getFallbackHistoryNotes(input),
        });

    if (fallbackResult.error) {
        console.warn('Application history insert failed:', {
            modernError: modernResult.error.message,
            fallbackError: fallbackResult.error.message,
        });

        return;
    }

    await emitSharpFutureHistoryEvent({
        supabase,
        applicationId: input.applicationId,
        action: input.action || 'updated',
        fieldChanged: input.fieldChanged || null,
        oldValue: input.oldValue || null,
        newValue: input.newValue || fallbackToStage,
        userId: input.userId || null,
        metadata: normalizeObjectMetadata(input.metadata),
        fromStage: input.fromStage || input.oldValue || null,
        toStage: input.toStage || fallbackToStage,
        notes: input.notes || null,
    });
}
