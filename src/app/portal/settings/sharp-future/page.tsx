'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Link2, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';
import { toast } from 'sonner';

type ConnectionStatus = 'pending' | 'connected' | 'disconnected' | 'error';

type ConnectionResponse = {
    sharpFutureBaseUrl: string | null;
    sharpFutureRtoId: string | null;
    publicPortalUrl: string | null;
    webhookReceiveUrl: string | null;
    connectionStatus: ConnectionStatus;
    isEnabled: boolean;
    lastConnectedAt: string | null;
    lastPingAt: string | null;
    hasTransferSecret: boolean;
};

function getStatusBadge(status: ConnectionStatus) {
    switch (status) {
        case 'connected':
            return <Badge className="bg-emerald-100 text-emerald-700">Connected</Badge>;
        case 'pending':
            return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
        case 'error':
            return <Badge className="bg-red-100 text-red-700">Error</Badge>;
        default:
            return <Badge variant="outline">Disconnected</Badge>;
    }
}

export default function SharpFutureConnectionPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [connection, setConnection] = useState<ConnectionResponse | null>(null);
    const [formData, setFormData] = useState({
        sharpFutureBaseUrl: '',
        sharpFutureRtoId: '',
        publicPortalUrl: '',
        transferSecret: '',
    });

    async function loadConnection() {
        setLoading(true);
        try {
            const response = await fetch('/api/sharp-future-connection', { cache: 'no-store' });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
                        ? payload.error
                        : 'Unable to load Sharp Future connection settings.'
                );
            }

            const data = payload && typeof payload === 'object' && 'data' in payload
                ? payload.data as ConnectionResponse
                : null;

            setConnection(data);
            setFormData((current) => ({
                ...current,
                sharpFutureBaseUrl: data?.sharpFutureBaseUrl || '',
                sharpFutureRtoId: data?.sharpFutureRtoId || '',
                publicPortalUrl: data?.publicPortalUrl || '',
                transferSecret: '',
            }));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to load Sharp Future settings.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadConnection();
    }, []);

    async function submit(action: 'save' | 'save-and-connect' | 'test') {
        if (action === 'test') {
            setTesting(true);
        } else {
            setSaving(true);
        }

        try {
            const response = await fetch('/api/sharp-future-connection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action,
                    sharpFutureBaseUrl: formData.sharpFutureBaseUrl,
                    sharpFutureRtoId: formData.sharpFutureRtoId,
                    publicPortalUrl: formData.publicPortalUrl,
                    transferSecret: formData.transferSecret || undefined,
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(
                    payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
                        ? payload.error
                        : 'Unable to save Sharp Future connection settings.'
                );
            }

            const data = payload && typeof payload === 'object' && 'data' in payload
                ? payload.data as ConnectionResponse
                : null;
            setConnection(data);
            setFormData((current) => ({
                ...current,
                transferSecret: '',
            }));

            toast.success(action === 'save' ? 'Connection settings saved.' : 'Sharp Future connection verified.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to update Sharp Future connection.');
        } finally {
            setSaving(false);
            setTesting(false);
        }
    }

    async function handleDisconnect() {
        setDisconnecting(true);
        try {
            const response = await fetch('/api/sharp-future-connection', { method: 'DELETE' });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
                        ? payload.error
                        : 'Unable to disconnect from Sharp Future.'
                );
            }

            const data = payload && typeof payload === 'object' && 'data' in payload
                ? payload.data as ConnectionResponse
                : null;
            setConnection(data);
            setFormData((current) => ({
                ...current,
                transferSecret: '',
            }));
            toast.success('Sharp Future connection disconnected.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to disconnect from Sharp Future.');
        } finally {
            setDisconnecting(false);
        }
    }

    return (
        <main className="flex-1 overflow-y-auto">
            <header className="bg-card border-b border-border px-6 py-4">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground">Sharp Future Connection</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Register this Edward Portal as an RTO spoke and keep application activity synced back to the hub.
                    </p>
                </div>
            </header>

            <div className="p-6">
                <Card className="max-w-3xl">
                    <CardHeader>
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5" />
                                    Connection Settings
                                </CardTitle>
                                <CardDescription>
                                    Save the shared RTO ID and secret from Sharp Future, then complete the signed handshake.
                                </CardDescription>
                            </div>
                            {connection ? getStatusBadge(connection.connectionStatus) : null}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {loading ? (
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading connection settings...
                            </div>
                        ) : (
                            <>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="sharp-future-base-url">Sharp Future Base URL</Label>
                                        <Input
                                            id="sharp-future-base-url"
                                            value={formData.sharpFutureBaseUrl}
                                            onChange={(event) => setFormData((current) => ({
                                                ...current,
                                                sharpFutureBaseUrl: event.target.value,
                                            }))}
                                            placeholder="https://app.sharpfuture.com.au"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="sharp-future-rto-id">RTO Portal ID</Label>
                                        <Input
                                            id="sharp-future-rto-id"
                                            value={formData.sharpFutureRtoId}
                                            onChange={(event) => setFormData((current) => ({
                                                ...current,
                                                sharpFutureRtoId: event.target.value,
                                            }))}
                                            placeholder="UUID from Sharp Future"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="public-portal-url">This Portal&apos;s Public URL</Label>
                                        <Input
                                            id="public-portal-url"
                                            value={formData.publicPortalUrl}
                                            onChange={(event) => setFormData((current) => ({
                                                ...current,
                                                publicPortalUrl: event.target.value,
                                            }))}
                                            placeholder="https://rto1.example.com"
                                        />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="transfer-secret">Transfer Secret</Label>
                                        <Input
                                            id="transfer-secret"
                                            type="password"
                                            value={formData.transferSecret}
                                            onChange={(event) => setFormData((current) => ({
                                                ...current,
                                                transferSecret: event.target.value,
                                            }))}
                                            placeholder={connection?.hasTransferSecret ? 'Stored secret available. Enter a new one to rotate.' : 'Paste the secret from Sharp Future'}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                                    <div>
                                        <span className="font-medium text-foreground">Webhook Receive URL:</span>{' '}
                                        {connection?.webhookReceiveUrl || 'Not registered yet'}
                                    </div>
                                    <div>
                                        <span className="font-medium text-foreground">Last Connected:</span>{' '}
                                        {connection?.lastConnectedAt || 'Never'}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <Button onClick={() => void submit('save')} disabled={saving || testing || disconnecting}>
                                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                                        Save
                                    </Button>
                                    <Button variant="outline" onClick={() => void submit('save-and-connect')} disabled={saving || testing || disconnecting}>
                                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                                        Save &amp; Connect
                                    </Button>
                                    <Button variant="outline" onClick={() => void submit('test')} disabled={saving || testing || disconnecting}>
                                        {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                        Test Connection
                                    </Button>
                                    <Button variant="ghost" onClick={() => void handleDisconnect()} disabled={saving || testing || disconnecting}>
                                        {disconnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Unplug className="h-4 w-4 mr-2" />}
                                        Disconnect
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
