'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
    Link2,
    Plus,
    Edit,
    Trash2,
    Loader2,
    RefreshCw,
    Globe,
    Code,
    Users,
    ArrowRightLeft
} from 'lucide-react';
import {
    QUERY_SOURCE_LABELS,
    type LeadSource,
    type QuerySourceType
} from '@/types/database';

const SOURCE_TYPES: QuerySourceType[] = [
    'web_form',
    'api',
    'manual',
    'import',
    'referral',
    'walk_in',
];

export default function LeadSourcesPage() {
    const [sources, setSources] = useState<LeadSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingSource, setEditingSource] = useState<LeadSource | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        source_type: 'web_form' as QuerySourceType,
        identifier: '',
        description: '',
        is_active: true,
    });

    const supabase = createClient();

    useEffect(() => {
        fetchSources();
    }, []);

    async function fetchSources() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('lead_sources')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSources(data || []);
        } catch (error) {
            console.error('Error fetching lead sources:', error);
        } finally {
            setLoading(false);
        }
    }

    const openCreateDialog = () => {
        setEditingSource(null);
        setFormData({
            name: '',
            source_type: 'web_form',
            identifier: '',
            description: '',
            is_active: true,
        });
        setDialogOpen(true);
    };

    const openEditDialog = (source: LeadSource) => {
        setEditingSource(source);
        setFormData({
            name: source.name,
            source_type: source.source_type,
            identifier: source.identifier || '',
            description: source.description || '',
            is_active: source.is_active,
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (editingSource) {
                // Update
                const { error } = await supabase
                    .from('lead_sources')
                    .update({
                        name: formData.name,
                        source_type: formData.source_type,
                        identifier: formData.identifier || null,
                        description: formData.description || null,
                        is_active: formData.is_active,
                    })
                    .eq('id', editingSource.id);

                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase
                    .from('lead_sources')
                    .insert({
                        name: formData.name,
                        source_type: formData.source_type,
                        identifier: formData.identifier || null,
                        description: formData.description || null,
                        is_active: formData.is_active,
                    });

                if (error) throw error;
            }

            await fetchSources();
            setDialogOpen(false);
        } catch (error) {
            console.error('Error saving lead source:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this lead source?')) return;

        try {
            const { error } = await supabase
                .from('lead_sources')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await fetchSources();
        } catch (error) {
            console.error('Error deleting lead source:', error);
        }
    };

    const handleToggleActive = async (id: string, isActive: boolean) => {
        try {
            const { error } = await supabase
                .from('lead_sources')
                .update({ is_active: isActive })
                .eq('id', id);

            if (error) throw error;
            await fetchSources();
        } catch (error) {
            console.error('Error toggling lead source:', error);
        }
    };

    const getSourceIcon = (type: QuerySourceType) => {
        switch (type) {
            case 'web_form': return <Globe className="h-4 w-4" />;
            case 'api': return <Code className="h-4 w-4" />;
            case 'referral': return <Users className="h-4 w-4" />;
            case 'import': return <ArrowRightLeft className="h-4 w-4" />;
            default: return <Link2 className="h-4 w-4" />;
        }
    };

    if (loading) {
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
                            <Link2 className="h-5 w-5" />
                            Lead Sources
                        </CardTitle>
                        <CardDescription>
                            Track where your leads come from - web forms, API integrations, referrals, and more.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchSources}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                        <Button onClick={openCreateDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Source
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-muted/50 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold">{sources.length}</div>
                            <div className="text-sm text-muted-foreground">Total Sources</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-green-600">
                                {sources.filter(s => s.is_active).length}
                            </div>
                            <div className="text-sm text-muted-foreground">Active</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-blue-600">
                                {sources.reduce((sum, s) => sum + (s.total_leads || 0), 0)}
                            </div>
                            <div className="text-sm text-muted-foreground">Total Leads</div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Source</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Identifier</TableHead>
                                    <TableHead className="text-center">Leads</TableHead>
                                    <TableHead className="text-center">Conversion</TableHead>
                                    <TableHead className="text-center">Active</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sources.map((source) => (
                                    <TableRow key={source.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 rounded-full bg-muted">
                                                    {getSourceIcon(source.source_type)}
                                                </div>
                                                <div>
                                                    <div className="font-medium">{source.name}</div>
                                                    {source.description && (
                                                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                            {source.description}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {QUERY_SOURCE_LABELS[source.source_type]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                            {source.identifier || '-'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {source.total_leads || 0}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {source.conversion_rate
                                                ? `${source.conversion_rate.toFixed(1)}%`
                                                : '-'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Switch
                                                checked={source.is_active}
                                                onCheckedChange={(checked) =>
                                                    handleToggleActive(source.id, checked)
                                                }
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEditDialog(source)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(source.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {sources.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            No lead sources configured. Click &quot;Add Source&quot; to create one.
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingSource ? 'Edit Lead Source' : 'Create Lead Source'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Website Contact Form"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="source_type">Source Type *</Label>
                            <Select
                                value={formData.source_type}
                                onValueChange={(v) => setFormData({ ...formData, source_type: v as QuerySourceType })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SOURCE_TYPES.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {QUERY_SOURCE_LABELS[type]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="identifier">Identifier</Label>
                            <Input
                                id="identifier"
                                value={formData.identifier}
                                onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                                placeholder="e.g., contact-form-v2, api-key-partner-a"
                            />
                            <p className="text-xs text-muted-foreground">
                                Optional unique identifier for tracking (form ID, API key name, etc.)
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Brief description of this lead source"
                                rows={2}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch
                                id="is_active"
                                checked={formData.is_active}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                            />
                            <Label htmlFor="is_active">Active</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving || !formData.name}>
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            {editingSource ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
