import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { canRoleViewDetailedProdErrors, isDetailedProdErrorsEnabled } from '@/lib/error-debug-server';

export const dynamic = 'force-dynamic';

export async function GET() {
    if (!isDetailedProdErrorsEnabled()) {
        return NextResponse.json({ enabled: false, allowed: false });
    }

    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ enabled: true, allowed: false }, { status: 401 });
        }

        const { data: profileWithStatus, error: profileWithStatusError } = await supabase
            .from('profiles')
            .select('role, account_status')
            .eq('id', user.id)
            .single();

        const profile = profileWithStatusError && profileWithStatusError.message?.includes('account_status')
            ? await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()
            : { data: profileWithStatus, error: profileWithStatusError };

        if (!profile.data) {
            return NextResponse.json({ enabled: true, allowed: false }, { status: 404 });
        }

        const accountStatus = 'account_status' in profile.data
            ? profile.data.account_status
            : 'active';

        if ((accountStatus || 'active') === 'disabled') {
            return NextResponse.json({ enabled: true, allowed: false }, { status: 403 });
        }

        const role = profile.data.role;

        return NextResponse.json({
            enabled: true,
            allowed: canRoleViewDetailedProdErrors(role),
        });
    } catch (error) {
        console.error('Error in GET /api/debug/error-mode:', error);
        return NextResponse.json({ enabled: true, allowed: false }, { status: 500 });
    }
}
