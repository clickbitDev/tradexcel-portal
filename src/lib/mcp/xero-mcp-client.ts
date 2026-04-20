import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { existsSync } from 'node:fs';

type McpToolCallResult = {
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
};

function parseArgs(raw: string | undefined): string[] {
    if (!raw) return [];

    const normalized = raw.trim();
    const unwrapped =
        (normalized.startsWith('"') && normalized.endsWith('"')) ||
            (normalized.startsWith("'") && normalized.endsWith("'"))
            ? normalized.slice(1, -1)
            : normalized;

    try {
        const parsed = JSON.parse(unwrapped);
        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
            return parsed;
        }
    } catch {
        // fall through to whitespace split
    }
    return unwrapped.split(/\s+/).filter(Boolean);
}

function getProcessEnv(): Record<string, string> {
    return Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
}

function getMcpTransport() {
    const command = (process.env.XERO_MCP_COMMAND || 'node').trim();
    const serverPath = (process.env.XERO_MCP_SERVER_PATH || '').trim();
    const args = parseArgs(process.env.XERO_MCP_ARGS);
    const finalArgs = args.length > 0 ? args : (serverPath ? [serverPath] : []);

    if (finalArgs.length === 0) {
        throw new Error(
            'Xero MCP is enabled but not configured. Set XERO_MCP_ARGS or XERO_MCP_SERVER_PATH.'
        );
    }

    if (command === 'node') {
        const entryPoint = finalArgs.find(arg => !arg.startsWith('-'));
        if (!entryPoint) {
            throw new Error('XERO_MCP_ARGS must include a Node entrypoint when XERO_MCP_COMMAND is "node".');
        }
        if (!existsSync(entryPoint)) {
            throw new Error(`Xero MCP server not found at "${entryPoint}". Build xero-mcp-server or update XERO_MCP_SERVER_PATH.`);
        }
    }

    return new StdioClientTransport({
        command,
        args: finalArgs,
        env: getProcessEnv(),
    });
}

export async function callXeroMcpTool<TArgs extends Record<string, unknown>>(
    tool: string,
    args?: TArgs
): Promise<{ success: boolean; result?: McpToolCallResult; error?: string }> {
    const client = new Client({
        name: 'lumiere-portal',
        version: '0.1.0',
    });
    let transport: StdioClientTransport | null = null;

    try {
        transport = getMcpTransport();
        await client.connect(transport);
        const result = await client.callTool({
            name: tool,
            arguments: args || {},
        });
        return { success: true, result: result as McpToolCallResult };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'MCP tool call failed',
        };
    } finally {
        try {
            await client.close();
        } catch {
            // ignore
        }
        if (transport) {
            try {
                await transport.close();
            } catch {
                // ignore
            }
        }
    }
}

export async function listXeroMcpTools(): Promise<{ success: boolean; tools?: unknown; error?: string }> {
    const client = new Client({
        name: 'lumiere-portal',
        version: '0.1.0',
    });
    let transport: StdioClientTransport | null = null;

    try {
        transport = getMcpTransport();
        await client.connect(transport);
        const tools = await client.listTools();
        return { success: true, tools };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'MCP listTools failed',
        };
    } finally {
        try {
            await client.close();
        } catch {
            // ignore
        }
        if (transport) {
            try {
                await transport.close();
            } catch {
                // ignore
            }
        }
    }
}
