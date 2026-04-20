import { createServerClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AlertTriangle,
    Database,
    Edit,
    Eye,
    Plus,
    RefreshCw,
    Shield,
    Trash2,
} from 'lucide-react';

// Force dynamic rendering to prevent build-time prerendering
export const dynamic = 'force-dynamic';

type UserRole =
    | 'ceo'
    | 'executive_manager'
    | 'admin'
    | 'accounts_manager'
    | 'assessor'
    | 'dispatch_coordinator'
    | 'frontdesk'
    | 'developer'
    | 'agent';

type UnifiedAuditEntry = {
    id: string;
    created_at: string;
    action: string;
    table_name: string;
    record_id: string | null;
    user_id: string | null;
    user_name: string | null;
    ip_address: string | null;
    summary: string;
    source: 'record_activity' | 'audit_logs';
};

const ACTION_COLORS: Record<string, string> = {
    insert: 'bg-green-100 text-green-700',
    create: 'bg-green-100 text-green-700',
    created: 'bg-green-100 text-green-700',
    update: 'bg-blue-100 text-blue-700',
    updated: 'bg-blue-100 text-blue-700',
    delete: 'bg-red-100 text-red-700',
    deleted: 'bg-red-100 text-red-700',
    select: 'bg-gray-100 text-gray-700',
};

const ACTION_ICONS = {
    insert: Plus,
    create: Plus,
    created: Plus,
    update: Edit,
    updated: Edit,
    delete: Trash2,
    deleted: Trash2,
    select: Eye,
};

const DEFAULT_AUDIT_ACCESS_ROLES = new Set<UserRole>([
    'ceo',
    'developer',
    'admin',
    'executive_manager',
]);

function normalizeAction(action: string): string {
    return action.trim().toLowerCase();
}

function formatAction(action: string): string {
    const normalized = normalizeAction(action);
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('en-AU');
}

function compactId(value: string | null, fallback: string): string {
    if (!value) return fallback;
    return value.length > 12 ? `${value.slice(0, 12)}...` : value;
}

function prettifyTableName(tableName: string): string {
    return tableName.replace(/_/g, ' ');
}

