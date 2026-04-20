'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Send,
    Mail,
    MessageSquare,
    Loader2,
    RefreshCw,
    Users,
    Filter,
    Eye,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
} from 'lucide-react';
import {
    getEligibleRecipients,
    getEmailTemplates,
    sendBulkMessages,
    getQueueStats,
    getRecentMessages,
    previewMessage,
    type Recipient,
    type MessageChannel,
    type QueuedMessage,
} from '@/lib/services/bulk-message-service';

const WORKFLOW_STAGES = [
    { value: 'docs_review', label: 'Docs Review' },
    { value: 'enrolled', label: 'Enrolled' },
    { value: 'evaluate', label: 'Evaluate' },
    { value: 'accounts', label: 'Accounts' },
    { value: 'dispatch', label: 'Dispatch' },
    { value: 'completed', label: 'Completed' },
];

const TEMPLATE_VARIABLES = [
    { key: '{{student_name}}', desc: 'Student full name' },
    { key: '{{application_id}}', desc: 'Application ID' },
    { key: '{{qualification}}', desc: 'Qualification name' },
    { key: '{{rto}}', desc: 'RTO name' },
    { key: '{{agent_name}}', desc: 'Agent/Partner name' },
    { key: '{{status}}', desc: 'Workflow status' },
];

