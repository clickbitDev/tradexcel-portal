'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    GitBranch,
    Loader2,
    RefreshCw,
    Check,
    X,
    Shield,
    AlertCircle
} from 'lucide-react';
import { usePolicyPermission } from '@/hooks/usePolicyPermission';
import type { UserRole } from '@/types/database';

type WorkflowStage =
    | 'docs_review'
    | 'enrolled'
    | 'evaluate'
    | 'accounts'
    | 'dispatch'
    | 'completed';

interface WorkflowTransition {
    id: string;
    from_stage: WorkflowStage;
    to_stage: WorkflowStage;
    is_allowed: boolean;
    requires_approval: boolean;
    required_role: UserRole | null;
}

const STAGES: { value: WorkflowStage; label: string; color: string }[] = [
    { value: 'docs_review', label: 'Docs Review', color: 'bg-yellow-200' },
    { value: 'enrolled', label: 'Enrolled', color: 'bg-green-200' },
    { value: 'evaluate', label: 'Evaluate', color: 'bg-amber-200' },
    { value: 'accounts', label: 'Accounts', color: 'bg-violet-200' },
    { value: 'dispatch', label: 'Dispatch', color: 'bg-indigo-200' },
    { value: 'completed', label: 'Completed', color: 'bg-slate-200' },
];

const ROLES: UserRole[] = [
    'ceo',
    'executive_manager',
    'admin',
    'accounts_manager',
    'assessor',
    'dispatch_coordinator',
    'frontdesk',
    'developer',
    'agent',
];

