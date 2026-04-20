'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, Unlink, ExternalLink, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface XeroConnectionStatus {
    connected: boolean;
    tenantName: string | null;
    tenantId: string | null;
    connectedAt: string | null;
    lastRefreshedAt: string | null;
    tokenExpiresAt: string | null;
    lastSyncAt: string | null;
    error: string | null;
}

// Xero brand color
const XERO_BLUE = '#13B5EA';

export function XeroConnectionCard() {
    const [status, setStatus] = useState<XeroConnectionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    const fetchStatus = async () => {
        try {
            const response = await fetch('/api/xero/status');
            if (response.ok) {
                const data = await response.json();
                setStatus(data);
            }
        } catch (error) {
            console.error('Failed to fetch Xero status:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const handleConnect = () => {
        setConnecting(true);
        // Redirect to Xero OAuth
        window.location.href = '/api/xero/auth';
    };

    const handleDisconnect = async () => {
        setDisconnecting(true);
        try {
            const response = await fetch('/api/xero/disconnect', {
                method: 'POST',
            });

            if (response.ok) {
                toast.success('Disconnected from Xero');
                setStatus({
                    connected: false,
                    tenantName: null,
                    tenantId: null,
                    connectedAt: null,
                    lastRefreshedAt: null,
                    tokenExpiresAt: null,
                    lastSyncAt: null,
                    error: null,
                });
            } else {
                const data = await response.json();
                toast.error(data.error || 'Failed to disconnect');
            }
        } catch {
            toast.error('Failed to disconnect from Xero');
        } finally {
            setDisconnecting(false);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Xero Logo */}
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                            style={{ backgroundColor: XERO_BLUE }}
                        >
                            X
                        </div>
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                Xero
                                {status?.connected ? (
                                    <Badge variant="default" className="bg-green-500">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Connected
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary">
                                        Disconnected
                                    </Badge>
                                )}
                            </CardTitle>
                            <CardDescription>
                                {status?.connected
                                    ? `Connected to ${status.tenantName || 'Xero Organization'}`
                                    : 'Connect your Xero account to sync invoices, bills, and payments'
                                }
                            </CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {status?.connected ? (
                    <>
                        {/* Connection Details */}
                        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                            <div>
                                <p className="text-xs text-muted-foreground">Organization</p>
                                <p className="font-medium">{status.tenantName || 'Unknown'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Connected On</p>
                                <p className="font-medium">{formatDate(status.connectedAt)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Last Token Refresh</p>
                                <p className="font-medium">{formatDate(status.lastRefreshedAt)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Last Sync</p>
                                <p className="font-medium">{formatDate(status.lastSyncAt)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Token Expires</p>
                                <p className="font-medium">{formatDate(status.tokenExpiresAt)}</p>
                            </div>
                        </div>

                        {/* Error State */}
                        {status.error && (
                            <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium">Connection Error</p>
                                    <p className="text-sm">{status.error}</p>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchStatus}
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh Status
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                nativeButton={false}
                                render={
                                    <a
                                        href="https://go.xero.com"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Open Xero
                                    </a>
                                }
                            />

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        disabled={disconnecting}
                                    >
                                        {disconnecting ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <Unlink className="h-4 w-4 mr-2" />
                                        )}
                                        Disconnect
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Disconnect from Xero?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will disconnect your Xero account. Invoice and bill syncing will stop.
                                            You can reconnect at any time.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDisconnect}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Disconnect
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Connect Info */}
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <p>Connecting to Xero enables:</p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>Automatic invoice sync to Xero</li>
                                <li>Bill creation in Xero for RTO payments</li>
                                <li>Contact sync (Agents → Customers, RTOs → Suppliers)</li>
                                <li>Payment recording and reconciliation</li>
                                <li>Financial reports and dashboards</li>
                            </ul>
                        </div>

                        {/* Connect Button */}
                        <Button
                            onClick={handleConnect}
                            disabled={connecting}
                            className="w-full"
                            style={{ backgroundColor: XERO_BLUE }}
                        >
                            {connecting ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Link2 className="h-4 w-4 mr-2" />
                            )}
                            Connect to Xero
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default XeroConnectionCard;
