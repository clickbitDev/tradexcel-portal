/**
 * Centralized Error Handling Utilities
 * 
 * Provides standardized error handling, logging, and user-friendly error messages
 */

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AppError extends Error {
    severity: ErrorSeverity;
    code?: string;
    userMessage: string;
    originalError?: Error;
    context?: Record<string, unknown>;
}

/**
 * Create a standardized application error
 */
export function createAppError(
    message: string,
    userMessage: string,
    severity: ErrorSeverity = 'medium',
    code?: string,
    originalError?: Error,
    context?: Record<string, unknown>
): AppError {
    const error = new Error(message) as AppError;
    error.severity = severity;
    error.userMessage = userMessage;
    error.code = code;
    error.originalError = originalError;
    error.context = context;
    return error;
}

/**
 * Get user-friendly error message from any error
 */
export function getUserErrorMessage(error: unknown): string {
    if (!error) {
        return 'An unknown error occurred. Please try again.';
    }

    // Check if it's our custom AppError
    if (typeof error === 'object' && 'userMessage' in error) {
        return (error as AppError).userMessage;
    }

    // Check for common error patterns
    if (error instanceof Error) {
        // Network errors
        if (error.message.includes('fetch') || error.message.includes('network')) {
            return 'Unable to connect to the server. Please check your internet connection and try again.';
        }

        // Timeout errors
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
            return 'The request took too long to complete. Please try again.';
        }

        // Return the error message if it looks user-friendly
        if (error.message.length < 100 && !error.message.includes('undefined')) {
            return error.message;
        }
    }

    return 'Something went wrong. Please try again later.';
}

/**
 * Log error to console with context
 */
export function logError(
    error: unknown,
    context?: Record<string, unknown>
): void {
    const timestamp = new Date().toISOString();
    const errorObj = error instanceof Error ? error : new Error(String(error));

    console.error('[Error]', {
        timestamp,
        message: errorObj.message,
        stack: errorObj.stack,
        context,
        ...(error && typeof error === 'object' ? error : {})
    });
}

/**
 * Handle API errors from Supabase
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handleSupabaseError(error: any, operation: string): AppError {
    logError(error, { operation, source: 'supabase' });

    // Authentication error
    if (error?.code === '401' || error?.message?.includes('JWT')) {
        return createAppError(
            `Supabase auth error: ${error.message}`,
            'Your session has expired. Please log in again.',
            'high',
            'AUTH_ERROR',
            error,
            { operation }
        );
    }

    // Permission error
    if (error?.code === '403' || error?.code === 'PGRST301') {
        return createAppError(
            `Supabase permission error: ${error.message}`,
            'You do not have permission to perform this action.',
            'medium',
            'PERMISSION_ERROR',
            error,
            { operation }
        );
    }

    // Connection error
    if (error?.message?.includes('fetch') || error?.message?.includes('Failed to fetch')) {
        return createAppError(
            `Supabase connection error: ${error.message}`,
            'Unable to connect to the database. Please check your connection and try again.',
            'high',
            'CONNECTION_ERROR',
            error,
            { operation }
        );
    }

    // Generic database error
    return createAppError(
        `Supabase error during ${operation}: ${error?.message || 'Unknown error'}`,
        'Failed to load data. Please try again.',
        'medium',
        'DATABASE_ERROR',
        error,
        { operation }
    );
}

/**
 * Handle network errors
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handleNetworkError(error: any, url: string): AppError {
    logError(error, { url, source: 'network' });

    if (error instanceof TypeError && error.message.includes('fetch')) {
        return createAppError(
            `Network error fetching ${url}: ${error.message}`,
            'Unable to connect to the server. Please check your internet connection.',
            'high',
            'NETWORK_ERROR',
            error,
            { url }
        );
    }

    return createAppError(
        `Request failed for ${url}: ${error?.message || 'Unknown error'}`,
        'The request failed. Please try again.',
        'medium',
        'REQUEST_ERROR',
        error,
        { url }
    );
}

/**
 * Error handler HOC for async operations
 * 
 * @example
 * ```typescript
 * const loadData = withErrorHandling(
 *   async () => {
 *     const data = await fetchData();
 *     return data;
 *   },
 *   'loading data'
 * );
 * ```
 */
export function withErrorHandling<T>(
    fn: () => Promise<T>,
    operation: string
): () => Promise<{ data: T | null; error: AppError | null }> {
    return async () => {
        try {
            const data = await fn();
            return { data, error: null };
        } catch (error) {
            const appError = error instanceof Error && 'userMessage' in error
                ? error as AppError
                : createAppError(
                    `Error during ${operation}: ${error}`,
                    getUserErrorMessage(error),
                    'medium',
                    undefined,
                    error instanceof Error ? error : undefined,
                    { operation }
                );

            logError(appError);
            return { data: null, error: appError };
        }
    };
}

/**
 * Format error for display in UI
 */
export function formatErrorForUI(error: unknown): {
    title: string;
    message: string;
    severity: ErrorSeverity;
} {
    if (typeof error === 'object' && error && 'userMessage' in error) {
        const appError = error as AppError;
        return {
            title: getErrorTitle(appError.severity),
            message: appError.userMessage,
            severity: appError.severity
        };
    }

    return {
        title: 'Error',
        message: getUserErrorMessage(error),
        severity: 'medium'
    };
}

/**
 * Get appropriate error title based on severity
 */
function getErrorTitle(severity: ErrorSeverity): string {
    switch (severity) {
        case 'low':
            return 'Notice';
        case 'medium':
            return 'Error';
        case 'high':
            return 'Important Error';
        case 'critical':
            return 'Critical Error';
        default:
            return 'Error';
    }
}
