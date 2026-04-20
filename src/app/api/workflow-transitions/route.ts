import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import {
    getWorkflowTransitions,
    updateTransition,
    toggleTransitionAllowed,
    getTransitionMatrix,
    type UpdateTransitionInput
} from '@/lib/services/workflow-admin-service';

export async function GET(request: NextRequest) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'workflow_transition',
        action: 'manage_workflows',
    });
    if (!authz.ok) {
        return authz.response;
    }

    const url = new URL(request.url);
    const matrix = url.searchParams.get('matrix');

    if (matrix === 'true') {
        const { matrix: data, error } = await getTransitionMatrix();
        if (error) {
            return NextResponse.json({ error }, { status: 500 });
        }
        return NextResponse.json({ data });
    }

    const { data, error } = await getWorkflowTransitions();

    if (error) {
        return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
    const authz = await authorizeApiRequest({
        request,
        resource: 'workflow_transition',
        action: 'manage_workflows',
    });
    if (!authz.ok) {
        return authz.response;
    }

    try {
        const body = await request.json();
        const { id, action, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing transition id' }, { status: 400 });
        }

        if (action === 'toggle') {
            const { data, error } = await toggleTransitionAllowed(id);
            if (error) {
                return NextResponse.json({ error }, { status: 500 });
            }
            return NextResponse.json({ data });
        }

        const { data, error } = await updateTransition(id, updates as UpdateTransitionInput);

        if (error) {
            return NextResponse.json({ error }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