export default function CommunicationsPage() {
    const [loading, setLoading] = useState(false);
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
    const [templates, setTemplates] = useState<Array<{ id: string; name: string; subject: string; body: string }>>([]);
    const [recentMessages, setRecentMessages] = useState<QueuedMessage[]>([]);
    const [queueStats, setQueueStats] = useState({ pending: 0, sent: 0, failed: 0 });

    // Filters
    const [selectedStages, setSelectedStages] = useState<string[]>([]);
    const [hasExpiredQual, setHasExpiredQual] = useState(false);

    // Message composition
    const [channel, setChannel] = useState<MessageChannel>('email');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    // Dialogs
    const [showPreview, setShowPreview] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ queued: number; errors: string[] } | null>(null);

    const fetchInitialData = () => Promise.all([
        getEmailTemplates(),
        getQueueStats(),
        getRecentMessages(20),
    ]);

    const loadInitialData = async () => {
        const [templatesData, statsData, messagesData] = await fetchInitialData();
        setTemplates(templatesData);
        setQueueStats(statsData);
        setRecentMessages(messagesData);
    };

    useEffect(() => {
        let isActive = true;

        const initialize = async () => {
            const [templatesData, statsData, messagesData] = await fetchInitialData();

            if (!isActive) return;
            setTemplates(templatesData);
            setQueueStats(statsData);
            setRecentMessages(messagesData);
        };

        void initialize();

        return () => {
            isActive = false;
        };
    }, []);

    const fetchRecipients = async () => {
        setLoading(true);
        const data = await getEligibleRecipients({
            workflowStages: selectedStages.length > 0 ? selectedStages : undefined,
            hasExpiredQualification: hasExpiredQual || undefined,
        });
        setRecipients(data);
        setSelectedRecipients(new Set());
        setLoading(false);
    };

    const handleTemplateChange = (templateId: string) => {
        setSelectedTemplateId(templateId);
        const template = templates.find(t => t.id === templateId);
        if (template) {
            setSubject(template.subject);
            setBody(template.body);
        }
    };

    const toggleSelectAll = () => {
        if (selectedRecipients.size === recipients.length) {
            setSelectedRecipients(new Set());
        } else {
            setSelectedRecipients(new Set(recipients.map(r => r.id)));
        }
    };

    const toggleRecipient = (id: string) => {
        const newSet = new Set(selectedRecipients);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedRecipients(newSet);
    };

    const insertVariable = (variable: string) => {
        setBody(prev => prev + variable);
    };

    const getPreviewRecipient = (): Recipient | null => {
        const firstSelectedId = Array.from(selectedRecipients)[0];
        return recipients.find(r => r.id === firstSelectedId) || recipients[0] || null;
    };

    const handleSend = async () => {
        setSending(true);
        setSendResult(null);

        const selectedList = recipients.filter(r => selectedRecipients.has(r.id));

        const result = await sendBulkMessages({
            channel,
            recipients: selectedList,
            templateId: selectedTemplateId || undefined,
            subject: channel === 'email' ? subject : undefined,
            body,
        });

        setSendResult({ queued: result.queued, errors: result.errors });
        setSending(false);
        setShowConfirm(false);

        if (result.success) {
            // Refresh stats and messages
            const [statsData, messagesData] = await Promise.all([
                getQueueStats(),
                getRecentMessages(20),
            ]);
            setQueueStats(statsData);
            setRecentMessages(messagesData);
            setSelectedRecipients(new Set());
        }
    };

    const previewRecipient = getPreviewRecipient();

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">Bulk Communications</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Send bulk emails and SMS to students and partners
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="gap-1">
                                <Clock className="h-3 w-3" />
                                {queueStats.pending} pending
                            </Badge>
                            <Badge variant="outline" className="gap-1 text-green-600 border-green-200">
                                <CheckCircle2 className="h-3 w-3" />
                                {queueStats.sent} sent
                            </Badge>
                            {queueStats.failed > 0 && (
                                <Badge variant="outline" className="gap-1 text-red-600 border-red-200">
                                    <XCircle className="h-3 w-3" />
                                    {queueStats.failed} failed
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="p-6">
                <Tabs defaultValue="compose" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="compose" className="gap-2">
                            <Send className="h-4 w-4" />
                            Compose
                        </TabsTrigger>
                        <TabsTrigger value="history" className="gap-2">
                            <Clock className="h-4 w-4" />
                            Message History
                        </TabsTrigger>
                    </TabsList>

                    {/* Compose Tab */}
                    <TabsContent value="compose" className="space-y-6">
                        <div className="grid grid-cols-3 gap-6">
                            {/* Left: Filters & Recipients */}
                            <div className="col-span-2 space-y-4">
                                {/* Filters Card */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Filter className="h-4 w-4" />
                                            Filter Recipients
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex flex-wrap gap-4">
                                            <div className="flex-1 min-w-[200px]">
                                                <Label className="text-sm mb-2 block">Workflow Stage</Label>
                                                <Select
                                                    value={selectedStages.length > 0 ? selectedStages.join(',') : 'all'}
                                                    onValueChange={(v) => setSelectedStages(v === 'all' ? [] : v.split(','))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="All stages" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All Stages</SelectItem>
                                                        {WORKFLOW_STAGES.map(stage => (
                                                            <SelectItem key={stage.value} value={stage.value}>
                                                                {stage.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex items-end gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        id="expired"
                                                        checked={hasExpiredQual}
                                                        onCheckedChange={(c) => setHasExpiredQual(c === true)}
                                                    />
                                                    <Label htmlFor="expired" className="text-sm">
                                                        Expired qualifications only
                                                    </Label>
                                                </div>
                                            </div>
                                        </div>
                                        <Button onClick={fetchRecipients} disabled={loading}>
                                            {loading ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Users className="h-4 w-4 mr-2" />
                                            )}
                                            Find Recipients
                                        </Button>
                                    </CardContent>
                                </Card>

                                {/* Recipients Table */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base">
                                                Recipients ({recipients.length})
                                            </CardTitle>
                                            {recipients.length > 0 && (
                                                <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                                                    {selectedRecipients.size === recipients.length ? 'Deselect All' : 'Select All'}
                                                </Button>
                                            )}
                                        </div>
                                        {selectedRecipients.size > 0 && (
                                            <CardDescription>
                                                {selectedRecipients.size} selected
                                            </CardDescription>
                                        )}
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {recipients.length > 0 ? (
                                            <div className="max-h-[400px] overflow-y-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-10"></TableHead>
                                                            <TableHead>Student</TableHead>
                                                            <TableHead>Contact</TableHead>
                                                            <TableHead>Qualification</TableHead>
                                                            <TableHead>Status</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {recipients.map((recipient) => (
                                                            <TableRow
                                                                key={recipient.id}
                                                                className="cursor-pointer"
                                                                onClick={() => toggleRecipient(recipient.id)}
                                                            >
                                                                <TableCell>
                                                                    <Checkbox
                                                                        checked={selectedRecipients.has(recipient.id)}
                                                                        onCheckedChange={() => toggleRecipient(recipient.id)}
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div>
                                                                        <p className="font-medium">{recipient.studentName}</p>
                                                                        <p className="text-xs text-muted-foreground">{recipient.studentUid}</p>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="text-sm">
                                                                        {channel === 'email' ? (
                                                                            recipient.studentEmail || (
                                                                                <span className="text-muted-foreground italic">No email</span>
                                                                            )
                                                                        ) : (
                                                                            recipient.studentPhone || (
                                                                                <span className="text-muted-foreground italic">No phone</span>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">
                                                                    {recipient.qualificationName}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {recipient.workflowStage.replace(/_/g, ' ')}
                                                                    </Badge>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 text-muted-foreground">
                                                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                                <p>Click &quot;Find Recipients&quot; to load students</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right: Message Composition */}
                            <div className="space-y-4">
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">Compose Message</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {/* Channel Selection */}
                                        <div>
                                            <Label className="text-sm mb-2 block">Channel</Label>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant={channel === 'email' ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setChannel('email')}
                                                    className="flex-1"
                                                >
                                                    <Mail className="h-4 w-4 mr-1" />
                                                    Email
                                                </Button>
                                                <Button
                                                    variant={channel === 'sms' ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setChannel('sms')}
                                                    className="flex-1"
                                                >
                                                    <MessageSquare className="h-4 w-4 mr-1" />
                                                    SMS
                                                </Button>
                                                <Button
                                                    variant={channel === 'whatsapp' ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setChannel('whatsapp')}
                                                    className="flex-1"
                                                >
                                                    <MessageSquare className="h-4 w-4 mr-1" />
                                                    WhatsApp
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Template Selection */}
                                        <div>
                                            <Label className="text-sm mb-2 block">Template (Optional)</Label>
                                            <Select value={selectedTemplateId || 'none'} onValueChange={(v) => handleTemplateChange(v === 'none' ? '' : v)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Choose a template..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">No template</SelectItem>
                                                    {templates.map(t => (
                                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Subject (Email only) */}
                                        {channel === 'email' && (
                                            <div>
                                                <Label htmlFor="subject" className="text-sm mb-2 block">Subject</Label>
                                                <Input
                                                    id="subject"
                                                    value={subject}
                                                    onChange={(e) => setSubject(e.target.value)}
                                                    placeholder="Enter email subject..."
                                                />
                                            </div>
                                        )}

                                        {/* Message Body */}
                                        <div>
                                            <Label htmlFor="body" className="text-sm mb-2 block">Message</Label>
                                            <Textarea
                                                id="body"
                                                value={body}
                                                onChange={(e) => setBody(e.target.value)}
                                                placeholder="Write your message..."
                                                rows={8}
                                                className="font-mono text-sm"
                                            />
                                        </div>

                                        {/* Variables */}
                                        <div>
                                            <Label className="text-xs text-muted-foreground mb-2 block">
                                                Click to insert variable
                                            </Label>
                                            <div className="flex flex-wrap gap-1">
                                                {TEMPLATE_VARIABLES.map(v => (
                                                    <Button
                                                        key={v.key}
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-xs h-7"
                                                        onClick={() => insertVariable(v.key)}
                                                    >
                                                        {v.key.replace(/{{|}}/g, '')}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1"
                                                disabled={!body || selectedRecipients.size === 0}
                                                onClick={() => setShowPreview(true)}
                                            >
                                                <Eye className="h-4 w-4 mr-1" />
                                                Preview
                                            </Button>
                                            <Button
                                                className="flex-1"
                                                disabled={!body || selectedRecipients.size === 0}
                                                onClick={() => setShowConfirm(true)}
                                            >
                                                <Send className="h-4 w-4 mr-1" />
                                                Send ({selectedRecipients.size})
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Send Result */}
                                {sendResult && (
                                    <Card className={sendResult.queued > 0 ? 'border-green-200' : 'border-red-200'}>
                                        <CardContent className="py-4">
                                            {sendResult.queued > 0 ? (
                                                <div className="flex items-center gap-2 text-green-600">
                                                    <CheckCircle2 className="h-5 w-5" />
                                                    <span>{sendResult.queued} messages queued successfully</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-red-600">
                                                    <AlertCircle className="h-5 w-5" />
                                                    <span>Failed to queue messages</span>
                                                </div>
                                            )}
                                            {sendResult.errors.length > 0 && (
                                                <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside">
                                                    {sendResult.errors.slice(0, 5).map((err, i) => (
                                                        <li key={i}>{err}</li>
                                                    ))}
                                                    {sendResult.errors.length > 5 && (
                                                        <li>...and {sendResult.errors.length - 5} more</li>
                                                    )}
                                                </ul>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* History Tab */}
                    <TabsContent value="history">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">Recent Messages</CardTitle>
                                    <Button variant="outline" size="sm" onClick={loadInitialData}>
                                        <RefreshCw className="h-4 w-4 mr-1" />
                                        Refresh
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {recentMessages.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Channel</TableHead>
                                                <TableHead>Recipient</TableHead>
                                                <TableHead>Subject/Message</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Sent</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {recentMessages.map((msg) => (
                                                <TableRow key={msg.id}>
                                                    <TableCell>
                                                        {msg.channel === 'email' ? (
                                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm">
                                                        {msg.recipient}
                                                    </TableCell>
                                                    <TableCell className="max-w-xs truncate text-muted-foreground">
                                                        {msg.subject || msg.body}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className={
                                                                msg.status === 'sent'
                                                                    ? 'text-green-600'
                                                                    : msg.status === 'failed'
                                                                        ? 'text-red-600'
                                                                        : ''
                                                            }
                                                        >
                                                            {msg.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {new Date(msg.createdAt).toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                        <p>No messages sent yet</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Message Preview</DialogTitle>
                        <DialogDescription>
                            Preview with sample recipient data
                        </DialogDescription>
                    </DialogHeader>
                    {previewRecipient && (
                        <div className="space-y-4 py-4">
                            <div className="p-3 bg-muted/50 rounded-lg text-sm">
                                <p className="text-muted-foreground">To: {previewRecipient.studentName}</p>
                            </div>
                            {channel === 'email' && subject && (
                                <div className="border rounded-lg p-3">
                                    <p className="text-xs text-muted-foreground mb-1">Subject:</p>
                                    <p className="font-medium">{previewMessage(subject, previewRecipient)}</p>
                                </div>
                            )}
                            <div className="border rounded-lg p-4 bg-card">
                                <pre className="whitespace-pre-wrap text-sm font-sans">
                                    {previewMessage(body, previewRecipient)}
                                </pre>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setShowPreview(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Send Dialog */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Send</DialogTitle>
                        <DialogDescription>
                            You are about to send {channel === 'email' ? 'an email' : 'an SMS'} to{' '}
                            <strong>{selectedRecipients.size}</strong> recipients.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                <strong>Note:</strong> Messages are queued first, then processed automatically
                                by the background notification worker.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={sending}>
                            Cancel
                        </Button>
                        <Button onClick={handleSend} disabled={sending}>
                            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Confirm & Send
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
