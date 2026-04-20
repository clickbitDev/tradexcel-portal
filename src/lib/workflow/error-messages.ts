const WORKFLOW_ERROR_MESSAGES: Record<string, string> = {
    APPLICATION_NOT_FOUND: 'This application could not be found.',
    WORKFLOW_CONFLICT: 'This application was updated by someone else. Refresh and try again.',
    TRANSITION_NOT_ALLOWED: 'This stage change is not available for this application.',
    TRANSITION_ROLE_FORBIDDEN: 'You do not have permission to perform this stage change.',
    WORKFLOW_ADMIN_TASKS_INCOMPLETE: 'Complete the required Docs Review tasks before moving this application to Enrolled.',
    WORKFLOW_APPROVAL_REQUIRED: 'This stage change requires approval before it can be completed.',
    WORKFLOW_APPROVAL_INVALID: 'The approval request is no longer valid. Please refresh and try again.',
    WORKFLOW_TRANSITION_UPDATE_FAILED: 'We could not update the application stage right now. Please try again.',
    WORKFLOW_TRANSITION_RULES_UNAVAILABLE: 'Workflow settings are temporarily unavailable. Please contact support if this continues.',
    WORKFLOW_APPROVALS_LOAD_FAILED: 'Unable to load approval requests right now. Please try again.',
    WORKFLOW_APPROVAL_CREATE_FAILED: 'Unable to request approval right now. Please try again.',
    WORKFLOW_APPROVAL_UPDATE_FAILED: 'Unable to update the approval request right now. Please try again.',
    WORKFLOW_ASSIGNMENTS_LOAD_FAILED: 'Unable to load stage assignments right now. Please try again.',
    WORKFLOW_ASSIGNMENT_CREATE_FAILED: 'Unable to assign this stage right now. Please try again.',
    WORKFLOW_ASSIGNMENT_UPDATE_FAILED: 'Unable to update assignment right now. Please try again.',
    WORKFLOW_ALERTS_LOAD_FAILED: 'Unable to load workflow alerts right now. Please try again.',
    WORKFLOW_ALERT_CREATE_FAILED: 'Unable to create the alert right now. Please try again.',
    WORKFLOW_ALERT_UPDATE_FAILED: 'Unable to update the alert right now. Please try again.',
    WORKFLOW_MISSING_DOCS_PREVIEW_FAILED: 'Unable to prepare the missing documents preview right now. Please try again.',
    WORKFLOW_MISSING_DOCS_EMAIL_FAILED: 'Unable to notify the agent right now. Please try again.',
    WORKFLOW_TRANSITION_OPTIONS_UNAVAILABLE: 'Unable to load available workflow actions right now. Please refresh and try again.',
};

const TECHNICAL_ERROR_PATTERNS: RegExp[] = [
    /column\s+.+\s+does not exist/i,
    /relation\s+.+\s+does not exist/i,
    /schema/i,
    /sqlstate/i,
    /syntax\s+error/i,
    /postgrest|pgrst\d+/i,
    /permission\s+denied/i,
    /constraint/i,
    /invalid\s+input\s+syntax/i,
    /failed\s+to\s+parse/i,
    /unexpected\s+token/i,
    /auth\.uid/i,
    /stack\s+trace/i,
];

export function isTechnicalErrorMessage(message: string | null | undefined): boolean {
    if (!message) {
        return false;
    }

    const normalized = message.trim();
    if (!normalized) {
        return false;
    }

    return TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function getUserFriendlyWorkflowError(input: {
    code?: string | null;
    message?: string | null;
    fallback: string;
}): string {
    const mappedMessage = input.code ? WORKFLOW_ERROR_MESSAGES[input.code] : undefined;
    if (mappedMessage) {
        return mappedMessage;
    }

    const rawMessage = input.message?.trim();
    if (!rawMessage) {
        return input.fallback;
    }

    if (isTechnicalErrorMessage(rawMessage) || rawMessage.length > 220) {
        return input.fallback;
    }

    return rawMessage;
}

export function parseWorkflowApiErrorPayload(payload: unknown): {
    code?: string;
    message?: string;
} {
    if (!payload || typeof payload !== 'object') {
        return {};
    }

    const value = payload as Record<string, unknown>;
    const code = typeof value.code === 'string' ? value.code : undefined;
    const error = typeof value.error === 'string' ? value.error : undefined;
    const message = typeof value.message === 'string' ? value.message : undefined;

    return {
        code,
        message: error || message,
    };
}

export function getWorkflowErrorFromPayload(payload: unknown, fallback: string): string {
    const parsed = parseWorkflowApiErrorPayload(payload);

    return getUserFriendlyWorkflowError({
        code: parsed.code,
        message: parsed.message,
        fallback,
    });
}

export function getWorkflowErrorFromUnknown(error: unknown, fallback: string): string {
    if (!error) {
        return fallback;
    }

    if (error instanceof Error) {
        return getUserFriendlyWorkflowError({
            message: error.message,
            fallback,
        });
    }

    if (typeof error !== 'object') {
        return fallback;
    }

    const value = error as Record<string, unknown>;
    const direct = parseWorkflowApiErrorPayload(value);
    if (direct.code || direct.message) {
        return getUserFriendlyWorkflowError({
            code: direct.code,
            message: direct.message,
            fallback,
        });
    }

    if (value.data && typeof value.data === 'object') {
        const nested = parseWorkflowApiErrorPayload(value.data);
        if (nested.code || nested.message) {
            return getUserFriendlyWorkflowError({
                code: nested.code,
                message: nested.message,
                fallback,
            });
        }
    }

    if (typeof value.error === 'string') {
        return getUserFriendlyWorkflowError({
            message: value.error,
            fallback,
        });
    }

    if (typeof value.message === 'string') {
        return getUserFriendlyWorkflowError({
            message: value.message,
            fallback,
        });
    }

    return fallback;
}
