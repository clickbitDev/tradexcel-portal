import { ErrorStateCard } from '@/components/error-state-card';
import { toDisplayError } from '@/lib/error-display';
import { SUPABASE_CONFIGURATION_USER_MESSAGE } from '@/lib/supabase/config-error';

interface DeploymentConfigErrorStateProps {
    error: unknown;
    title?: string;
    description?: string;
    navHref?: string;
    navLabel?: string;
    minHeightClassName?: string;
    debugContext?: Record<string, unknown>;
}

export function DeploymentConfigErrorState({
    error,
    title = 'Configuration Error',
    description = SUPABASE_CONFIGURATION_USER_MESSAGE,
    navHref,
    navLabel,
    minHeightClassName = 'min-h-[60vh]',
    debugContext,
}: DeploymentConfigErrorStateProps) {
    return (
        <ErrorStateCard
            title={title}
            description={description}
            error={toDisplayError(error)}
            retryAction={{ label: 'Reload Page', mode: 'reload' }}
            navAction={navHref && navLabel ? { label: navLabel, href: navHref } : undefined}
            minHeightClassName={minHeightClassName}
            debugContext={debugContext}
        />
    );
}
