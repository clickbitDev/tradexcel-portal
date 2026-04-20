import { redirect, unstable_rethrow } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { PriceListTable } from '@/components/dashboard/price-list-table';
import { DeploymentConfigErrorState } from '@/components/deployment-config-error-state';
import { isSupabaseConfigurationError } from '@/lib/supabase/config-error';

export default async function AgentDashboardPage() {
    try {
        const supabase = await createServerClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            redirect('/login');
        }
    } catch (error) {
        unstable_rethrow(error);

        if (isSupabaseConfigurationError(error)) {
            return (
                <DeploymentConfigErrorState
                    error={error}
                    title="Agent portal unavailable"
                    navHref="/login"
                    navLabel="Go to Login"
                    debugContext={{ page: 'src/app/agent/page.tsx' }}
                />
            );
        }

        throw error;
    }

    return (
        <main className="flex-1 overflow-y-auto">
            <header className="bg-card border-b border-border px-4 md:px-6 py-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-semibold text-foreground">Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Price list for active qualifications and RTO offerings.
                    </p>
                </div>
            </header>

            <div className="p-4 md:p-6">
                <PriceListTable />
            </div>
        </main>
    );
}
