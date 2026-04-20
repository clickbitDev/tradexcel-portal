'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
    Ticket,
    Clock,
    CheckCircle2,
    AlertCircle,
    Loader2,
    RefreshCw,
    Search,
    Link as LinkIcon,
    MessageSquare,
    ChevronDown,
    ChevronRight,
    Send,
    Lock,
    Eye
} from 'lucide-react';
import Link from 'next/link';

type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

interface Ticket {
    id: string;
    subject: string;
    description: string | null;
    status: TicketStatus;
    priority: TicketPriority;
    application_id: string | null;
    partner_id: string | null;
    created_by: string | null;
    assigned_to: string | null;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
    application?: { student_uid: string; student_first_name: string; student_last_name: string } | null;
    partner?: { company_name: string } | null;
    creator?: { full_name: string } | null;
    assignee?: { full_name: string } | null;
}

interface TicketComment {
    id: string;
    ticket_id: string;
    user_id: string | null;
    content: string;
    is_internal: boolean;
    created_at: string;
    user?: { full_name: string; avatar_url: string | null } | null;
}

const STATUS_COLORS: Record<TicketStatus, string> = {
    open: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    waiting: 'bg-orange-100 text-orange-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-700',
};

const STATUS_ICONS: Record<TicketStatus, React.ElementType> = {
    open: AlertCircle,
    in_progress: Clock,
    waiting: Clock,
    resolved: CheckCircle2,
    closed: CheckCircle2,
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
    low: 'bg-gray-100 text-gray-600',
    normal: 'bg-blue-100 text-blue-600',
    high: 'bg-orange-100 text-orange-600',
    urgent: 'bg-red-100 text-red-600',
};

