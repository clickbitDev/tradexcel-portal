export interface DisplayError {
    name: string | null;
    message: string | null;
    stack: string | null;
    digest: string | null;
    cause: string | null;
    code: string | null;
}

function stringOrNull(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function formatUnknownValue(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'string') {
        return stringOrNull(value);
    }

    if (value instanceof Error) {
        return value.stack || value.message || value.name;
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

export function toDisplayError(error: unknown): DisplayError {
    if (error instanceof Error) {
        const digest = 'digest' in error ? stringOrNull((error as Error & { digest?: unknown }).digest) : null;
        const cause = 'cause' in error ? formatUnknownValue((error as Error & { cause?: unknown }).cause) : null;
        const code = 'code' in error ? formatUnknownValue((error as Error & { code?: unknown }).code) : null;

        return {
            name: stringOrNull(error.name) || 'Error',
            message: stringOrNull(error.message),
            stack: stringOrNull(error.stack),
            digest,
            cause,
            code,
        };
    }

    if (typeof error === 'object' && error !== null) {
        const record = error as Record<string, unknown>;

        return {
            name: stringOrNull(record.name) || 'Error',
            message: stringOrNull(record.message) || formatUnknownValue(error),
            stack: formatUnknownValue(record.stack),
            digest: stringOrNull(record.digest),
            cause: formatUnknownValue(record.cause),
            code: formatUnknownValue(record.code),
        };
    }

    return {
        name: 'Error',
        message: formatUnknownValue(error) || 'Unknown error',
        stack: null,
        digest: null,
        cause: null,
        code: null,
    };
}

export function isMaskedServerComponentError(message: string | null | undefined): boolean {
    if (!message) {
        return false;
    }

    return message.includes('An error occurred in the Server Components render')
        && message.includes('omitted in production builds');
}
