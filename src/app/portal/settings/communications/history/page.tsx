'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
    DialogDescription,
} from '@/components/ui/dialog';
import {
    History,
    Search,
    Loader2,
    RefreshCw,
    Mail,
    MessageSquare,
    Phone,
    CheckCircle,
    XCircle,
    Clock,
    FileText,
    ExternalLink,
} from 'lucide-react';
import {
    getCommunicationHistory,
    getCommunicationStats,
    getUniqueSenders,
    type CommunicationRecord,
    type CommunicationFilters,
} from '@/lib/services/communication-history-service';

const channelIcons = {
    email: Mail,
    sms: Phone,
    whatsapp: MessageSquare,
};

const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    sent: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
};

export default function CommunicationHistoryPage() {
    const [records, setRecords] = useState<CommunicationRecord[]>([]);
    const [stats, setStats] = useState<{
        totalSent: number;
        emailsSent: number;
        smsSent: number;
        invoicesSent: number;
        failed: number;
    } | null>(null);
    const [senders, setSenders] = useState<Array<{ id: string; name: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRecord, setSelectedRecord] = useState<CommunicationRecord | null>(null);

    // Filters
    const [filters, setFilters] = useState<CommunicationFilters>({});
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);

        const appliedFilters: CommunicationFilters = { ...filters };
        if (searchQuery) {
            appliedFilters.recipientSearch = searchQuery;
        }

        const [historyData, statsData, sendersData] = await Promise.all([
            getCommunicationHistory(appliedFilters),
            getCommunicationStats(30),
            getUniqueSenders(),
        ]);

        setRecords(historyData);
        setStats(statsData);
        setSenders(sendersData);
        setLoading(false);
    }, [filters, searchQuery]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getChannelIcon = (channel: 'email' | 'sms' | 'whatsapp') => {
        const Icon = channelIcons[channel] || Mail;
        return <Icon className="h-4 w-4" />;
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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                        <History className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-foreground">Communication History</h1>
                        <p className="text-sm text-muted-foreground">
                            Track all emails and SMS sent from the system
                        </p>
                    </div>
                </div>
                <Button variant="outline" onClick={fetchData}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-sm text-muted-foreground">Total Sent</span>
                            </div>
                            <div className="text-2xl font-bold text-green-600">{stats.totalSent}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-blue-500" />
                                <span className="text-sm text-muted-foreground">Emails</span>
                            </div>
                            <div className="text-2xl font-bold">{stats.emailsSent}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-purple-500" />
                                <span className="text-sm text-muted-foreground">SMS</span>
                            </div>
                            <div className="text-2xl font-bold">{stats.smsSent}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-indigo-500" />
                                <span className="text-sm text-muted-foreground">Invoices</span>
                            </div>
                            <div className="text-2xl font-bold">{stats.invoicesSent}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="text-sm text-muted-foreground">Failed</span>
                            </div>
                            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by recipient..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <Select
                            value={filters.channel || 'all'}
                            onValueChange={(v) => setFilters({ ...filters, channel: v === 'all' ? undefined : v as 'email' | 'sms' | 'whatsapp' })}
                        >
                            <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="Channel" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Channels</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="sms">SMS</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={filters.status || 'all'}
                            onValueChange={(v) => setFilters({ ...filters, status: v === 'all' ? undefined : v as 'sent' | 'pending' | 'failed' | 'cancelled' })}
                        >
                            <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={filters.messageType || 'all'}
                            onValueChange={(v) => setFilters({ ...filters, messageType: v === 'all' ? undefined : v })}
                        >
                            <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="invoice">Invoice</SelectItem>
                                <SelectItem value="bill">Bill</SelectItem>
                                <SelectItem value="reminder">Reminder</SelectItem>
                                <SelectItem value="bulk">Bulk</SelectItem>
                                <SelectItem value="manual">Manual</SelectItem>
                            </SelectContent>
                        </Select>
                        {senders.length > 0 && (
                            <Select
                                value={filters.sentBy || 'all'}
                                onValueChange={(v) => setFilters({ ...filters, sentBy: v === 'all' ? undefined : v })}
                            >
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Sent By" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Senders</SelectItem>
                                    {senders.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* History Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Messages</CardTitle>
                    <CardDescription>
                        {records.length} message{records.length !== 1 ? 's' : ''} found (last 30 days)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">Channel</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Recipient</TableHead>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Sent By</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[80px]">Links</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {records.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                            No communication history found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    records.map((record) => (
                                        <TableRow
                                            key={record.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => setSelectedRecord(record)}
                                        >
                                            <TableCell>
                                                <div className="flex items-center justify-center">
                                                    {getChannelIcon(record.channel)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {formatDate(record.createdAt)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium truncate max-w-[150px]">
                                                    {record.recipientName || record.recipient}
                                                </div>
                                                {record.recipientName && (
                                                    <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                                        {record.recipient}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="truncate max-w-[200px]">
                                                    {record.subject || '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">
                                                    {record.messageType || 'manual'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {record.sentByName || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={statusColors[record.status]}>
                                                    {record.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    {record.applicationUid && (
                                                        <a
                                                            href={`/portal/applications/${record.applicationId}`}
                                                            className="text-xs text-muted-foreground hover:text-primary"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            App
                                                        </a>
                                                    )}
                                                    {record.invoiceNumber && (
                                                        <span className="text-xs text-indigo-500">
                                                            {record.invoiceNumber}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Message Detail Dialog */}
            <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {selectedRecord && getChannelIcon(selectedRecord.channel)}
                            Message Details
                        </DialogTitle>
                        <DialogDescription>
                            {selectedRecord?.subject || 'No subject'}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRecord && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <div className="text-muted-foreground">Recipient</div>
                                    <div className="font-medium">
                                        {selectedRecord.recipientName || selectedRecord.recipient}
                                    </div>
                                    {selectedRecord.recipientName && (
                                        <div className="text-muted-foreground">
                                            {selectedRecord.recipient}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-muted-foreground">Sent At</div>
                                    <div className="font-medium">
                                        {formatDate(selectedRecord.createdAt)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">Sent By</div>
                                    <div className="font-medium">
                                        {selectedRecord.sentByName || 'System'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">Status</div>
                                    <Badge className={statusColors[selectedRecord.status]}>
                                        {selectedRecord.status}
                                    </Badge>
                                </div>
                            </div>

                            {selectedRecord.body && (
                                <div>
                                    <div className="text-sm text-muted-foreground mb-2">Message Content</div>
                                    <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                                        {selectedRecord.body}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                {selectedRecord.applicationId && (
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        nativeButton={false}
                                        render={
                                            <a href={`/portal/applications/${selectedRecord.applicationId}`}>
                                                <ExternalLink className="h-4 w-4 mr-1" />
                                                View Application
                                            </a>
                                        } 
                                    />
                                )}
                                {selectedRecord.invoiceNumber && (
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        nativeButton={false}
                                        render={
                                            <a href="/portal/settings/invoicing">
                                                <FileText className="h-4 w-4 mr-1" />
                                                {selectedRecord.invoiceNumber}
                                            </a>
                                        } 
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
