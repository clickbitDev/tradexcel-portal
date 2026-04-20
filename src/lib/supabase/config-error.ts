const SUPABASE_BROWSER_CONFIG_ERROR_FRAGMENT = "Your project's URL and API key are required to create a Supabase client!";
const SUPABASE_ADMIN_CONFIG_ERROR_FRAGMENT = "Your project's URL and service role key are required to create an admin Supabase client!";

export const SUPABASE_CONFIGURATION_USER_MESSAGE = 'The portal is temporarily unavailable because its Supabase connection is not configured correctly. Please contact an administrator and verify the deployment environment settings.';

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return typeof error === 'string' ? error : '';
}

export function isSupabaseConfigurationError(error: unknown): boolean {
    const message = getErrorMessage(error);

    return message.includes(SUPABASE_BROWSER_CONFIG_ERROR_FRAGMENT)
        || message.includes(SUPABASE_ADMIN_CONFIG_ERROR_FRAGMENT);
}