export default async function AuditLogsPage() {
    const supabase = await createServerClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return (
            <main className="flex-1 overflow-y-auto">
                <div className="p-6">
                    <Card className="p-8 text-center">
                        <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-red-500" />
                        <h3 className="text-lg font-medium mb-2">Session expired</h3>
                        <p className="text-muted-foreground">Please sign in to access audit logs.</p>
                    </Card>
                </div>
            </main>
        );
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    const role = (profile?.role || null) as UserRole | null;

    let hasAuditPermission = role ? DEFAULT_AUDIT_ACCESS_ROLES.has(role) : false;

    if (role) {
        const { data: permissionRow, error: permissionError } = await supabase
            .from('role_permissions')
            .select('granted')
            .eq('role', role)
            .eq('permission_key', 'audit.view')
            .maybeSingle();

        if (!permissionError && permissionRow) {
            hasAuditPermission = permissionRow.granted;
        }
    }

    if (!hasAuditPermission) {
        return (
            <main className="flex-1 overflow-y-auto">
                <header className="bg-card border-b border-border px-6 py-4">
                    <h1 className="text-2xl font-semibold text-foreground">Audit Logs</h1>
                    <p className="text-sm text-muted-foreground mt-1">Track all system changes and user actions</p>
                </header>
                <div className="p-6">
                    <Card className="p-8 text-center">
                        <Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                        <h3 className="text-lg font-medium mb-2">Access restricted</h3>
                        <p className="text-muted-foreground">You do not have permission to view audit logs.</p>
                    </Card>
                </div>
            </main>
        );
    }

    let logs: UnifiedAuditEntry[] = [];
    let source: 'record_activity' | 'audit_logs' | null = null;
    let queryError: string | null = null;

    const { data: activityLogs, error: activityError } = await supabase
        .from('record_activity')
        .select('id, table_name, record_id, action, summary, user_id, user_name, ip_address, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

    if (!activityError && activityLogs && activityLogs.length > 0) {
        logs = activityLogs.map((log) => ({
            id: log.id,
            created_at: log.created_at,
            action: log.action,
            table_name: log.table_name,
            record_id: log.record_id,
            user_id: log.user_id,
            user_name: log.user_name,
            ip_address: log.ip_address,
            summary: log.summary || `${log.action} on ${log.table_name}`,
            source: 'record_activity',
        }));
        source = 'record_activity';
    } else {
        const { data: auditLogs, error: auditError } = await supabase
            .from('audit_logs')
            .select('id, user_id, action, table_name, record_id, ip_address, created_at')
            .order('created_at', { ascending: false })
            .limit(200);

        if (!auditError && auditLogs) {
            logs = auditLogs.map((log) => ({
                id: log.id,
                created_at: log.created_at,
                action: log.action,
                table_name: log.table_name,
                record_id: log.record_id,
                user_id: log.user_id,
                user_name: null,
                ip_address: log.ip_address,
                summary: `${log.action} on ${log.table_name}`,
                source: 'audit_logs',
            }));
            source = 'audit_logs';
        } else {
            queryError = activityError?.message || auditError?.message || 'Failed to load audit entries';
        }
    }

    const uniqueEntities = new Set(logs.map((log) => log.table_name)).size;
    const uniqueActions = new Set(logs.map((log) => normalizeAction(log.action))).size;

    return (
        <main className="flex-1 overflow-y-auto">
            <header className="bg-card border-b border-border px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">Audit Logs</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Track system changes and staff activity timeline.
                        </p>
                    </div>
                    {source && (
                        <Badge variant="outline" className="capitalize">
                            Source: {source.replace('_', ' ')}
                        </Badge>
                    )}
                </div>
            </header>

            <div className="p-6 space-y-6">
                {queryError && (
                    <Card className="p-5 border-red-200 bg-red-50/50">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                            <div>
                                <p className="font-medium text-red-700">Unable to load audit entries</p>
                                <p className="text-sm text-red-600 mt-1">{queryError}</p>
                            </div>
                        </div>
                    </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4">
                        <div className="text-sm text-muted-foreground">Entries Loaded</div>
                        <div className="text-2xl font-semibold mt-1">{logs.length}</div>
                    </Card>
                    <Card className="p-4">
                        <div className="text-sm text-muted-foreground">Entities</div>
                        <div className="text-2xl font-semibold mt-1">{uniqueEntities}</div>
                    </Card>
                    <Card className="p-4">
                        <div className="text-sm text-muted-foreground">Action Types</div>
                        <div className="text-2xl font-semibold mt-1">{uniqueActions}</div>
                    </Card>
                </div>

                {logs.length > 0 ? (
                    <div className="bg-card rounded-lg border border-border overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Timestamp</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Entity</TableHead>
                                        <TableHead>Summary</TableHead>
                                        <TableHead>Actor</TableHead>
                                        <TableHead>IP Address</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => {
                                        const normalizedAction = normalizeAction(log.action);
                                        const ActionIcon = ACTION_ICONS[normalizedAction as keyof typeof ACTION_ICONS] || RefreshCw;
                                        return (
                                            <TableRow key={`${log.source}-${log.id}`} className="hover:bg-muted/50">
                                                <TableCell className="text-sm whitespace-nowrap">
                                                    {formatDate(log.created_at)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={ACTION_COLORS[normalizedAction] || 'bg-gray-100 text-gray-700'}>
                                                        <ActionIcon className="h-3 w-3 mr-1" />
                                                        {formatAction(log.action)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm font-medium capitalize">{prettifyTableName(log.table_name)}</div>
                                                    <div className="text-xs text-muted-foreground font-mono" title={log.record_id || ''}>
                                                        {compactId(log.record_id, '-')}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm max-w-[420px]">
                                                    <div className="truncate" title={log.summary}>{log.summary}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm">{log.user_name || 'System'}</div>
                                                    <div className="text-xs text-muted-foreground font-mono" title={log.user_id || ''}>
                                                        {compactId(log.user_id, '-')}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground font-mono">
                                                    {log.ip_address || '-'}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ) : (
                    <Card className="p-12 text-center">
                        <Database className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="text-lg font-medium mb-2">No audit entries found</h3>
                        <p className="text-muted-foreground">
                            No data returned from the configured audit source.
                        </p>
                    </Card>
                )}
            </div>
        </main>
    );
}
