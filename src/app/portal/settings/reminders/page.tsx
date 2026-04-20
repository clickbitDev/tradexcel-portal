'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Bell,
    Plus,
    Edit,
    Trash2,
    Loader2,
    RefreshCw,
    Pause,
    Play,
    History,
    Clock,
    Mail,
    MessageSquare,
    Smartphone
} from 'lucide-react';
import { toast } from 'sonner';
import { MentionTextarea } from '@/components/ui/mention-textarea';

type ReminderStatus = 'active' | 'paused' | 'completed' | 'expired';
type TriggerType = 'stage_duration' | 'missing_document' | 'payment_due';
type NotificationChannel = 'email' | 'whatsapp' | 'sms';

interface ReminderTriggerConfig {
    stage?: string;
    days?: number;
    document_type?: string;
    recipient?: string;
    mention_text?: string;
    mentioned_staff_ids?: string[];
}

interface ScheduledReminder {
    id: string;
    name: string;
    description: string | null;
    trigger_type: TriggerType;
    trigger_config: ReminderTriggerConfig;
    notification_channel: NotificationChannel;
    template_id: string | null;
    custom_message: string | null;
    status: ReminderStatus;
    last_run_at: string | null;
    next_run_at: string | null;
    created_at: string;
    template?: { name: string; subject: string } | null;
}

interface ReminderHistory {
    id: string;
    triggered_at: string;
    notes: string | null;
    application?: { student_first_name: string; student_last_name: string } | null;
}

const TRIGGER_TYPES: { value: TriggerType; label: string }[] = [
    { value: 'stage_duration', label: 'Stage Duration' },
    { value: 'missing_document', label: 'Missing Document' },
    { value: 'payment_due', label: 'Payment Due' },
];

const CHANNELS: { value: NotificationChannel; label: string; icon: React.ReactNode }[] = [
    { value: 'email', label: 'Email', icon: <Mail className="h-4 w-4" /> },
    { value: 'sms', label: 'SMS', icon: <Smartphone className="h-4 w-4" /> },
    { value: 'whatsapp', label: 'WhatsApp', icon: <MessageSquare className="h-4 w-4" /> },
];

const STAGES = [
    'docs_review', 'enrolled', 'evaluate', 'accounts', 'dispatch', 'completed'
];

const STATUS_COLORS: Record<ReminderStatus, string> = {
    active: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700',
    expired: 'bg-gray-100 text-gray-600',
};

