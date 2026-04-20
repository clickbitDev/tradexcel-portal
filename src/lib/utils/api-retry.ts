/**
 * API Retry Utility with Exponential Backoff
 * 
 * Provides robust retry logic for API calls that may fail due to network issues,
 * rate limiting, or temporary server problems.
 */

export interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: Error) => boolean;
    onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
    shouldRetry: (error: Error) => {
        // Retry on network errors and 5xx server errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return true;
        }
        if ('status' in error && typeof error.status === 'number') {
            return error.status >= 500 && error.status < 600;
        }
        return true;
    },
    onRetry: () => { /* no-op */ }
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
    const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt);
    const delay = Math.min(exponentialDelay, options.maxDelay);
    // Add jitter (random variation) to prevent thundering herd
    const jitter = delay * 0.1 * Math.random();
    return delay + jitter;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * 
 * @example
 * ```typescript
 * const data = await retryWithBackoff(
 *   async () => {
 *     const response = await fetch('/api/data');
 *     if (!response.ok) throw new Error('Failed to fetch');
 *     return response.json();
 *   },
 *   {
 *     maxRetries: 3,
 *     onRetry: (error, attempt) => {
 *       console.log(`Retry attempt ${attempt} after error:`, error.message);
 *     }
 *   }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    userOptions: RetryOptions = {}
): Promise<T> {
    const options: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...userOptions };
    let lastError: Error;

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Don't retry if we've exhausted attempts
            if (attempt >= options.maxRetries) {
                break;
            }

            // Check if we should retry this error
            if (!options.shouldRetry(lastError)) {
                throw lastError;
            }

            // Call retry callback
            options.onRetry(lastError, attempt + 1);

            // Wait before retrying
            const delay = calculateDelay(attempt, options);
            await sleep(delay);
        }
    }

    // If we get here, all retries failed
    throw lastError!;
}

/**
 * Retry a Supabase query with exponential backoff
 * 
 * @example
 * ```typescript
 * const { data, error } = await retrySupabaseQuery(
 *   () => supabase.from('users').select('*'),
 *   { maxRetries: 3 }
 * );
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function retrySupabaseQuery<T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => Promise<{ data: T | null; error: any }>,
    options: RetryOptions = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ data: T | null; error: any }> {
    return retryWithBackoff(async () => {
        const result = await queryFn();

        // If there's an error, throw it so retry logic can handle it
        if (result.error) {
            const error = new Error(result.error.message || 'Supabase query failed');
            Object.assign(error, { status: result.error.code });
            throw error;
        }

        return result;
    }, {
        ...options,
        shouldRetry: (error) => {
            // Don't retry on authentication errors
            if ('status' in error && error.status === 401) {
                return false;
            }
            // Don't retry on permission errors
            if ('status' in error && error.status === 403) {
                return false;
            }
            // Use default retry logic for other errors
            return options.shouldRetry ? options.shouldRetry(error) : DEFAULT_OPTIONS.shouldRetry(error);
        }
    });
}

/**
 * Retry a fetch request with exponential backoff
 * 
 * @example
 * ```typescript
 * const data = await retryFetch('/api/users', {
 *   method: 'GET'
 * }, {
 *   maxRetries: 3
 * });
 * ```
 */
export async function retryFetch(
    url: string,
    init?: RequestInit,
    options: RetryOptions = {}
): Promise<Response> {
    return retryWithBackoff(async () => {
        const response = await fetch(url, init);

        // Throw on error status to trigger retry
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            Object.assign(error, { status: response.status });
            throw error;
        }

        return response;
    }, options);
}
