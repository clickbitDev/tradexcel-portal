import { createServerClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    ArrowLeft,
    Building2,
    Users,
    Mail,
    Phone,
    MapPin,
    Star,
    TrendingUp,
    Clock,
    FileText,
    MessageSquare,
    Settings,
    DollarSign,
    Bell,
    Edit,
    ExternalLink,
    Plus
} from 'lucide-react';
import Link from 'next/link';
import { ACTIVE_RECORD_FILTER } from '@/lib/soft-delete';
import { notFound } from 'next/navigation';
import { PartnerVersionControl } from '@/components/partners/PartnerVersionControl';
import type {
    Partner,
    PartnerCommissionRule,
    PartnerReminder,
    DocumentRequestLink
} from '@/types/database';
import {
    PARTNER_STATUS_COLORS,
    PRIORITY_LEVEL_COLORS,
    CONTACT_CHANNEL_LABELS,
    WORKFLOW_STAGE_LABELS,
    WORKFLOW_STAGE_COLORS
} from '@/types/database';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function PartnerDetailPage({ params }: Props) {
    const { id } = await params;
    const supabase = await createServerClient();

    // Fetch partner with related data
    const { data: partner, error: partnerError } = await supabase
        .from('partners')
        .select(`
            *,
            linked_rto:rtos(*),
            assigned_manager:profiles!partners_assigned_manager_id_fkey(id, full_name, email)
        `)
        .eq('id', id)
        .single();

    if (partnerError || !partner) {
        notFound();
    }

    // Fetch applications for this partner (no limit to get accurate count)
    const { data: applications } = await supabase
        .from('applications')
        .select(`
            id,
            student_uid,
            student_first_name,
            student_last_name,
            workflow_stage,
            created_at,
            offering:rto_offerings(
                qualification:qualifications(code, name)
            )
        `)
        .eq('partner_id', id)
        .or(ACTIVE_RECORD_FILTER)
        .order('created_at', { ascending: false });

    // Fetch contact history
    const { data: contactHistory } = await supabase
        .from('partner_contact_history')
        .select(`
            *,
            user:profiles(id, full_name)
        `)
        .eq('partner_id', id)
        .order('contacted_at', { ascending: false })
        .limit(20);

    // Fetch commission rules (for providers)
    const { data: commissionRules } = await supabase
        .from('partner_commission_rules')
        .select(`
            *,
            qualification:qualifications(code, name)
        `)
        .eq('partner_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    // Fetch reminders
    const { data: reminders } = await supabase
        .from('partner_reminders')
        .select(`
            *,
            template:email_templates(id, name)
        `)
        .eq('partner_id', id)
        .order('created_at', { ascending: false });

    // Fetch document links (for providers)
    const { data: documentLinks } = await supabase
        .from('document_request_links')
        .select('*')
        .eq('partner_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    // Calculate stats
    const applicationStats = {
        total: applications?.length || 0,
        enrolled: applications?.filter(a => a.workflow_stage === 'enrolled').length || 0,
        pending: applications?.filter(a => a.workflow_stage !== 'completed').length || 0,
    };

    const typedPartner = partner as Partner;

    const linkedRto = typedPartner.linked_rto as { name?: string | null; code?: string | null } | null;

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-4 md:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                    <Link href="/portal/partners">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                {typedPartner.type === 'agent' ? (
                                    <Users className="w-6 h-6 text-primary" />
                                ) : (
                                    <Building2 className="w-6 h-6 text-primary" />
                                )}
                            </div>
                            <div>
                                <h1 className="text-2xl font-semibold text-foreground">
                                    {typedPartner.company_name}
                                </h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="capitalize">
                                        {typedPartner.type}
                                    </Badge>
                                    <Badge variant="outline" className={PARTNER_STATUS_COLORS[typedPartner.status]}>
                                        {typedPartner.status.charAt(0).toUpperCase() + typedPartner.status.slice(1)}
                                    </Badge>
                                    {typedPartner.priority_level !== 'standard' && (
                                        <Badge className={PRIORITY_LEVEL_COLORS[typedPartner.priority_level]}>
                                            <Star className="h-3 w-3 mr-1" />
                                            {typedPartner.priority_level}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <Link href={`/portal/partners/${id}/edit`}>
                        <Button className="w-full sm:w-auto">
                            <Edit className="h-4 w-4 mr-2" />
                            <span className="hidden sm:inline">Edit Partner</span>
                            <span className="sm:hidden">Edit</span>
                        </Button>
                    </Link>
                </div>
            </header>

            <div className="p-4 md:p-6">
                <Tabs defaultValue="overview">
                    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 mb-6">
                        <TabsList className="inline-flex w-max min-w-full sm:w-auto">
                            <TabsTrigger value="overview" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Overview
                            </TabsTrigger>
                            <TabsTrigger value="applications" className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Applications ({applicationStats.total})
                            </TabsTrigger>
                            <TabsTrigger value="contact" className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                Contact History
                            </TabsTrigger>
                            {typedPartner.type === 'provider' && (
                                <TabsTrigger value="commission" className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4" />
                                    Commission Rules
                                </TabsTrigger>
                            )}
                            <TabsTrigger value="reminders" className="flex items-center gap-2">
                                <Bell className="h-4 w-4" />
                                Reminders
                            </TabsTrigger>
                            <TabsTrigger value="settings" className="flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                Settings
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Overview Tab */}
                    <TabsContent value="overview">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                            {/* Left Column - Details */}
                            <div className="lg:col-span-2 space-y-4 md:space-y-6">
                                {/* KPI Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                                    <Card className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                                <Users className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Total Applications</p>
                                                <p className="text-2xl font-semibold">{applicationStats.total}</p>
                                            </div>
                                        </div>
                                    </Card>
                                    <Card className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                                <TrendingUp className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                                                <p className="text-2xl font-semibold">
                                                    {typedPartner.kpi_conversion_rate
                                                        ? `${typedPartner.kpi_conversion_rate}%`
                                                        : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </Card>
                                    <Card className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                                <Clock className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">On-time Delivery</p>
                                                <p className="text-2xl font-semibold">
                                                    {typedPartner.kpi_ontime_rate
                                                        ? `${typedPartner.kpi_ontime_rate}%`
                                                        : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </Card>
                                </div>

                                {/* Contact Information */}
                                <Card className="p-4 md:p-6">
                                    <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {typedPartner.contact_name && (
                                            <div className="flex items-center gap-3">
                                                <Users className="w-4 h-4 text-muted-foreground" />
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Contact Person</p>
                                                    <p className="font-medium">{typedPartner.contact_name}</p>
                                                </div>
                                            </div>
                                        )}
                                        {typedPartner.email && (
                                            <div className="flex items-center gap-3">
                                                <Mail className="w-4 h-4 text-muted-foreground" />
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Email</p>
                                                    <a href={`mailto:${typedPartner.email}`} className="font-medium text-primary hover:underline">
                                                        {typedPartner.email}
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                        {typedPartner.phone && (
                                            <div className="flex items-center gap-3">
                                                <Phone className="w-4 h-4 text-muted-foreground" />
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Phone</p>
                                                    <p className="font-medium">{typedPartner.phone}</p>
                                                </div>
                                            </div>
                                        )}
                                        {typedPartner.country && (
                                            <div className="flex items-center gap-3">
                                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Country</p>
                                                    <p className="font-medium">{typedPartner.country}</p>
                                                </div>
                                            </div>
                                        )}
                                        {typedPartner.preferred_channel && (
                                            <div className="flex items-center gap-3">
                                                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Preferred Channel</p>
                                                    <p className="font-medium">
                                                        {CONTACT_CHANNEL_LABELS[typedPartner.preferred_channel]}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Card>

                                {/* Recent Applications */}
                                <Card className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold">Recent Applications</h3>
                                        <Button variant="ghost" size="sm">
                                            View All
                                            <ExternalLink className="h-3 w-3 ml-1" />
                                        </Button>
                                    </div>
                                    {applications && applications.length > 0 ? (
                                        <div className="space-y-3">
                                            {applications.slice(0, 5).map((app: any) => (
                                                <Link
                                                    key={app.id}
                                                    href={`/portal/applications/${app.id}`}
                                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                                >
                                                    <div>
                                                        <p className="font-medium">
                                                            {app.student_first_name} {app.student_last_name}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {app.student_uid} • {app.offering?.qualification?.code}
                                                        </p>
                                                    </div>
                                                    <Badge className={WORKFLOW_STAGE_COLORS[app.workflow_stage as keyof typeof WORKFLOW_STAGE_COLORS]}>
                                                        {WORKFLOW_STAGE_LABELS[app.workflow_stage as keyof typeof WORKFLOW_STAGE_LABELS]}
                                                    </Badge>
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground text-center py-4">
                                            No applications yet
                                        </p>
                                    )}
                                </Card>
                            </div>

                            {/* Right Column - Business Terms */}
                            <div className="space-y-6">
                                <Card className="p-6">
                                    <h3 className="text-lg font-semibold mb-4">Business Terms</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Commission Rate</p>
                                            <p className="text-xl font-semibold">
                                                {typedPartner.commission_rate
                                                    ? `${typedPartner.commission_rate}%`
                                                    : 'Not set'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Priority Level</p>
                                            <Badge className={PRIORITY_LEVEL_COLORS[typedPartner.priority_level]}>
                                                {typedPartner.priority_level.charAt(0).toUpperCase() + typedPartner.priority_level.slice(1)}
                                            </Badge>
                                        </div>
                                        {typedPartner.delivery_method && (
                                            <div>
                                                <p className="text-sm text-muted-foreground">Delivery Method</p>
                                                <p className="font-medium">{typedPartner.delivery_method}</p>
                                            </div>
                                        )}
                                    </div>
                                </Card>

                                {/* Linked RTO (for providers) */}
                                {linkedRto && (
                                    <Card className="p-6">
                                        <h3 className="text-lg font-semibold mb-4">Linked RTO</h3>
                                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                                            <Building2 className="w-5 h-5 text-primary" />
                                            <div>
                                                <p className="font-medium">{linkedRto.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {linkedRto.code}
                                                </p>
                                            </div>
                                        </div>
                                    </Card>
                                )}

                                {/* Document Links (for providers) */}
                                {typedPartner.type === 'provider' && (
                                    <Card className="p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold">Document Links</h3>
                                            <Button size="sm">
                                                <Plus className="h-3 w-3 mr-1" />
                                                Generate
                                            </Button>
                                        </div>
                                        {documentLinks && documentLinks.length > 0 ? (
                                            <div className="space-y-2">
                                                {documentLinks.slice(0, 3).map((link: DocumentRequestLink) => (
                                                    <div
                                                        key={link.id}
                                                        className="flex items-center justify-between p-2 rounded border text-sm"
                                                    >
                                                        <span className="truncate flex-1">
                                                            {link.document_types.join(', ')}
                                                        </span>
                                                        <Badge variant="outline" className="ml-2">
                                                            {link.current_uploads}/{link.max_uploads || '∞'}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-muted-foreground text-sm">
                                                No active document links
                                            </p>
                                        )}
                                    </Card>
                                )}

                                {/* Notes */}
                                {typedPartner.notes && (
                                    <Card className="p-6">
                                        <h3 className="text-lg font-semibold mb-4">Notes</h3>
                                        <p className="text-muted-foreground whitespace-pre-wrap">
                                            {typedPartner.notes}
                                        </p>
                                    </Card>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* Applications Tab */}
                    <TabsContent value="applications">
                        <Card className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold">All Applications</h3>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm">Export CSV</Button>
                                </div>
                            </div>
                            {applications && applications.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b text-left">
                                                <th className="pb-3 font-medium">Student</th>
                                                <th className="pb-3 font-medium">ID</th>
                                                <th className="pb-3 font-medium">Qualification</th>
                                                <th className="pb-3 font-medium">Status</th>
                                                <th className="pb-3 font-medium">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {applications.map((app: any) => (
                                                <tr key={app.id} className="border-b last:border-0">
                                                    <td className="py-3">
                                                        <Link
                                                            href={`/portal/applications/${app.id}`}
                                                            className="font-medium hover:text-primary"
                                                        >
                                                            {app.student_first_name} {app.student_last_name}
                                                        </Link>
                                                    </td>
                                                    <td className="py-3 text-muted-foreground">{app.student_uid}</td>
                                                    <td className="py-3">{app.offering?.qualification?.code}</td>
                                                    <td className="py-3">
                                                        <Badge className={WORKFLOW_STAGE_COLORS[app.workflow_stage as keyof typeof WORKFLOW_STAGE_COLORS]}>
                                                            {WORKFLOW_STAGE_LABELS[app.workflow_stage as keyof typeof WORKFLOW_STAGE_LABELS]}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 text-muted-foreground">
                                                        {new Date(app.created_at).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                                    <p className="text-muted-foreground">No applications yet</p>
                                </div>
                            )}
                        </Card>
                    </TabsContent>

                    {/* Contact History Tab */}
                    <TabsContent value="contact">
                        <Card className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold">Contact History</h3>
                                <Button size="sm">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Interaction
                                </Button>
                            </div>
                            {contactHistory && contactHistory.length > 0 ? (
                                <div className="space-y-4">
                                    {contactHistory.map((contact: any) => (
                                        <div
                                            key={contact.id}
                                            className="flex gap-4 p-4 rounded-lg border"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <MessageSquare className="w-5 h-5 text-primary" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline">
                                                            {CONTACT_CHANNEL_LABELS[contact.channel as keyof typeof CONTACT_CHANNEL_LABELS]}
                                                        </Badge>
                                                        {contact.subject && (
                                                            <span className="font-medium">{contact.subject}</span>
                                                        )}
                                                    </div>
                                                    <span className="text-sm text-muted-foreground">
                                                        {new Date(contact.contacted_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                {contact.content && (
                                                    <p className="text-muted-foreground mt-2">{contact.content}</p>
                                                )}
                                                {contact.user && (
                                                    <p className="text-sm text-muted-foreground mt-2">
                                                        By {contact.user.full_name}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                                    <p className="text-muted-foreground">No contact history yet</p>
                                    <Button className="mt-4">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Log First Interaction
                                    </Button>
                                </div>
                            )}
                        </Card>
                    </TabsContent>

                    {/* Commission Rules Tab (Providers only) */}
                    {typedPartner.type === 'provider' && (
                        <TabsContent value="commission">
                            <Card className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-semibold">Commission Rules</h3>
                                    <Button size="sm">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Rule
                                    </Button>
                                </div>
                                {commissionRules && commissionRules.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b text-left">
                                                    <th className="pb-3 font-medium">Rule Name</th>
                                                    <th className="pb-3 font-medium">Qualification</th>
                                                    <th className="pb-3 font-medium">Volume Tier</th>
                                                    <th className="pb-3 font-medium">Rate</th>
                                                    <th className="pb-3 font-medium">Effective</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {commissionRules.map((rule: PartnerCommissionRule) => (
                                                    <tr key={rule.id} className="border-b last:border-0">
                                                        <td className="py-3 font-medium">{rule.name}</td>
                                                        <td className="py-3">
                                                            {rule.qualification
                                                                ? rule.qualification.code
                                                                : 'All qualifications'}
                                                        </td>
                                                        <td className="py-3">
                                                            {rule.min_volume || rule.max_volume
                                                                ? `${rule.min_volume || 0} - ${rule.max_volume || '∞'}`
                                                                : 'Any volume'}
                                                        </td>
                                                        <td className="py-3">
                                                            <Badge className="bg-green-100 text-green-700">
                                                                {rule.commission_rate}%
                                                            </Badge>
                                                        </td>
                                                        <td className="py-3 text-muted-foreground">
                                                            {new Date(rule.effective_from).toLocaleDateString()}
                                                            {rule.effective_to && ` - ${new Date(rule.effective_to).toLocaleDateString()}`}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                                        <p className="text-muted-foreground">No commission rules configured</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Default rate: {typedPartner.commission_rate || 0}%
                                        </p>
                                        <Button className="mt-4">
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Commission Rule
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        </TabsContent>
                    )}

                    {/* Reminders Tab */}
                    <TabsContent value="reminders">
                        <Card className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold">Automated Reminders</h3>
                                <Button size="sm">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Reminder
                                </Button>
                            </div>
                            {reminders && reminders.length > 0 ? (
                                <div className="space-y-3">
                                    {reminders.map((reminder: PartnerReminder) => (
                                        <div
                                            key={reminder.id}
                                            className="flex items-center justify-between p-4 rounded-lg border"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${reminder.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
                                                    <Bell className={`w-5 h-5 ${reminder.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                                                </div>
                                                <div>
                                                    <p className="font-medium capitalize">
                                                        {reminder.reminder_type.replace(/_/g, ' ')}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {reminder.days_before} days before •
                                                        {reminder.template ? ` Template: ${reminder.template.name}` : ' No template'}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant={reminder.is_active ? 'default' : 'secondary'}>
                                                {reminder.is_active ? 'Active' : 'Disabled'}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                                    <p className="text-muted-foreground">No automated reminders configured</p>
                                    <Button className="mt-4">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Configure Reminders
                                    </Button>
                                </div>
                            )}
                        </Card>
                    </TabsContent>

                    {/* Settings Tab */}
                    <TabsContent value="settings">
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold mb-6">Partner Settings</h3>
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-medium mb-2">Portal Access</h4>
                                    <p className="text-sm text-muted-foreground mb-3">
                                        Grant this partner access to the agent portal.
                                    </p>
                                    {typedPartner.user_id ? (
                                        <Badge className="bg-green-100 text-green-700">
                                            Portal access enabled
                                        </Badge>
                                    ) : (
                                        <Button variant="outline">Enable Portal Access</Button>
                                    )}
                                </div>
                                <div className="border-t pt-6">
                                    <h4 className="font-medium mb-2 text-red-600">Danger Zone</h4>
                                    <p className="text-sm text-muted-foreground mb-3">
                                        Suspend or deactivate this partner.
                                    </p>
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="text-yellow-600 border-yellow-300 hover:bg-yellow-50">
                                            Suspend Partner
                                        </Button>
                                        <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-50">
                                            Deactivate Partner
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Version Control */}
                        <PartnerVersionControl
                            partnerId={id}
                            isArchived={typedPartner.is_archived}
                            isDeleted={typedPartner.is_deleted}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </main>
    );
}
