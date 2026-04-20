import { NextRequest, NextResponse } from 'next/server';
import {
    authorizeApiRequest,
    redactFinancialDataForRole,
} from '@/lib/access-control/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

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

type DbErrorLike = {
    message?: string;
};

function isMissingIsDeletedColumn(error: unknown): boolean {
    const message = ((error as DbErrorLike | null | undefined)?.message || '').toLowerCase();
    return message.includes('is_deleted') && (message.includes('column') || message.includes('schema cache'));
}

function isRelationOrPermissionError(error: unknown): boolean {
    const message = ((error as DbErrorLike | null | undefined)?.message || '').toLowerCase();
    return (
        message.includes('relationship')
        || message.includes('foreign key')
        || message.includes('could not find')
        || message.includes('permission denied')
    );
}

export async function GET(request: NextRequest) {
    try {
        const authz = await authorizeApiRequest({
            request,
            resource: 'financial',
            allowedRoles: STAFF_ROLES,
            action: 'view_financials',
            allowCompatibilityPermission: true,
        });
        if (!authz.ok) {
            return authz.response;
        }

        const status = request.nextUrl.searchParams.get('status');
        const adminSupabase = createAdminServerClient();

        const buildQuery = (options: { includeDeletedFilter: boolean; includeRelations: boolean }) => {
            let query = adminSupabase
                .from('invoices')
                .select(options.includeRelations
                    ? '*,partner:partners(id,company_name),application:applications(id,application_number,student_uid)'
                    : '*');

            if (options.includeDeletedFilter) {
                query = query.or('is_deleted.is.null,is_deleted.eq.false');
            }

            if (status && status !== 'all') {
                query = query.eq('status', status);
            }

            return query.order('created_at', { ascending: false });
        };

        let { data, error } = await buildQuery({ includeDeletedFilter: true, includeRelations: true });

        if (error && isMissingIsDeletedColumn(error)) {
            const fallback = await buildQuery({ includeDeletedFilter: false, includeRelations: true });
            data = fallback.data;
            error = fallback.error;
        }

        if (error && isRelationOrPermissionError(error)) {
            let fallback = await buildQuery({ includeDeletedFilter: true, includeRelations: false });

            if (fallback.error && isMissingIsDeletedColumn(fallback.error)) {
                fallback = await buildQuery({ includeDeletedFilter: false, includeRelations: false });
            }

            data = fallback.data;
            error = fallback.error;
        }

        if (error) {
            return NextResponse.json({
                error: error.message || 'Failed to fetch invoices',
            }, { status: 500 });
        }

        const invoices = (data || []).filter((invoice) => {
            const invoiceWithDeleteFlag = invoice as { is_deleted?: boolean | null };
            return invoiceWithDeleteFlag.is_deleted !== true;
        });

        return NextResponse.json({
            invoices: redactFinancialDataForRole(invoices, authz.context.role),
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch invoices' },
            { status: 500 }
        );
    }
}
