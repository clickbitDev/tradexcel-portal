'use server';

import { prisma } from '@/lib/prisma';

type PrismaWorkflowTransitionRecord = Awaited<ReturnType<typeof prisma.workflowTransition.findFirst>>;
type PrismaWorkflowTransitionUpdateData = Parameters<typeof prisma.workflowTransition.update>[0]['data'];

// Types
export type WorkflowStage =
    | 'docs_review'
    | 'enrolled'
    | 'evaluate'
    | 'accounts'
    | 'dispatch'
    | 'completed'
    | 'rto_processing'
    | 'offer_issued'
    | 'payment_pending'
    | 'coe_issued'
    | 'visa_applied'
    | 'withdrawn'
    | 'rejected';

export interface WorkflowTransition {
    id: string;
    from_stage: WorkflowStage;
    to_stage: WorkflowStage;
    is_allowed: boolean;
    requires_approval: boolean;
    required_role: string | null;
    allowed_roles: string[] | null;
}

export interface UpdateTransitionInput {
    is_allowed?: boolean;
    requires_approval?: boolean;
    required_role?: string | null;
    allowed_roles?: string[] | null;
}

function buildTransitionUpdateData(input: UpdateTransitionInput): PrismaWorkflowTransitionUpdateData {
    const data: PrismaWorkflowTransitionUpdateData = {};

    if (typeof input.is_allowed !== 'undefined') {
        data.is_allowed = input.is_allowed;
    }

    if (typeof input.requires_approval !== 'undefined') {
        data.requires_approval = input.requires_approval;
    }

    if ('required_role' in input) {
        data.required_role = (input.required_role ?? null) as PrismaWorkflowTransitionUpdateData['required_role'];
    }

    if ('allowed_roles' in input) {
        data.allowed_roles = { set: input.allowed_roles ?? [] };
    }

    return data;
}

function mapWorkflowTransition(
    transition: Exclude<PrismaWorkflowTransitionRecord, null>
): WorkflowTransition {
    return {
        id: transition.id,
        from_stage: transition.from_stage as WorkflowStage,
        to_stage: transition.to_stage as WorkflowStage,
        is_allowed: transition.is_allowed,
        requires_approval: transition.requires_approval,
        required_role: transition.required_role,
        allowed_roles: transition.allowed_roles ?? null,
    };
}

function getErrorMessage(error: unknown): string {
    if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
    ) {
        if (error.code === 'P2025') {
            return 'Workflow transition not found';
        }

        if (error.code === 'P2002') {
            return 'Workflow transition already exists';
        }
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'Unknown database error';
}

// Workflow stages config (local use only, not exported)
const WORKFLOW_STAGES_CONFIG: { value: WorkflowStage; label: string; color: string }[] = [
    { value: 'docs_review', label: 'Docs Review', color: 'yellow' },
    { value: 'enrolled', label: 'Enrolled', color: 'green' },
    { value: 'evaluate', label: 'Evaluate', color: 'amber' },
    { value: 'accounts', label: 'Accounts', color: 'violet' },
    { value: 'dispatch', label: 'Dispatch', color: 'indigo' },
    { value: 'completed', label: 'Completed', color: 'slate' },
];

// Get workflow stages for UI display (async to comply with 'use server')
export async function getWorkflowStages(): Promise<{ value: WorkflowStage; label: string; color: string }[]> {
    return WORKFLOW_STAGES_CONFIG;
}

// Get all workflow transitions
export async function getWorkflowTransitions(): Promise<{ data: WorkflowTransition[] | null; error: string | null }> {
    try {
        const data = await prisma.workflowTransition.findMany({
            orderBy: [
                { from_stage: 'asc' },
                { to_stage: 'asc' },
            ],
        });

        return { data: data.map(mapWorkflowTransition), error: null };
    } catch (error) {
        console.error('Error fetching workflow transitions:', error);
        return { data: null, error: getErrorMessage(error) };
    }
}

