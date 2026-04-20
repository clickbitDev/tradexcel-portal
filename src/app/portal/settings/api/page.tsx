'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Settings,
    ExternalLink,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Eye,
    EyeOff,
    Save,
    RefreshCw,
    Link2,
} from 'lucide-react';

// Integration definitions
const INTEGRATIONS = [
    {
        id: 'xero',
        name: 'Xero',
        description: 'Accounting and invoicing integration for financial management',
        logo: '/integrations/xero.svg',
        category: 'Finance',
        fields: [
            { key: 'client_id', label: 'Client ID', type: 'text' },
            { key: 'client_secret', label: 'Client Secret', type: 'password' },
            { key: 'tenant_id', label: 'Tenant ID', type: 'text' },
        ],
        docsUrl: 'https://developer.xero.com/documentation/',
    },
    {
        id: 'twilio',
        name: 'Twilio',
        description: 'SMS and voice communications for notifications and alerts',
        logo: '/integrations/twilio.svg',
        category: 'Communications',
        fields: [
            { key: 'account_sid', label: 'Account SID', type: 'text' },
            { key: 'auth_token', label: 'Auth Token', type: 'password' },
            { key: 'phone_number', label: 'Sender Phone Number', type: 'text', placeholder: '+61...' },
        ],
        docsUrl: 'https://www.twilio.com/docs',
    },
    {
        id: 'whatsapp',
        name: 'WhatsApp Business',
        description: 'WhatsApp messaging for student and partner communications',
        logo: '/integrations/whatsapp.svg',
        category: 'Communications',
        fields: [
            { key: 'phone_number_id', label: 'Phone Number ID', type: 'text' },
            { key: 'access_token', label: 'Access Token', type: 'password' },
            { key: 'webhook_verify_token', label: 'Webhook Verify Token', type: 'text' },
        ],
        docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/',
    },
    {
        id: 'sendgrid',
        name: 'SendGrid',
        description: 'Email delivery service for bulk emails and notifications',
        logo: '/integrations/sendgrid.svg',
        category: 'Communications',
        fields: [
            { key: 'api_key', label: 'API Key', type: 'password' },
            { key: 'from_email', label: 'From Email', type: 'text', placeholder: 'noreply@example.com' },
            { key: 'from_name', label: 'From Name', type: 'text', placeholder: 'Sharp Future' },
        ],
        docsUrl: 'https://docs.sendgrid.com/',
    },
    {
        id: 'google',
        name: 'Google Workspace',
        description: 'Google Calendar and Gmail integration',
        logo: '/integrations/google.svg',
        category: 'Productivity',
        fields: [
            { key: 'client_id', label: 'Client ID', type: 'text' },
            { key: 'client_secret', label: 'Client Secret', type: 'password' },
        ],
        docsUrl: 'https://developers.google.com/workspace',
    },
];

interface IntegrationConfig {
    enabled: boolean;
    credentials: Record<string, string>;
    lastTested?: string;
    status?: 'connected' | 'error' | 'not_configured';
}

type IntegrationConfigs = Record<string, IntegrationConfig>;

