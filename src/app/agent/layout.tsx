import { createServerClient } from '@/lib/supabase/server';
import { redirect, unstable_rethrow } from 'next/navigation';
import AgentLayout from '@/components/agent/AgentLayout';
import { ErrorStateCard } from '@/components/error-state-card';
import { toDisplayError } from '@/lib/error-display';
import { canRoleViewDetailedProdErrors, isDetailedProdErrorsEnabled } from '@/lib/error-debug-server';

export default async function AgentRootLayout({
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

        // Get profile to verify agent role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, account_status')
            .eq('id', user.id)
            .single();

        resolvedRole = profile?.role ?? null;

        if ((profile?.account_status || 'active') === 'disabled') {
            redirect('/login?reason=disabled');
        }

        if (profile?.role !== 'agent') {
            redirect('/portal');
        }

        // Get partner info for the agent
        const { data: partner } = await supabase
            .from('partners')
            .select('company_name')
            .eq('user_id', user.id)
            .single();

        return (
            <AgentLayout partnerName={partner?.company_name ?? undefined}>
                {children}
            </AgentLayout>
        );
    } catch (error) {
        unstable_rethrow(error);
        console.error('[AgentRootLayout] Failed to render agent layout:', error);

        if (detailedProdErrorsEnabled && canRoleViewDetailedProdErrors(resolvedRole)) {
            return (
                <ErrorStateCard
                    title="Agent Applications Error"
                    description="A server-side error prevented the agent application area from rendering."
                    error={toDisplayError(error)}
                    forceShowDetails
                    retryAction={{ label: 'Reload Page', mode: 'reload' }}
                    navAction={{ label: 'Go to Agent Home', href: '/portal/agent' }}
                    debugContext={{
                        boundary: 'src/app/agent/layout.tsx',
                        resolvedRole,
                    }}
                />
            );
        }

        throw error;
    }
}
