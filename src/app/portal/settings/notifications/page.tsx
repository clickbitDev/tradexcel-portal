'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Bell, Mail, MessageSquare, Users, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationSetting {
    id: string;
    label: string;
    description: string;
    icon: React.ElementType;
    email: boolean;
    inApp: boolean;
}

const defaultSettings: NotificationSetting[] = [
    {
        id: 'new_application',
        label: 'New Applications',
        description: 'Get notified when a new application is submitted',
        icon: FileText,
        email: true,
        inApp: true,
    },
    {
        id: 'status_change',
        label: 'Status Changes',
        description: 'Notifications when application status changes',
        icon: AlertTriangle,
        email: true,
        inApp: true,
    },
    {
        id: 'comments',
        label: 'Comments & Mentions',
        description: 'When someone mentions you or comments on your applications',
        icon: MessageSquare,
        email: true,
        inApp: true,
    },
    {
        id: 'team_updates',
        label: 'Team Updates',
        description: 'Updates about team members and role changes',
        icon: Users,
        email: false,
        inApp: true,
    },
    {
        id: 'document_upload',
        label: 'Document Uploads',
        description: 'When documents are uploaded to applications',
        icon: FileText,
        email: false,
        inApp: true,
    },
];

export default function NotificationsPage() {
    const [settings, setSettings] = useState<NotificationSetting[]>(defaultSettings);
    const [saving, setSaving] = useState(false);

    const toggleSetting = (id: string, type: 'email' | 'inApp') => {
        setSettings(prev =>
            prev.map(setting =>
                setting.id === id
                    ? { ...setting, [type]: !setting[type] }
                    : setting
            )
        );
    };

    const handleSave = async () => {
        setSaving(true);
        // TODO: Save to database when notification_preferences table is created
        await new Promise(resolve => setTimeout(resolve, 500));
        setSaving(false);
        toast.success('Notification preferences saved');
    };

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Notification Settings</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage how you receive notifications
                        </p>
                    </div>
                    <Button onClick={handleSave} disabled={saving} className="self-start sm:self-auto">
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </header>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Global Toggle */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5" />
                            Global Notifications
                        </CardTitle>
                        <CardDescription>
                            Master controls for all notifications
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Mail className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <Label>Email Notifications</Label>
                                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                                </div>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Bell className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <Label>In-App Notifications</Label>
                                    <p className="text-sm text-muted-foreground">Show notifications in the portal</p>
                                </div>
                            </div>
                            <Switch defaultChecked />
                        </div>
                    </CardContent>
                </Card>

                {/* Individual Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Notification Types</CardTitle>
                        <CardDescription>
                            Choose which notifications you want to receive
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {settings.map((setting) => {
                                const Icon = setting.icon;
                                return (
                                    <div key={setting.id} className="flex flex-col sm:flex-row sm:items-start justify-between py-4 border-b border-border last:border-0 gap-3">
                                        <div className="flex items-start gap-3">
                                            <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                            <div>
                                                <Label className="font-medium">{setting.label}</Label>
                                                <p className="text-sm text-muted-foreground">{setting.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 sm:gap-6 ml-8 sm:ml-0">
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={setting.email}
                                                    onCheckedChange={() => toggleSetting(setting.id, 'email')}
                                                />
                                                <Label className="text-sm text-muted-foreground">Email</Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={setting.inApp}
                                                    onCheckedChange={() => toggleSetting(setting.id, 'inApp')}
                                                />
                                                <Label className="text-sm text-muted-foreground">In-App</Label>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Coming Soon */}
                <Card className="bg-muted/50">
                    <CardContent className="p-6 text-center">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                        <h3 className="font-medium mb-1">More notification options coming soon</h3>
                        <p className="text-sm text-muted-foreground">
                            We&apos;re working on Slack, SMS, and webhook integrations
                        </p>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
