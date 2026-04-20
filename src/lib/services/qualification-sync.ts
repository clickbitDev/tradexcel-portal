/**
 * Qualification Sync Service
 * 
 * Server actions for synchronizing qualifications with TGA API
 */

'use server';

import { createServerClient } from '@/lib/supabase/server';
import { tgaApiClient, type TGASyncResult } from '@/lib/tga-api/client';
import type { QualificationExtended, TGASyncLog } from '@/lib/types/qualifications';

interface SyncOptions {
    force?: boolean; // Force sync even if recently synced
    updateUnits?: boolean; // Also sync unit data
}

/**
 * Sync a single qualification with TGA API
 */
export async function syncQualificationWithTGA(
    qualificationId: string,
    options: SyncOptions = {}
): Promise<TGASyncResult> {
    const supabase = await createServerClient();

    try {
        // Get current user for audit trail
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('User not authenticated');
        }

        // Fetch qualification from database
        const { data: qualification, error: fetchError } = await supabase
            .from('qualifications')
            .select('*')
            .eq('id', qualificationId)
            .single();

        if (fetchError || !qualification) {
            throw new Error('Qualification not found');
        }

        // Check if TGA API is available
        if (!tgaApiClient.isAvailable()) {
            // For development: use mock data
            console.log('TGA API not configured, using mock data for development');
            const mockData = await tgaApiClient.getMockQualification(qualification.code);

            const changes = detectChanges(qualification, mockData);

            if (changes.length > 0 || options.force) {
                await applyChanges(supabase, qualification, mockData, options.updateUnits);
            }

            // Log sync attempt
            await logSyncResult(supabase, qualificationId, {
                success: true,
                result: changes.length > 0 ? 'success' : 'skipped',
                changes,
                apiResponse: mockData,
            }, user.id);

            return {
                success: true,
                result: changes.length > 0 ? 'success' : 'skipped',
                changes,
                apiResponse: mockData,
            };
        }

        // Fetch from TGA API
        const tgaData = await tgaApiClient.getQualification(qualification.code);

        // Detect changes
        const changes = detectChanges(qualification, tgaData);

        // Apply changes if any detected
        if (changes.length > 0 || options.force) {
            await applyChanges(supabase, qualification, tgaData, options.updateUnits);
        }

        // Log successful sync
        await logSyncResult(supabase, qualificationId, {
            success: true,
            result: changes.length > 0 ? 'success' : 'skipped',
            changes,
            apiResponse: tgaData,
        }, user.id);

        return {
            success: true,
            result: changes.length > 0 ? 'success' : 'skipped',
            changes,
            apiResponse: tgaData,
        };
    } catch (error) {
        console.error('Error syncing qualification:', error);

        // Log failed sync
        const supabase2 = await createServerClient();
        const {
            data: { user },
        } = await supabase2.auth.getUser();

        await logSyncResult(supabase2, qualificationId, {
            success: false,
            result: 'failed',
            changes: [],
            error: error instanceof Error ? error.message : 'Unknown error',
        }, user?.id);

        return {
            success: false,
            result: 'failed',
            changes: [],
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Bulk sync multiple qualifications
 */
export async function bulkSyncQualifications(
    qualificationIds: string[],
    options: SyncOptions = {}
): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: Record<string, TGASyncResult>;
}> {
    const results: Record<string, TGASyncResult> = {};
    let successful = 0;
    let failed = 0;

    for (const id of qualificationIds) {
        const result = await syncQualificationWithTGA(id, options);
        results[id] = result;

        if (result.success) {
            successful++;
        } else {
            failed++;
        }
    }

    return {
        total: qualificationIds.length,
        successful,
        failed,
        results,
    };
}

/**
 * Detect changes between local and TGA data
 */
function detectChanges(
    local: QualificationExtended,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tga: any
): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
    const changes = [];

    if (local.name !== tga.title) {
        changes.push({ field: 'name', oldValue: local.name, newValue: tga.title });
    }

    if (local.level !== tga.level) {
        changes.push({ field: 'level', oldValue: local.level, newValue: tga.level });
    }

    if (local.status !== tga.status) {
        changes.push({ field: 'status', oldValue: local.status, newValue: tga.status });
    }

    if (tga.supersededBy && local.superseded_by !== tga.supersededBy) {
        changes.push({
            field: 'superseded_by',
            oldValue: local.superseded_by,
            newValue: tga.supersededBy,
        });
    }

    if (tga.cricosCode && local.cricos_code !== tga.cricosCode) {
        changes.push({
            field: 'cricos_code',
            oldValue: local.cricos_code,
            newValue: tga.cricosCode,
        });
    }

    return changes;
}

/**
 * Apply TGA changes to local database
 */
async function applyChanges(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    local: QualificationExtended,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tga: any,
    updateUnits: boolean = true
) {
    // Update qualification
    await supabase
        .from('qualifications')
        .update({
            name: tga.title,
            level: tga.level,
            status: tga.status,
            superseded_by: tga.supersededBy || null,
            cricos_code: tga.cricosCode || null,
            tga_sync_status: 'synced',
            tga_last_synced_at: new Date().toISOString(),
        })
        .eq('id', local.id);

    // Update units if requested and available
    if (updateUnits && tga.units && Array.isArray(tga.units)) {
        // Mark all existing units as not current
        await supabase
            .from('qualification_units')
            .update({ is_current: false })
            .eq('qualification_id', local.id);

        // Insert or update units from TGA
        for (const unit of tga.units) {
            await supabase
                .from('qualification_units')
                .upsert(
                    {
                        qualification_id: local.id,
                        unit_code: unit.code,
                        unit_title: unit.title,
                        unit_type: unit.type,
                        field_of_education: unit.fieldOfEducation || null,
                        nominal_hours: unit.nominalHours || null,
                        is_current: true,
                    },
                    {
                        onConflict: 'qualification_id, unit_code',
                    }
                );
        }
    }
}

/**
 * Log sync result to audit trail
 */
async function logSyncResult(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    qualificationId: string,
    result: TGASyncResult,
    userId?: string
) {
    await supabase.from('tga_sync_log').insert({
        qualification_id: qualificationId,
        sync_result: result.result,
        changes_detected: result.changes || {},
        api_response: result.apiResponse || null,
        error_message: result.error || null,
        synced_by: userId || null,
    });
}

/**
 * Get sync history for a qualification
 */
export async function getQualificationSyncHistory(
    qualificationId: string,
    limit: number = 10
): Promise<TGASyncLog[]> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from('tga_sync_log')
        .select('*')
        .eq('qualification_id', qualificationId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching sync history:', error);
        return [];
    }

    return data || [];
}
