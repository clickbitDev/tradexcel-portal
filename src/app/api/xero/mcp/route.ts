/**
 * Xero MCP Route
 * POST /api/xero/mcp - Proxy MCP tool calls for Xero debugging
 * GET /api/xero/mcp - List available MCP tools
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import { callXeroMcpTool, listXeroMcpTools } from '@/lib/mcp/xero-mcp-client';

function isMcpEnabled(): boolean {
    return (process.env.XERO_MCP_ENABLED || '').toLowerCase() === 'true';
}

export async function GET() {
    try {
        if (!isMcpEnabled()) {
            return NextResponse.json({ error: 'Xero MCP is disabled' }, { status: 503 });
        }

        const authz = await authorizeApiRequest({
            resource: 'integration',
            action: 'manage_integrations',
            allowedRoles: ['developer'],
        });
        if (!authz.ok) {
            return authz.response;
        }

        const result = await listXeroMcpTools();
        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Failed to list tools' }, { status: 500 });
        }

        return NextResponse.json({ tools: result.tools });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'MCP list failed' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!isMcpEnabled()) {
            return NextResponse.json({ error: 'Xero MCP is disabled' }, { status: 503 });
        }

        const authz = await authorizeApiRequest({
            request,
            resource: 'integration',
            action: 'manage_integrations',
            allowedRoles: ['developer'],
        });
        if (!authz.ok) {
            return authz.response;
        }

        const body = await request.json();
        const tool = body?.tool as string | undefined;
        const args = (body?.args ?? {}) as Record<string, unknown>;

        if (!tool) {
            return NextResponse.json({ error: 'Missing tool name' }, { status: 400 });
        }

        const result = await callXeroMcpTool(tool, args);
        if (!result.success) {
            return NextResponse.json({ error: result.error || 'MCP tool call failed' }, { status: 500 });
        }

        return NextResponse.json({ result: result.result });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'MCP call failed' },
            { status: 500 }
        );
    }
}