// Get transitions for a specific stage
export async function getTransitionsFromStage(fromStage: WorkflowStage): Promise<{ data: WorkflowTransition[] | null; error: string | null }> {
    try {
        const data = await prisma.workflowTransition.findMany({
            where: {
                from_stage: fromStage,
                is_allowed: true,
            },
        });

        return { data: data.map(mapWorkflowTransition), error: null };
    } catch (error) {
        console.error('Error fetching transitions from stage:', error);
        return { data: null, error: getErrorMessage(error) };
    }
}

// Check if a transition is valid
export async function isValidTransition(fromStage: WorkflowStage, toStage: WorkflowStage): Promise<{ valid: boolean; requiresApproval: boolean; requiredRole: string | null; error: string | null }> {
    try {
        const data = await prisma.workflowTransition.findUnique({
            where: {
                from_stage_to_stage: {
                    from_stage: fromStage,
                    to_stage: toStage,
                },
            },
        });

        if (!data) {
            return { valid: false, requiresApproval: false, requiredRole: null, error: null };
        }

        return {
            valid: data.is_allowed,
            requiresApproval: data.requires_approval,
            requiredRole: data.required_role,
            error: null,
        };
    } catch (error) {
        return { valid: false, requiresApproval: false, requiredRole: null, error: getErrorMessage(error) };
    }
}

// Update a transition
export async function updateTransition(id: string, input: UpdateTransitionInput): Promise<{ data: WorkflowTransition | null; error: string | null }> {
    try {
        const data = await prisma.workflowTransition.update({
            where: { id },
            data: buildTransitionUpdateData(input),
        });

        return { data: mapWorkflowTransition(data), error: null };
    } catch (error) {
        console.error('Error updating transition:', error);
        return { data: null, error: getErrorMessage(error) };
    }
}

// Create a new transition
export async function createTransition(fromStage: WorkflowStage, toStage: WorkflowStage): Promise<{ data: WorkflowTransition | null; error: string | null }> {
    try {
        const data = await prisma.workflowTransition.create({
            data: {
                from_stage: fromStage,
                to_stage: toStage,
                is_allowed: true,
                requires_approval: false,
            },
        });

        return { data: mapWorkflowTransition(data), error: null };
    } catch (error) {
        console.error('Error creating transition:', error);
        return { data: null, error: getErrorMessage(error) };
    }
}

// Delete a transition
export async function deleteTransition(id: string): Promise<{ error: string | null }> {
    try {
        await prisma.workflowTransition.delete({
            where: { id },
        });

        return { error: null };
    } catch (error) {
        console.error('Error deleting transition:', error);
        return { error: getErrorMessage(error) };
    }
}

// Toggle transition allowed status
export async function toggleTransitionAllowed(id: string): Promise<{ data: WorkflowTransition | null; error: string | null }> {
    try {
        const current = await prisma.workflowTransition.findUnique({
            where: { id },
            select: { is_allowed: true },
        });

        if (!current) {
            return { data: null, error: 'Workflow transition not found' };
        }

        const data = await prisma.workflowTransition.update({
            where: { id },
            data: { is_allowed: !current.is_allowed },
        });

        return { data: mapWorkflowTransition(data), error: null };
    } catch (error) {
        return { data: null, error: getErrorMessage(error) };
    }
}

// Get transition matrix (for UI display)
export async function getTransitionMatrix(): Promise<{
    matrix: Record<string, Record<string, WorkflowTransition | null>>;
    error: string | null
}> {
    const { data: transitions, error } = await getWorkflowTransitions();

    if (error || !transitions) {
        return { matrix: {}, error };
    }

    // Build matrix
    const matrix: Record<string, Record<string, WorkflowTransition | null>> = {};

    // Initialize with null values
    for (const from of WORKFLOW_STAGES_CONFIG) {
        matrix[from.value] = {};
        for (const to of WORKFLOW_STAGES_CONFIG) {
            matrix[from.value][to.value] = null;
        }
    }

    // Fill in actual transitions
    for (const transition of transitions) {
        matrix[transition.from_stage][transition.to_stage] = transition;
    }

    return { matrix, error: null };
}
