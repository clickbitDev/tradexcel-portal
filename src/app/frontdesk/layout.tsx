import { createServerClient } from '@/lib/supabase/server';
import { redirect, unstable_rethrow } from 'next/navigation';
import FrontdeskLayout from '@/components/frontdesk/FrontdeskLayout';
import { ErrorStateCard } from '@/components/error-state-card';
import { toDisplayError } from '@/lib/error-display';
import { canRoleViewDetailedProdErrors, isDetailedProdErrorsEnabled } from '@/lib/error-debug-server';

export default async function FrontdeskRootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const detailedProdErrorsEnabled = isDetailedProdErrorsEnabled();
    let resolvedRole: string | null = null;

    try {
        const supabase = await createServerClient();

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            redirect('/login');
        }

        const { data: profileWithStatus, error: profileWithStatusError } = await supabase
            .from('profiles')
            .select('role, full_name, account_status')
            .eq('id', user.id)
            .single();

        const profileResult = profileWithStatusError && profileWithStatusError.message?.includes('account_status')
            ? await supabase
                .from('profiles')
                .select('role, full_name')
                .eq('id', user.id)
                .single()
            : { data: profileWithStatus, error: profileWithStatusError };

        const role = profileResult.data?.role;
        resolvedRole = role ?? null;
        const fullName = profileResult.data?.full_name ?? undefined;
        const accountStatus = profileWithStatusError && profileWithStatusError.message?.includes('account_status')
            ? 'active'
            : (profileWithStatus?.account_status || 'active');

        if (accountStatus === 'disabled') {
            redirect('/login?reason=disabled');
        }

        if (role !== 'frontdesk') {
            if (role === 'agent') {
                redirect('/portal/agent');
            }

            if (role === 'assessor') {
                redirect('/portal/assessor');
            }

            if (role === 'accounts_manager') {
                redirect('/portal/accounts_manager');
            }

            if (role === 'executive_manager') {
                redirect('/portal/executive_manager');
            }

            redirect('/portal');
        }

        return (
            <FrontdeskLayout frontdeskName={fullName}>
                {children}
            </FrontdeskLayout>
        );
    } catch (error) {
        unstable_rethrow(error);
        console.error('[FrontdeskRootLayout] Failed to render frontdesk layout:', error);

        if (detailedProdErrorsEnabled && canRoleViewDetailedProdErrors(resolvedRole)) {
            return (
                <ErrorStateCard
                    title="Frontdesk Applications Error"
                    description="A server-side error prevented the frontdesk application area from rendering."
                    error={toDisplayError(error)}
                    forceShowDetails
                    retryAction={{ label: 'Reload Page', mode: 'reload' }}
                    navAction={{ label: 'Go to Frontdesk Home', href: '/frontdesk' }}
                    debugContext={{
                        boundary: 'src/app/frontdesk/layout.tsx',
                        resolvedRole,
                    }}
                />
            );
        }

        throw error;
    }
}