export default function TicketsPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
    const [comments, setComments] = useState<TicketComment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [isInternal, setIsInternal] = useState(false);
    const [addingComment, setAddingComment] = useState(false);
    const [newTicket, setNewTicket] = useState({
        subject: '',
        description: '',
        priority: 'normal' as TicketPriority,
    });
    const supabase = createClient();

    const fetchTickets = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('tickets')
            .select(`
                *,
                application:applications(student_uid, student_first_name, student_last_name),
                partner:partners(company_name),
                creator:profiles!tickets_created_by_fkey(full_name),
                assignee:profiles!tickets_assigned_to_fkey(full_name)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching tickets:', error);
        } else {
            setTickets(data || []);
        }
        setLoading(false);
    };

    const fetchComments = async (ticketId: string) => {
        setLoadingComments(true);
        try {
            const res = await fetch(`/api/tickets/${ticketId}/comments`);
            const { data } = await res.json();
            setComments(data || []);
        } catch (error) {
            console.error('Error fetching comments:', error);
        } finally {
            setLoadingComments(false);
        }
    };

    const handleToggleExpand = async (ticketId: string) => {
        if (expandedTicket === ticketId) {
            setExpandedTicket(null);
            setComments([]);
        } else {
            setExpandedTicket(ticketId);
            await fetchComments(ticketId);
        }
    };

    const handleAddComment = async () => {
        if (!expandedTicket || !newComment.trim()) return;
        setAddingComment(true);
        try {
            const res = await fetch(`/api/tickets/${expandedTicket}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newComment, is_internal: isInternal }),
            });
            if (res.ok) {
                setNewComment('');
                setIsInternal(false);
                await fetchComments(expandedTicket);
            }
        } catch (error) {
            console.error('Error adding comment:', error);
        } finally {
            setAddingComment(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);

    const handleCreateTicket = async () => {
        if (!newTicket.subject.trim()) return;
        setCreating(true);

        const { error } = await supabase
            .from('tickets')
            .insert([{
                subject: newTicket.subject,
                description: newTicket.description || null,
                priority: newTicket.priority,
                status: 'open',
            }]);

        if (!error) {
            setNewTicket({ subject: '', description: '', priority: 'normal' });
            setIsCreateOpen(false);
            fetchTickets();
        }
        setCreating(false);
    };

    const handleStatusChange = async (ticketId: string, newStatus: TicketStatus) => {
        const updateData: Partial<Ticket> = { status: newStatus };
        if (newStatus === 'resolved') {
            updateData.resolved_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from('tickets')
            .update(updateData)
            .eq('id', ticketId);

        if (!error) {
            fetchTickets();
        }
    };

    const filteredTickets = tickets.filter((ticket) => {
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            if (!ticket.subject.toLowerCase().includes(search) &&
                !ticket.description?.toLowerCase().includes(search)) {
                return false;
            }
        }
        if (statusFilter !== 'all' && ticket.status !== statusFilter) {
            return false;
        }
        return true;
    });

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-AU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const openCount = tickets.filter(t => t.status === 'open').length;
    const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">Tickets</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Track and resolve queries and issues
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" onClick={fetchTickets}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" />
                                    New Ticket
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                                <DialogHeader>
                                    <DialogTitle>Create New Ticket</DialogTitle>
                                    <DialogDescription>
                                        Create a new ticket to track an issue or query.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div>
                                        <Label htmlFor="subject">Subject</Label>
                                        <Input
                                            id="subject"
                                            value={newTicket.subject}
                                            onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                                            placeholder="Brief description of the issue"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="priority">Priority</Label>
                                        <Select
                                            value={newTicket.priority}
                                            onValueChange={(v) => setNewTicket({ ...newTicket, priority: v as TicketPriority })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="low">Low</SelectItem>
                                                <SelectItem value="normal">Normal</SelectItem>
                                                <SelectItem value="high">High</SelectItem>
                                                <SelectItem value="urgent">Urgent</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor="description">Description</Label>
                                        <Textarea
                                            id="description"
                                            value={newTicket.description}
                                            onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                                            placeholder="Detailed description of the issue..."
                                            rows={4}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleCreateTicket} disabled={creating || !newTicket.subject.trim()}>
                                        {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                        Create Ticket
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Stats & Filters */}
                <div className="flex flex-wrap items-center gap-4 mt-4">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-700">{openCount} Open</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 rounded-lg">
                            <Clock className="h-4 w-4 text-yellow-600" />
                            <span className="text-sm font-medium text-yellow-700">{inProgressCount} In Progress</span>
                        </div>
                    </div>

                    <div className="flex-1" />

                    <div className="relative min-w-[250px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search tickets..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="waiting">Waiting</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </header>

            <div className="p-6">
                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredTickets.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-8"></TableHead>
                                        <TableHead className="w-[35%]">Subject</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Priority</TableHead>
                                        <TableHead>Linked To</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTickets.map((ticket) => {
                                        const StatusIcon = STATUS_ICONS[ticket.status];
                                        const isExpanded = expandedTicket === ticket.id;
                                        return (
                                            <Collapsible key={ticket.id} open={isExpanded} render={
                                                <>
                                                    <TableRow className="hover:bg-muted/50">
                                                        <TableCell className="p-2">
                                                            <CollapsibleTrigger render={
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0"
                                                                    onClick={() => handleToggleExpand(ticket.id)}
                                                                >
                                                                    {isExpanded ? (
                                                                        <ChevronDown className="h-4 w-4" />
                                                                    ) : (
                                                                        <ChevronRight className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                            } />
                                                        </TableCell>
                                                        <TableCell>
                                                            <div>
                                                                <p className="font-medium flex items-center gap-2">
                                                                    {ticket.subject}
                                                                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                                                                </p>
                                                                {ticket.description && (
                                                                    <p className="text-sm text-muted-foreground line-clamp-1">
                                                                        {ticket.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge className={STATUS_COLORS[ticket.status]}>
                                                                <StatusIcon className="h-3 w-3 mr-1" />
                                                                {ticket.status.replace('_', ' ')}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className={PRIORITY_COLORS[ticket.priority]}>
                                                                {ticket.priority}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {ticket.application ? (
                                                                <Link
                                                                    href={`/portal/applications/${ticket.application_id}`}
                                                                    className="text-sm text-primary hover:underline flex items-center gap-1"
                                                                >
                                                                    <LinkIcon className="h-3 w-3" />
                                                                    {ticket.application.student_uid}
                                                                </Link>
                                                            ) : ticket.partner ? (
                                                                <Link
                                                                    href={`/portal/partners/${ticket.partner_id}`}
                                                                    className="text-sm text-primary hover:underline flex items-center gap-1"
                                                                >
                                                                    <LinkIcon className="h-3 w-3" />
                                                                    {ticket.partner.company_name}
                                                                </Link>
                                                            ) : (
                                                                <span className="text-sm text-muted-foreground">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {formatDateTime(ticket.created_at)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Select
                                                                value={ticket.status}
                                                                onValueChange={(v) => handleStatusChange(ticket.id, v as TicketStatus)}
                                                            >
                                                                <SelectTrigger className="h-8 w-[130px]">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="open">Open</SelectItem>
                                                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                                                    <SelectItem value="waiting">Waiting</SelectItem>
                                                                    <SelectItem value="resolved">Resolved</SelectItem>
                                                                    <SelectItem value="closed">Closed</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                    </TableRow>
                                                    <CollapsibleContent render={
                                                        <tr>
                                                            <td colSpan={7} className="p-0 border-t-0">
                                                                <div className="bg-muted/30 px-6 py-4 border-t">
                                                                    <div className="flex items-center gap-2 mb-4">
                                                                        <MessageSquare className="h-4 w-4" />
                                                                        <h4 className="font-medium">Comments</h4>
                                                                    </div>

                                                                    {loadingComments ? (
                                                                        <div className="flex items-center justify-center py-4">
                                                                            <Loader2 className="h-5 w-5 animate-spin" />
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            {/* Comments List */}
                                                                            <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto">
                                                                                {comments.length > 0 ? (
                                                                                    comments.map((comment) => (
                                                                                        <div
                                                                                            key={comment.id}
                                                                                            className={`p-3 rounded-lg ${comment.is_internal
                                                                                                    ? 'bg-yellow-50 border border-yellow-200'
                                                                                                    : 'bg-white border'
                                                                                                }`}
                                                                                        >
                                                                                            <div className="flex items-center justify-between mb-1">
                                                                                                <span className="font-medium text-sm">
                                                                                                    {comment.user?.full_name || 'Unknown'}
                                                                                                </span>
                                                                                                <div className="flex items-center gap-2">
                                                                                                    {comment.is_internal && (
                                                                                                        <Badge variant="outline" className="text-xs bg-yellow-100">
                                                                                                            <Lock className="h-3 w-3 mr-1" />
                                                                                                            Internal
                                                                                                        </Badge>
                                                                                                    )}
                                                                                                    <span className="text-xs text-muted-foreground">
                                                                                                        {formatDateTime(comment.created_at)}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                            <p className="text-sm whitespace-pre-wrap">
                                                                                                {comment.content}
                                                                                            </p>
                                                                                        </div>
                                                                                    ))
                                                                                ) : (
                                                                                    <p className="text-sm text-muted-foreground text-center py-4">
                                                                                        No comments yet
                                                                                    </p>
                                                                                )}
                                                                            </div>

                                                                            {/* Add Comment */}
                                                                            <div className="flex gap-2">
                                                                                <div className="flex-1">
                                                                                    <Textarea
                                                                                        placeholder="Add a comment..."
                                                                                        value={newComment}
                                                                                        onChange={(e) => setNewComment(e.target.value)}
                                                                                        rows={2}
                                                                                        className="resize-none"
                                                                                    />
                                                                                    <div className="flex items-center justify-between mt-2">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <Switch
                                                                                                id="internal"
                                                                                                checked={isInternal}
                                                                                                onCheckedChange={setIsInternal}
                                                                                            />
                                                                                            <Label htmlFor="internal" className="text-sm flex items-center gap-1">
                                                                                                <Lock className="h-3 w-3" />
                                                                                                Internal only
                                                                                            </Label>
                                                                                        </div>
                                                                                        <Button
                                                                                            size="sm"
                                                                                            onClick={handleAddComment}
                                                                                            disabled={addingComment || !newComment.trim()}
                                                                                        >
                                                                                            {addingComment ? (
                                                                                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                                                                            ) : (
                                                                                                <Send className="h-4 w-4 mr-1" />
                                                                                            )}
                                                                                            Send
                                                                                        </Button>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    } />
                                                </>
                                            } />
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <Ticket className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No tickets found</p>
                                <Button variant="link" onClick={() => setIsCreateOpen(true)}>
                                    Create your first ticket
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