export default function RemindersPage() {
    const [reminders, setReminders] = useState<ScheduledReminder[]>([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [busyReminderId, setBusyReminderId] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [history, setHistory] = useState<ReminderHistory[]>([]);
    const [selectedReminder, setSelectedReminder] = useState<ScheduledReminder | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        trigger_type: 'stage_duration' as TriggerType,
        trigger_config: {
            stage: 'docs_review',
            days: 7,
            recipient: '',
            mention_text: '',
            mentioned_staff_ids: [],
        } as ReminderTriggerConfig,
        notification_channel: 'email' as NotificationChannel,
        custom_message: '',
    });

    const isValidEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const isLikelyPhoneNumber = (value: string) => /^\+?[\d\s()-]{8,20}$/.test(value);

    useEffect(() => {
        fetchReminders({ showPageLoader: true });
    }, []);

    async function fetchReminders(options?: { showPageLoader?: boolean }) {
        const showPageLoader = options?.showPageLoader ?? false;

        if (showPageLoader) {
            setInitialLoading(true);
        } else {
            setIsRefreshing(true);
        }

        try {
            const res = await fetch('/api/reminders');
            const { data, error } = await res.json();
            if (error) throw new Error(error);
            setReminders(data || []);
        } catch (error) {
            console.error('Error fetching reminders:', error);
        } finally {
            if (showPageLoader) {
                setInitialLoading(false);
            } else {
                setIsRefreshing(false);
            }
        }
    }

    const openCreateDialog = () => {
        setSelectedReminder(null);
        setFormData({
            name: '',
            description: '',
            trigger_type: 'stage_duration',
            trigger_config: {
                stage: 'docs_review',
                days: 7,
                recipient: '',
                mention_text: '',
                mentioned_staff_ids: [],
            },
            notification_channel: 'email',
            custom_message: '',
        });
        setDialogOpen(true);
    };

    const openEditDialog = (reminder: ScheduledReminder) => {
        setSelectedReminder(reminder);
        setFormData({
            name: reminder.name,
            description: reminder.description || '',
            trigger_type: reminder.trigger_type,
            trigger_config: {
                stage: reminder.trigger_config.stage || 'docs_review',
                days: reminder.trigger_config.days || 7,
                recipient: reminder.trigger_config.recipient || '',
                mention_text: reminder.trigger_config.mention_text || '',
                mentioned_staff_ids: reminder.trigger_config.mentioned_staff_ids || [],
            },
            notification_channel: reminder.notification_channel,
            custom_message: reminder.custom_message || '',
        });
        setDialogOpen(true);
    };

    const openHistoryDialog = async (reminder: ScheduledReminder) => {
        setSelectedReminder(reminder);
        try {
            const res = await fetch(`/api/reminders/${reminder.id}?history=true`);
            const { data } = await res.json();
            setHistory(data || []);
            setHistoryOpen(true);
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    };

    const handleSave = async () => {
        const recipient = (formData.trigger_config.recipient || '').trim();
        if (!recipient) {
            toast.error('Recipient is required', {
                description: `Please enter a ${formData.notification_channel === 'email' ? 'valid email' : 'phone number'} recipient.`,
            });
            return;
        }

        if (formData.notification_channel === 'email' && !isValidEmailAddress(recipient)) {
            toast.error('Invalid email address', {
                description: 'Please enter a valid email recipient.',
            });
            return;
        }

        if ((formData.notification_channel === 'sms' || formData.notification_channel === 'whatsapp') && !isLikelyPhoneNumber(recipient)) {
            toast.error('Invalid phone number', {
                description: 'Please enter a valid phone number, preferably in international format.',
            });
            return;
        }

        const payload = {
            ...formData,
            trigger_config: {
                ...formData.trigger_config,
                recipient,
                mention_text: (formData.trigger_config.mention_text || '').trim(),
                mentioned_staff_ids: Array.from(new Set(formData.trigger_config.mentioned_staff_ids || [])),
            },
        };

        setIsSaving(true);
        try {
            const method = selectedReminder ? 'PATCH' : 'POST';
            const url = selectedReminder ? `/api/reminders/${selectedReminder.id}` : '/api/reminders';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const { error } = await res.json();
            if (error) throw new Error(error);

            await fetchReminders({ showPageLoader: false });
            setDialogOpen(false);
        } catch (error) {
            console.error('Error saving reminder:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this reminder?')) return;
        setBusyReminderId(id);
        try {
            await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
            await fetchReminders({ showPageLoader: false });
        } catch (error) {
            console.error('Error deleting reminder:', error);
        } finally {
            setBusyReminderId(null);
        }
    };

    const handleToggle = async (id: string) => {
        setBusyReminderId(id);
        try {
            await fetch(`/api/reminders/${id}?action=toggle`, { method: 'POST' });
            await fetchReminders({ showPageLoader: false });
        } catch (error) {
            console.error('Error toggling reminder:', error);
        } finally {
            setBusyReminderId(null);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString();
    };

    const getChannelIcon = (channel: NotificationChannel) => {
        const ch = CHANNELS.find(c => c.value === channel);
        return ch?.icon || <Mail className="h-4 w-4" />;
    };

    if (initialLoading) {
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
                            <Bell className="h-5 w-5" />
                            Scheduled Reminders
                        </CardTitle>
                        <CardDescription>
                            Automate reminders for applications in specific stages or with missing requirements.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => fetchReminders({ showPageLoader: false })} disabled={isRefreshing}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button type="button" onClick={openCreateDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Reminder
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="bg-muted/50 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold">{reminders.length}</div>
                            <div className="text-sm text-muted-foreground">Total</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-green-600">
                                {reminders.filter(r => r.status === 'active').length}
                            </div>
                            <div className="text-sm text-muted-foreground">Active</div>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-yellow-600">
                                {reminders.filter(r => r.status === 'paused').length}
                            </div>
                            <div className="text-sm text-muted-foreground">Paused</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-blue-600">
                                {reminders.filter(r => r.trigger_type === 'stage_duration').length}
                            </div>
                            <div className="text-sm text-muted-foreground">Stage-Based</div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Reminder</TableHead>
                                    <TableHead>Trigger</TableHead>
                                    <TableHead>Channel</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Last Run</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reminders.map((reminder) => (
                                    <TableRow key={reminder.id}>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{reminder.name}</div>
                                                {reminder.description && (
                                                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                        {reminder.description}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                <Badge variant="outline">
                                                    {TRIGGER_TYPES.find(t => t.value === reminder.trigger_type)?.label}
                                                </Badge>
                                                {reminder.trigger_type === 'stage_duration' && (
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {reminder.trigger_config.stage} &gt; {reminder.trigger_config.days} days
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {getChannelIcon(reminder.notification_channel)}
                                                <span className="capitalize">{reminder.notification_channel}</span>
                                            </div>
                                            {reminder.trigger_config.recipient && (
                                                <div className="text-xs text-muted-foreground mt-1 truncate max-w-[220px]">
                                                    {reminder.trigger_config.recipient}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={STATUS_COLORS[reminder.status]}>
                                                {reminder.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {formatDate(reminder.last_run_at)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleToggle(reminder.id)}
                                                    title={reminder.status === 'active' ? 'Pause' : 'Resume'}
                                                    disabled={busyReminderId === reminder.id}
                                                >
                                                    {busyReminderId === reminder.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : reminder.status === 'active' ? (
                                                        <Pause className="h-4 w-4" />
                                                    ) : (
                                                        <Play className="h-4 w-4" />
                                                    )}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openHistoryDialog(reminder)}
                                                    disabled={busyReminderId === reminder.id}
                                                >
                                                    <History className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEditDialog(reminder)}
                                                    disabled={busyReminderId === reminder.id}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(reminder.id)}
                                                    disabled={busyReminderId === reminder.id}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {reminders.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No reminders configured. Click &quot;Add Reminder&quot; to create one.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedReminder ? 'Edit Reminder' : 'Create Reminder'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Follow-up after 7 days in docs review"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="What triggers this reminder?"
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Trigger Type</Label>
                                <Select
                                    value={formData.trigger_type}
                                    onValueChange={(v) => setFormData({ ...formData, trigger_type: v as TriggerType })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TRIGGER_TYPES.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Notification Channel</Label>
                                <Select
                                    value={formData.notification_channel}
                                    onValueChange={(v) => setFormData({ ...formData, notification_channel: v as NotificationChannel })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CHANNELS.map((ch) => (
                                            <SelectItem key={ch.value} value={ch.value}>
                                                <div className="flex items-center gap-2">
                                                    {ch.icon} {ch.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="recipient">
                                {formData.notification_channel === 'email' ? 'Recipient Email' : 'Recipient Phone'} *
                            </Label>
                            <Input
                                id="recipient"
                                type={formData.notification_channel === 'email' ? 'email' : 'tel'}
                                value={formData.trigger_config.recipient || ''}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    trigger_config: {
                                        ...formData.trigger_config,
                                        recipient: e.target.value,
                                    },
                                })}
                                placeholder={formData.notification_channel === 'email' ? 'name@example.com' : '+61 400 000 000'}
                            />
                            <p className="text-xs text-muted-foreground">
                                {formData.notification_channel === 'email'
                                    ? 'Reminder messages will be sent to this email address.'
                                    : `Reminder messages will be sent to this ${formData.notification_channel === 'sms' ? 'SMS' : 'WhatsApp'} number.`}
                            </p>
                        </div>

                        {formData.trigger_type === 'stage_duration' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Stage</Label>
                                    <Select
                                        value={formData.trigger_config.stage}
                                        onValueChange={(v) => setFormData({
                                            ...formData,
                                            trigger_config: { ...formData.trigger_config, stage: v }
                                        })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STAGES.map((stage) => (
                                                <SelectItem key={stage} value={stage}>
                                                    {stage.replace(/_/g, ' ')}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Days in Stage</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={formData.trigger_config.days}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            trigger_config: { ...formData.trigger_config, days: parseInt(e.target.value) || 7 }
                                        })}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="custom_message">Custom Message</Label>
                            <Textarea
                                id="custom_message"
                                value={formData.custom_message}
                                onChange={(e) => setFormData({ ...formData, custom_message: e.target.value })}
                                placeholder="Leave blank to use template"
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="mention_staff">Mention Staff (Email Alert)</Label>
                            <MentionTextarea
                                value={formData.trigger_config.mention_text || ''}
                                onChange={(value) => setFormData((prev) => ({
                                    ...prev,
                                    trigger_config: {
                                        ...prev.trigger_config,
                                        mention_text: value,
                                    },
                                }))}
                                onMentionsChange={(mentions) => setFormData((prev) => ({
                                    ...prev,
                                    trigger_config: {
                                        ...prev.trigger_config,
                                        mentioned_staff_ids: mentions,
                                    },
                                }))}
                                placeholder="Type @ to mention staff members who should receive an email when this reminder triggers"
                                className="min-h-[72px]"
                            />
                            <p className="text-xs text-muted-foreground">
                                Mentioned staff receive an email each time this reminder triggers for an application.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving || !formData.name}>
                            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            {selectedReminder ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* History Dialog */}
            <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Reminder History
                        </DialogTitle>
                    </DialogHeader>

                    {selectedReminder && (
                        <div className="mb-4">
                            <div className="font-medium">{selectedReminder.name}</div>
                            <div className="text-sm text-muted-foreground">{selectedReminder.description}</div>
                        </div>
                    )}

                    <div className="max-h-[400px] overflow-y-auto">
                        {history.length > 0 ? (
                            <div className="space-y-2">
                                {history.map((entry) => (
                                    <div key={entry.id} className="border rounded-lg p-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium">
                                                {entry.application
                                                    ? `${entry.application.student_first_name} ${entry.application.student_last_name}`
                                                    : 'Unknown'}
                                            </span>
                                            <span className="text-muted-foreground">
                                                {formatDate(entry.triggered_at)}
                                            </span>
                                        </div>
                                        {entry.notes && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {entry.notes}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                No history yet. This reminder hasn&apos;t been triggered.
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setHistoryOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