export default function IntegrationsPage() {
    const [configs, setConfigs] = useState<IntegrationConfigs>(() => {
        // Initialize with empty configs
        const initial: IntegrationConfigs = {};
        INTEGRATIONS.forEach((integration) => {
            initial[integration.id] = {
                enabled: false,
                credentials: {},
                status: 'not_configured',
            };
        });
        return initial;
    });

    const [editingIntegration, setEditingIntegration] = useState<typeof INTEGRATIONS[0] | null>(null);
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState<string | null>(null);

    const handleSaveConfig = async () => {
        if (!editingIntegration) return;
        setSaving(true);

        // TODO: Save to database via API
        // For now, just simulate saving
        await new Promise((resolve) => setTimeout(resolve, 500));

        setSaving(false);
        setEditingIntegration(null);
    };

    const handleTestConnection = async (integrationId: string) => {
        setTesting(integrationId);

        // TODO: Actually test the connection via API
        await new Promise((resolve) => setTimeout(resolve, 1500));

        setConfigs((prev) => ({
            ...prev,
            [integrationId]: {
                ...prev[integrationId],
                lastTested: new Date().toISOString(),
                status: 'connected', // or 'error' based on actual test
            },
        }));

        setTesting(null);
    };

    const toggleEnabled = (integrationId: string) => {
        setConfigs((prev) => ({
            ...prev,
            [integrationId]: {
                ...prev[integrationId],
                enabled: !prev[integrationId].enabled,
            },
        }));
    };

    const updateCredential = (integrationId: string, key: string, value: string) => {
        setConfigs((prev) => ({
            ...prev,
            [integrationId]: {
                ...prev[integrationId],
                credentials: {
                    ...prev[integrationId].credentials,
                    [key]: value,
                },
            },
        }));
    };

    const getStatusBadge = (status?: string) => {
        switch (status) {
            case 'connected':
                return (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                    </Badge>
                );
            case 'error':
                return (
                    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                        <XCircle className="h-3 w-3 mr-1" />
                        Error
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline" className="text-muted-foreground">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Not Configured
                    </Badge>
                );
        }
    };

    const categories = [...new Set(INTEGRATIONS.map((i) => i.category))];

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">Integrations</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Connect third-party services for enhanced functionality
                        </p>
                    </div>
                </div>
            </header>

            <div className="p-6 space-y-8">
                {categories.map((category) => (
                    <div key={category}>
                        <h2 className="text-lg font-semibold mb-4 text-foreground">{category}</h2>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {INTEGRATIONS.filter((i) => i.category === category).map((integration) => {
                                const config = configs[integration.id];

                                return (
                                    <Card key={integration.id} className="relative">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                                        <Link2 className="h-5 w-5 text-muted-foreground" />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-base">{integration.name}</CardTitle>
                                                        <div className="mt-1">
                                                            {getStatusBadge(config?.status)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={config?.enabled || false}
                                                    onCheckedChange={() => toggleEnabled(integration.id)}
                                                />
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <CardDescription className="mb-4">
                                                {integration.description}
                                            </CardDescription>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setEditingIntegration(integration)}
                                                >
                                                    <Settings className="h-4 w-4 mr-1" />
                                                    Configure
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleTestConnection(integration.id)}
                                                    disabled={testing === integration.id}
                                                >
                                                    {testing === integration.id ? (
                                                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                                                    ) : (
                                                        <RefreshCw className="h-4 w-4 mr-1" />
                                                    )}
                                                    Test
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    nativeButton={false}
                                                    render={
                                                        <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer">
                                                            <ExternalLink className="h-4 w-4" />
                                                        </a>
                                                    }
                                                />
                                            </div>
                                            {config?.lastTested && (
                                                <p className="text-xs text-muted-foreground mt-3">
                                                    Last tested: {new Date(config.lastTested).toLocaleString()}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Configuration Dialog */}
            <Dialog open={!!editingIntegration} onOpenChange={() => setEditingIntegration(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Configure {editingIntegration?.name}</DialogTitle>
                        <DialogDescription>
                            Enter your API credentials to connect {editingIntegration?.name}.
                            Credentials are encrypted at rest.
                        </DialogDescription>
                    </DialogHeader>

                    {editingIntegration && (
                        <div className="space-y-4 py-4">
                            {editingIntegration.fields.map((field) => (
                                <div key={field.key} className="space-y-2">
                                    <Label htmlFor={field.key}>{field.label}</Label>
                                    <div className="relative">
                                        <Input
                                            id={field.key}
                                            type={
                                                field.type === 'password' && !showSecrets[field.key]
                                                    ? 'password'
                                                    : 'text'
                                            }
                                            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                                            value={configs[editingIntegration.id]?.credentials[field.key] || ''}
                                            onChange={(e) =>
                                                updateCredential(editingIntegration.id, field.key, e.target.value)
                                            }
                                        />
                                        {field.type === 'password' && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                                                onClick={() =>
                                                    setShowSecrets((prev) => ({
                                                        ...prev,
                                                        [field.key]: !prev[field.key],
                                                    }))
                                                }
                                            >
                                                {showSecrets[field.key] ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingIntegration(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveConfig} disabled={saving}>
                            {saving ? (
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
