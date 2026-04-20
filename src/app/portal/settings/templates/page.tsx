'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Plus,
    Mail,
    Edit,
    Trash2,
    Copy,
    Loader2,
    RefreshCw,
    Search,
    Code,
    Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import {
    EMAIL_TEMPLATE_PRESETS,
    EMAIL_TEMPLATE_VARIABLES,
    renderEmailTemplate,
    type EmailTemplatePreset,
} from '@/lib/email-templates/presets';

interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
    variables: string[];
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export default function EmailTemplatesPage() {
    const { can, loading: permissionsLoading } = usePermissions();
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
    const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        subject: '',
        body: '',
        variables: [] as string[],
        is_active: true,
    });

    const canManageTemplates = can('templates.manage');

    const getTemplateErrorMessage = useCallback((error: { message?: string; code?: string } | null, fallback: string) => {
        if (!error) {
            return fallback;
        }

        if (error.code === '23505') {
            return 'A template with this name already exists.';
        }

        if (error.code === '42501') {
            return 'You do not have permission to manage email templates.';
        }

        return error.message || fallback;
    }, []);

    const getResponseErrorMessage = useCallback(async (response: Response, fallback: string) => {
        const payload = await response.json().catch(() => null) as { error?: string; code?: string } | null;
        return getTemplateErrorMessage(payload, fallback);
    }, [getTemplateErrorMessage]);

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        const response = await fetch('/api/email-templates', {
            credentials: 'same-origin',
            cache: 'no-store',
        });

        if (!response.ok) {
            setTemplates([]);
            toast.error('Unable to load email templates', {
                description: await getResponseErrorMessage(response, 'Please try again.'),
            });
            setLoading(false);
            return;
        }

        const payload = await response.json() as { data?: EmailTemplate[] };

        setTemplates(payload.data || []);
        setLoading(false);
    }, [getResponseErrorMessage]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void fetchTemplates();
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [fetchTemplates]);

    const openCreateDialog = () => {
        setEditingTemplate(null);
        setFormData({
            name: '',
            subject: '',
            body: '',
            variables: [],
            is_active: true,
        });
        setIsDialogOpen(true);
    };

    const openPresetDialog = (preset: EmailTemplatePreset) => {
        const existingTemplate = templates.find((template) => template.name === preset.name) || null;

        if (existingTemplate) {
            openEditDialog(existingTemplate);
            toast.info(`Editing existing template: ${preset.name}`);
            return;
        }

        setEditingTemplate(null);
        setFormData({
            name: preset.name,
            subject: preset.subject,
            body: preset.body,
            variables: preset.body ? EMAIL_TEMPLATE_VARIABLES.filter((variable) => preset.body.includes(variable.key) || preset.subject.includes(variable.key)).map((variable) => variable.key) : [],
            is_active: true,
        });
        setIsDialogOpen(true);
    };

    const openEditDialog = (template: EmailTemplate) => {
        setEditingTemplate(template);
        setFormData({
            name: template.name,
            subject: template.subject,
            body: template.body,
            variables: template.variables || [],
            is_active: template.is_active,
        });
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim() || !formData.subject.trim() || !formData.body.trim()) {
            toast.error('Name, subject, and body are required.');
            return;
        }

        if (!canManageTemplates) {
            toast.error('You do not have permission to manage email templates.');
            return;
        }

        setSaving(true);

        // Extract variables used in body
        const usedVariables = EMAIL_TEMPLATE_VARIABLES
            .filter(v => formData.body.includes(v.key) || formData.subject.includes(v.key))
            .map(v => v.key);

        const templateData = {
            name: formData.name,
            subject: formData.subject,
            body: formData.body,
            variables: usedVariables,
            is_active: formData.is_active,
        };

        try {
            if (editingTemplate) {
                const response = await fetch(`/api/email-templates/${editingTemplate.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(templateData),
                });

                if (!response.ok) {
                    toast.error('Unable to update template', {
                        description: await getResponseErrorMessage(response, 'Please try again.'),
                    });
                    return;
                }

                toast.success('Template updated successfully.');
            } else {
                const response = await fetch('/api/email-templates', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(templateData),
                });

                if (!response.ok) {
                    toast.error('Unable to create template', {
                        description: await getResponseErrorMessage(response, 'Please try again.'),
                    });
                    return;
                }

                toast.success('Template created successfully.');
            }

            setIsDialogOpen(false);
            await fetchTemplates();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this template?')) return;

        if (!canManageTemplates) {
            toast.error('You do not have permission to manage email templates.');
            return;
        }

        const response = await fetch(`/api/email-templates/${id}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            toast.error('Unable to delete template', {
                description: await getResponseErrorMessage(response, 'Please try again.'),
            });
            return;
        }

        toast.success('Template deleted successfully.');
        void fetchTemplates();
    };

    const handleDuplicate = async (template: EmailTemplate) => {
        if (!canManageTemplates) {
            toast.error('You do not have permission to manage email templates.');
            return;
        }

        const response = await fetch('/api/email-templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: `${template.name} (Copy)`,
                subject: template.subject,
                body: template.body,
                variables: template.variables,
                is_active: false,
            }),
        });

        if (!response.ok) {
            toast.error('Unable to duplicate template', {
                description: await getResponseErrorMessage(response, 'Please try again.'),
            });
            return;
        }

        toast.success('Template duplicated successfully.');
        void fetchTemplates();
    };

    const handleToggleActive = async (id: string, isActive: boolean) => {
        if (!canManageTemplates) {
            toast.error('You do not have permission to manage email templates.');
            return;
        }

        const response = await fetch(`/api/email-templates/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ is_active: isActive }),
        });

        if (!response.ok) {
            toast.error('Unable to update template status', {
                description: await getResponseErrorMessage(response, 'Please try again.'),
            });
            return;
        }

        setTemplates(prev => prev.map(t =>
            t.id === id ? { ...t, is_active: isActive } : t
        ));
    };

    const insertVariable = (variable: string) => {
        setFormData(prev => ({
            ...prev,
            body: prev.body + variable,
        }));
    };

    const openPreview = (template: EmailTemplate) => {
        setPreviewTemplate(template);
        setIsPreviewOpen(true);
    };

    const getPreviewBody = (body: string) => {
        return renderEmailTemplate(body, {
            '{{student_name}}': 'John Smith',
            '{{student_email}}': 'john.smith@email.com',
            '{{application_id}}': 'APP-790',
            '{{qualification}}': 'Diploma of Business',
            '{{rto}}': 'Sydney Training Institute',
            '{{appointment_date}}': '15 Mar 2026 10:30',
            '{{intake_date}}': '15 Mar 2026 10:30',
            '{{status}}': 'Docs Review',
            '{{agent_name}}': 'Global Education Partners',
            '{{portal_link}}': 'https://portal.edwardbusinesscollege.edu.au/portal/applications/app-790',
            '{{missing_documents}}': '- Passport\n- Academic Transcript',
            '{{requested_by}}': 'Frontdesk Team',
            '{{note_block}}': 'Additional notes:\nPlease upload clear scans of the requested documents.\n\n',
        });
    };

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">Email Templates</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage notification and communication templates
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" onClick={fetchTemplates}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button onClick={openCreateDialog} disabled={permissionsLoading || !canManageTemplates}>
                            <Plus className="h-4 w-4 mr-2" />
                            New Template
                        </Button>
                    </div>
                </div>

                {/* Search */}
                <div className="mt-4 relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search templates..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </header>

            <div className="p-6">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
                    {EMAIL_TEMPLATE_PRESETS.map((preset) => {
                        const existingTemplate = templates.find((template) => template.name === preset.name) || null;

                        return (
                            <Card key={preset.key}>
                                <CardHeader>
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <CardTitle className="text-lg">{preset.name}</CardTitle>
                                            <p className="text-sm text-muted-foreground mt-1">{preset.description}</p>
                                        </div>
                                        <Badge variant={existingTemplate?.is_active ? 'default' : 'outline'}>
                                            {existingTemplate ? (existingTemplate.is_active ? 'Active' : 'Inactive') : 'Missing'}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex items-center justify-between gap-3">
                                    <div className="text-sm text-muted-foreground">
                                        Used for: <span className="font-medium text-foreground">{preset.usageLabel}</span>
                                    </div>
                                    <Button variant="outline" onClick={() => openPresetDialog(preset)} disabled={permissionsLoading || !canManageTemplates}>
                                        {existingTemplate ? 'Edit Template' : 'Create Template'}
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredTemplates.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Subject</TableHead>
                                        <TableHead>Variables</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTemplates.map((template) => (
                                        <TableRow key={template.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium">{template.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-xs truncate text-muted-foreground">
                                                {template.subject}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1 flex-wrap">
                                                    {template.variables?.slice(0, 2).map((v) => (
                                                        <Badge key={v} variant="outline" className="text-xs">
                                                            <Code className="h-3 w-3 mr-1" />
                                                            {v.replace(/{{|}}/g, '')}
                                                        </Badge>
                                                    ))}
                                                    {(template.variables?.length || 0) > 2 && (
                                                        <Badge variant="outline" className="text-xs">
                                                            +{template.variables.length - 2}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={template.is_active}
                                                    onCheckedChange={(checked) => handleToggleActive(template.id, checked)}
                                                    disabled={permissionsLoading || !canManageTemplates}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openPreview(template)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openEditDialog(template)}
                                                        disabled={permissionsLoading || !canManageTemplates}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDuplicate(template)}
                                                        disabled={permissionsLoading || !canManageTemplates}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(template.id)}
                                                        disabled={permissionsLoading || !canManageTemplates}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No templates found</p>
                                <Button variant="link" onClick={openCreateDialog} disabled={permissionsLoading || !canManageTemplates}>
                                    Create your first template
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingTemplate ? 'Edit Template' : 'Create New Template'}
                        </DialogTitle>
                        <DialogDescription>
                            Create templates for automated emails and notifications.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-3 gap-6 py-4">
                        {/* Main Form */}
                        <div className="col-span-2 space-y-4">
                            <div>
                                <Label htmlFor="name">Template Name</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Application Received"
                                />
                            </div>
                            <div>
                                <Label htmlFor="subject">Email Subject</Label>
                                <Input
                                    id="subject"
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    placeholder="e.g., Your application {{application_id}} has been received"
                                />
                            </div>
                            <div>
                                <Label htmlFor="body">Email Body</Label>
                                <Textarea
                                    id="body"
                                    value={formData.body}
                                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                                    placeholder="Write your email content here. Use variables to personalize..."
                                    rows={12}
                                    className="font-mono text-sm"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={formData.is_active}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                />
                                <Label>Active (available for use)</Label>
                            </div>
                        </div>

                        {/* Variable Helper */}
                        <div className="space-y-4">
                            <div>
                                <Label className="text-muted-foreground">Available Variables</Label>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Click to insert into body
                                </p>
                            </div>
                            <div className="space-y-2">
                                {EMAIL_TEMPLATE_VARIABLES.map((variable) => (
                                    <button
                                        key={variable.key}
                                        onClick={() => insertVariable(variable.key)}
                                        className="w-full text-left p-2 rounded border hover:bg-muted/50 transition-colors"
                                    >
                                        <code className="text-xs text-primary">{variable.key}</code>
                                        <p className="text-xs text-muted-foreground mt-0.5">{variable.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving || permissionsLoading || !canManageTemplates}>
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {editingTemplate ? 'Update' : 'Create'} Template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Preview Dialog */}
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Email Preview</DialogTitle>
                        <DialogDescription>
                            Preview with sample data
                        </DialogDescription>
                    </DialogHeader>
                    {previewTemplate && (
                        <div className="space-y-4 py-4">
                            <div className="border rounded-lg p-4 bg-muted/30">
                                <p className="text-sm text-muted-foreground">Subject:</p>
                                <p className="font-medium">{getPreviewBody(previewTemplate.subject)}</p>
                            </div>
                            <div className="border rounded-lg p-4 bg-card">
                                <pre className="whitespace-pre-wrap text-sm font-sans">
                                    {getPreviewBody(previewTemplate.body)}
                                </pre>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