export default function WorkflowsPage() {
    const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);
    const { can: canPolicyAction, loading: policyLoading } = usePolicyPermission();

    const canManageWorkflows = canPolicyAction('manage_workflows', 'WorkflowTransition');

    useEffect(() => {
        fetchTransitions();
    }, []);

    useEffect(() => {
        if (!policyLoading && canManageWorkflows && authError) {
            fetchTransitions();
        }
    }, [policyLoading, canManageWorkflows, authError]);

    async function fetchTransitions() {
        setLoading(true);
        setAuthError(null);
        try {
            const res = await fetch('/api/workflow-transitions');

            if (res.status === 403) {
                setTransitions([]);
                setAuthError('You do not have permission to view workflow transition settings.');
                return;
            }

            const { data, error } = await res.json();
            if (error) throw new Error(error);
            setTransitions(data || []);
        } catch (error) {
            console.error('Error fetching transitions:', error);
        } finally {
            setLoading(false);
        }
    }

    const getTransition = (from: WorkflowStage, to: WorkflowStage): WorkflowTransition | undefined => {
        return transitions.find(t => t.from_stage === from && t.to_stage === to);
    };

    const handleToggleAllowed = async (transition: WorkflowTransition) => {
        if (!canManageWorkflows) return;
        setUpdating(transition.id);
        try {
            await fetch('/api/workflow-transitions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: transition.id, action: 'toggle' }),
            });
            await fetchTransitions();
        } catch (error) {
            console.error('Error toggling transition:', error);
        } finally {
            setUpdating(null);
        }
    };

    const handleToggleApproval = async (transition: WorkflowTransition) => {
        if (!canManageWorkflows) return;
        setUpdating(transition.id);
        try {
            await fetch('/api/workflow-transitions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: transition.id, requires_approval: !transition.requires_approval }),
            });
            await fetchTransitions();
        } catch (error) {
            console.error('Error updating transition:', error);
        } finally {
            setUpdating(null);
        }
    };

    const handleSetRole = async (transition: WorkflowTransition, role: UserRole | null) => {
        if (!canManageWorkflows) return;
        setUpdating(transition.id);
        try {
            await fetch('/api/workflow-transitions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: transition.id, required_role: role }),
            });
            await fetchTransitions();
        } catch (error) {
            console.error('Error updating transition:', error);
        } finally {
            setUpdating(null);
        }
    };

    // Get active stages (non-terminal)
    const activeStages = STAGES;
    const allStages = STAGES;

    if (loading || policyLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <GitBranch className="h-5 w-5" />
                            Workflow Transitions
                        </CardTitle>
                        <CardDescription>
                            Configure allowed stage transitions for applications. Control which stages can flow to others.
                        </CardDescription>
                    </div>
                    <Button variant="outline" onClick={fetchTransitions} disabled={!canManageWorkflows}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </CardHeader>
                <CardContent>
                    {authError && (
                        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            {authError}
                        </div>
                    )}

                    {/* Legend */}
                    <div className="flex items-center gap-6 mb-6 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded flex items-center justify-center bg-green-100 text-green-600">
                                <Check className="h-4 w-4" />
                            </div>
                            <span>Allowed</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded flex items-center justify-center bg-red-100 text-red-600">
                                <X className="h-4 w-4" />
                            </div>
                            <span>Blocked</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-orange-500" />
                            <span>Requires Approval</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-gray-100"></div>
                            <span>Not Configured</span>
                        </div>
                    </div>

                    {/* Transition Matrix */}
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th className="p-2 border bg-muted font-medium text-left">From \\ To</th>
                                    {allStages.map(stage => (
                                        <th key={stage.value} className={`p-2 border ${stage.color} font-medium text-center min-w-[80px]`}>
                                            <div className="text-xs truncate">{stage.label}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {activeStages.map(fromStage => (
                                    <tr key={fromStage.value}>
                                        <td className={`p-2 border ${fromStage.color} font-medium`}>
                                            {fromStage.label}
                                        </td>
                                        {allStages.map(toStage => {
                                            const transition = getTransition(fromStage.value, toStage.value);
                                            const isSame = fromStage.value === toStage.value;

                                            if (isSame) {
                                                return (
                                                    <td key={toStage.value} className="p-2 border bg-gray-50 text-center">
                                                        <span className="text-gray-400">-</span>
                                                    </td>
                                                );
                                            }

                                            if (!transition) {
                                                return (
                                                    <td key={toStage.value} className="p-2 border bg-gray-50 text-center">
                                                        <span className="text-gray-300">—</span>
                                                    </td>
                                                );
                                            }

                                            return (
                                                <TooltipProvider key={toStage.value}>
                                                    <Tooltip>
                                                        <TooltipTrigger render={
                                                            <td
                                                                className={`p-2 border text-center cursor-pointer hover:opacity-80 transition-opacity ${transition.is_allowed ? 'bg-green-50' : 'bg-red-50'
                                                                    }`}
                                                                onClick={() => handleToggleAllowed(transition)}
                                                            >
                                                                {updating === transition.id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                                                ) : (
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        {transition.is_allowed ? (
                                                                            <Check className="h-4 w-4 text-green-600" />
                                                                        ) : (
                                                                            <X className="h-4 w-4 text-red-600" />
                                                                        )}
                                                                        {transition.requires_approval && (
                                                                            <Shield className="h-3 w-3 text-orange-500" />
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        } />
                                                        <TooltipContent side="top" className="max-w-xs">
                                                            <div className="space-y-2 p-1">
                                                                <div className="font-medium">
                                                                    {fromStage.label} → {toStage.label}
                                                                </div>
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <span>Allowed:</span>
                                                                    <Badge variant={transition.is_allowed ? 'default' : 'destructive'}>
                                                                        {transition.is_allowed ? 'Yes' : 'No'}
                                                                    </Badge>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <span>Approval:</span>
                                                                    <Switch
                                                                        checked={transition.requires_approval}
                                                                        onCheckedChange={() => handleToggleApproval(transition)}
                                                                    />
                                                                </div>
                                                                {transition.requires_approval && (
                                                                    <div className="flex items-center gap-2 text-sm">
                                                                        <span>Role:</span>
                                                                             <Select
                                                                                 value={transition.required_role || '__any__'}
                                                                                 onValueChange={(v) => handleSetRole(transition, v === '__any__' ? null : (v as UserRole))}
                                                                             >
                                                                            <SelectTrigger className="h-7 w-24">
                                                                                <SelectValue placeholder="Any" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="__any__">Any</SelectItem>
                                                                                {ROLES.map(role => (
                                                                                    <SelectItem key={role} value={role}>
                                                                                        {role}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                )}
                                                                <p className="text-xs text-muted-foreground">
                                                                    Click cell to toggle allowed status
                                                                </p>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary */}
                    <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-blue-500" />
                            <span className="font-medium text-sm">Transition Summary</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground">Total Configured: </span>
                                <span className="font-medium">{transitions.length}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Allowed: </span>
                                <span className="font-medium text-green-600">
                                    {transitions.filter(t => t.is_allowed).length}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Requiring Approval: </span>
                                <span className="font-medium text-orange-600">
                                    {transitions.filter(t => t.requires_approval).length}
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
