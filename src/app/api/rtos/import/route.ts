import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import type { ParsedRTO } from '@/lib/rto-utils.client';
import type { UserRole } from '@/types/database';

const RTO_IMPORT_ROLES: UserRole[] = [
    'ceo',
    'developer',
    'admin',
    'executive_manager',
];

/**
 * POST /api/rtos/import
 * Import RTOs from CSV data
 */
export async function POST(request: NextRequest) {
    try {
        const authz = await authorizeApiRequest({
            request,
            resource: 'rto',
            action: 'manage_rtos',
            allowedRoles: RTO_IMPORT_ROLES,
        });
        if (!authz.ok) {
            return authz.response;
        }

        const supabase = authz.context.supabase;

        // Parse request body
        const body = await request.json();
        const { data: rtoData } = body;

        if (!Array.isArray(rtoData)) {
            return NextResponse.json(
                { error: 'Invalid request body. Expected array of RTOs' },
                { status: 400 }
            );
        }

        // Check which RTOs already exist
        const codes = rtoData.map((r: ParsedRTO) => r.code);
        const { data: existingRTOs, error: checkError } = await supabase
            .from('rtos')
            .select('code')
            .in('code', codes);

        if (checkError) {
            console.error('Error checking existing RTOs:', checkError);
            return NextResponse.json(
                { error: 'Failed to check existing RTOs' },
                { status: 500 }
            );
        }

        const existingCodes = new Set(existingRTOs?.map(r => r.code) || []);

        // Separate into updates and inserts
        const toUpdate = rtoData.filter((r: ParsedRTO) => existingCodes.has(r.code));
        const toInsert = rtoData.filter((r: ParsedRTO) => !existingCodes.has(r.code));

        // Insert new RTOs
        if (toInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('rtos')
                .insert(toInsert.map((r: ParsedRTO) => ({
                    code: r.code,
                    name: r.name,
                    status: r.status || 'active',
                    location: r.location || null,
                    state: r.state || null,
                    phone: r.phone || null,
                    email: r.email || null,
                    website: r.website || null,
                    cricos_provider_code: r.cricos_provider_code || null,
                    tga_sync_status: r.tga_sync_status || 'never',
                    notes: r.notes || null,
                })));

            if (insertError) {
                console.error('Error inserting RTOs:', insertError);
                return NextResponse.json(
                    { error: insertError.message || 'Failed to insert RTOs' },
                    { status: 500 }
                );
            }
        }

        // Update existing RTOs
        for (const rto of toUpdate) {
            const { error: updateError } = await supabase
                .from('rtos')
                .update({
                    name: rto.name,
                    status: rto.status || 'active',
                    location: rto.location || null,
                    state: rto.state || null,
                    phone: rto.phone || null,
                    email: rto.email || null,
                    website: rto.website || null,
                    cricos_provider_code: rto.cricos_provider_code || null,
                    tga_sync_status: rto.tga_sync_status || 'never',
                    notes: rto.notes || null,
                })
                .eq('code', rto.code);

            if (updateError) {
                console.error('Error updating RTO:', updateError);
                return NextResponse.json(
                    { error: updateError.message || 'Failed to update RTOs' },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            inserted: toInsert.length,
            updated: toUpdate.length,
        });
    } catch (error) {
        console.error('Error in POST /api/rtos/import:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
