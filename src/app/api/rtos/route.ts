import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import type { Rto, RtoStatus, UserRole } from '@/types/database';

const STAFF_ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
];

/**
 * GET /api/rtos
 * Fetch RTOs with assigned manager information
 * Supports pagination and search via query params:
 * - page (default: 1)
 * - limit (default: 10)
 * - search (optional, matches name/code/location/state)
 * - status (optional, active|pending|suspended|inactive)
 */
export async function GET(request: NextRequest) {
    try {
        const authz = await authorizeApiRequest({
            request,
            resource: 'rto',
            action: 'manage_rtos',
            allowedRoles: STAFF_ROLES,
        });
        if (!authz.ok) {
            return authz.response;
        }

        const supabase = authz.context.supabase;

        // Get pagination params
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '10', 10);
        const search = (searchParams.get('search') || '').trim();
        const rawStatus = (searchParams.get('status') || '').trim();
        const validStatuses: RtoStatus[] = ['active', 'pending', 'suspended', 'inactive'];
        const statusFilter: RtoStatus | null = validStatuses.includes(rawStatus as RtoStatus)
            ? (rawStatus as RtoStatus)
            : null;
        const offset = (page - 1) * limit;

        // Escape commas because PostgREST .or() uses comma as separator
        const safeSearch = search.replace(/,/g, ' ');
        const searchFilter = safeSearch
            ? `name.ilike.%${safeSearch}%,code.ilike.%${safeSearch}%,location.ilike.%${safeSearch}%,state.ilike.%${safeSearch}%`
            : null;

        // Fetch total count first
        let countQuery = supabase
            .from('rtos')
            .select('*', { count: 'exact', head: true })
            .eq('is_deleted', false);

        if (searchFilter) {
            countQuery = countQuery.or(searchFilter);
        }

        if (statusFilter) {
            countQuery = countQuery.eq('status', statusFilter);
        }

        const { count, error: countError } = await countQuery;

        if (countError) {
            console.error('Error fetching RTO count:', countError);
        }

        // Fetch paginated RTOs first (without foreign key to ensure proper pagination)
        // Use range() with explicit calculation - range is inclusive on both ends
        // For page 1, limit 10: offset=0, endIndex=9, returns items 0-9 (10 items)
        const endIndex = offset + limit - 1;
        
        console.log(`[API /rtos] Building query with range(${offset}, ${endIndex})`);
        
        let dataQuery = supabase
            .from('rtos')
            .select('*', { count: 'exact' })
            .eq('is_deleted', false);

        if (searchFilter) {
            dataQuery = dataQuery.or(searchFilter);
        }

        if (statusFilter) {
            dataQuery = dataQuery.eq('status', statusFilter);
        }

        dataQuery = dataQuery
            .order('name', { ascending: true })
            .range(offset, endIndex);

        const { data: rtosData, error: rtosError } = await dataQuery;

        if (rtosError) {
            console.error('Error fetching RTOs:', rtosError);
            return NextResponse.json(
                { error: rtosError.message || 'Failed to fetch RTOs' },
                { status: 500 }
            );
        }

        // Filter out any invalid RTOs
        let validRTOs = (rtosData || []).filter((rto: Rto) => 
            rto && rto.id && rto.code && rto.name && rto.status
        );
        
        // CRITICAL: Force limit on client side as safeguard
        // If Supabase range() fails, this ensures we never return more than requested
        if (validRTOs.length > limit) {
            console.warn(`[API /rtos] WARNING: Received ${validRTOs.length} RTOs but limit is ${limit}. Truncating to ${limit}.`);
            validRTOs = validRTOs.slice(0, limit);
        }

        // Fetch assigned managers for the paginated RTOs
        const managerIds = validRTOs
            .map(rto => rto.assigned_manager_id)
            .filter((id): id is string => id !== null && id !== undefined);

        let managersMap: Record<string, { id: string; full_name: string }> = {};
        if (managerIds.length > 0) {
            const { data: managersData } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', managerIds);

            if (managersData) {
                managersMap = managersData.reduce((acc, manager) => {
                    acc[manager.id] = manager;
                    return acc;
                }, {} as Record<string, { id: string; full_name: string }>);
            }
        }

        // Enrich RTOs with assigned manager data
        const enrichedRTOs = validRTOs.map(rto => ({
            ...rto,
            assigned_manager: rto.assigned_manager_id && managersMap[rto.assigned_manager_id]
                ? managersMap[rto.assigned_manager_id]
                : null
        }));

        // Debug logging
        console.log(`[API /rtos] Page: ${page}, Limit: ${limit}, Search: "${search}", Status: "${statusFilter || 'all'}", Offset: ${offset}, EndIndex: ${endIndex}`);
        console.log(`[API /rtos] Query returned ${rtosData?.length || 0} RTOs from DB`);
        console.log(`[API /rtos] After filtering: ${validRTOs.length} valid RTOs`);
        console.log(`[API /rtos] Total count: ${count}, Returning: ${enrichedRTOs.length} RTOs`);

        return NextResponse.json({ 
            data: enrichedRTOs,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        });
    } catch (error) {
        console.error('Error in GET /api/rtos:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
