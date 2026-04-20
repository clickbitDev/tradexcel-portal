'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Users,
    Activity,
    Clock,
    TrendingUp,
    TrendingDown,
    Calendar,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    BarChart3,
    User,
    Search,
    Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    getAllStaffActivitySummaries,
    getTeamOverview,
    getDailyActivityBreakdown,
    getTeamDailyBreakdown,
    type StaffActivitySummary,
} from '@/lib/services/staff-activity-service';

export default function StaffActivityPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [daysBack, setDaysBack] = useState(30);
    const [staffSummaries, setStaffSummaries] = useState<StaffActivitySummary[]>([]);
    const [teamOverview, setTeamOverview] = useState<Awaited<ReturnType<typeof getTeamOverview>> | null>(null);
    const [dailyBreakdown, setDailyBreakdown] = useState<Awaited<ReturnType<typeof getTeamDailyBreakdown>>>([]);
    const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');

    // Get unique roles for the filter dropdown
    const uniqueRoles = useMemo(() => {
        const roles = new Set(staffSummaries.map(s => s.role));
        return Array.from(roles).sort();
    }, [staffSummaries]);

    // Filter staff based on search term and role
    const filteredStaffSummaries = useMemo(() => {
        return staffSummaries.filter(staff => {
            const matchesSearch = searchTerm === '' ||
                staff.userName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRole = roleFilter === 'all' || staff.role === roleFilter;
            return matchesSearch && matchesRole;
        });
    }, [staffSummaries, searchTerm, roleFilter]);

    useEffect(() => {
        loadData();
    }, [daysBack]);

    async function loadData() {
        try {
            setLoading(true);
            setError(null);

            const [summaries, overview, daily] = await Promise.all([
                getAllStaffActivitySummaries(daysBack),
                getTeamOverview(daysBack),
                getTeamDailyBreakdown(daysBack),
            ]);

            setStaffSummaries(summaries);
            setTeamOverview(overview);
            setDailyBreakdown(daily);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }

    function toggleExpand(userId: string) {
        const newExpanded = new Set(expandedStaff);
        if (newExpanded.has(userId)) {
            newExpanded.delete(userId);
        } else {
            newExpanded.add(userId);
        }
        setExpandedStaff(newExpanded);
    }

    function formatDate(dateString: string | null): string {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    }

    function formatRelativeTime(dateString: string | null): string {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return `${Math.floor(diffDays / 30)} months ago`;
    }

    function getActivityRateColor(rate: number): string {
        if (rate >= 80) return 'text-green-600';
        if (rate >= 50) return 'text-yellow-600';
        return 'text-red-600';
    }

    function getInactivityBadge(days: number) {
        if (days <= 1) return null;
        if (days <= 3) return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Inactive {days}d</Badge>;
        if (days <= 7) return <Badge variant="outline" className="bg-orange-50 text-orange-700">Inactive {days}d</Badge>;
        return <Badge variant="outline" className="bg-red-50 text-red-700">Inactive {days}d</Badge>;
    }

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <Card className="p-6 text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                    <p className="text-red-500">{error}</p>
                    <Button onClick={loadData} className="mt-4">Retry</Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Activity className="h-6 w-6" />
                        Staff Activity Report
                    </h1>
                    <p className="text-muted-foreground">
                        Monitor team productivity, engagement, and activity patterns
                    </p>
                </div>
                <Select value={String(daysBack)} onValueChange={(v) => setDaysBack(Number(v))}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Time period" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="14">Last 14 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="60">Last 60 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Overview Cards */}
            {teamOverview && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900">
                                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Staff</p>
                                    <p className="text-2xl font-bold">{teamOverview.totalStaff}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900">
                                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-300" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Active Today</p>
                                    <p className="text-2xl font-bold">
                                        {teamOverview.activeToday}
                                        <span className="text-sm font-normal text-muted-foreground ml-1">
                                            / {teamOverview.totalStaff}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900">
                                    <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Actions</p>
                                    <p className="text-2xl font-bold">{teamOverview.totalActions.toLocaleString()}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 rounded-lg dark:bg-red-900">
                                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-300" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Inactive (&gt;3d)</p>
                                    <p className="text-2xl font-bold">{teamOverview.inactiveStaff.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Tabs defaultValue="daily">
                <TabsList>
                    <TabsTrigger value="daily">Daily Breakdown</TabsTrigger>
                    <TabsTrigger value="individual">Individual Reports</TabsTrigger>
                    <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
                    <TabsTrigger value="inactive">Inactive Staff</TabsTrigger>
                </TabsList>

                {/* Daily Breakdown */}
                <TabsContent value="daily" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Daily Activity Breakdown
                            </CardTitle>
                            <CardDescription>
                                Team-wide activity by day with individual contributions
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {dailyBreakdown.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No activity data available</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Activity Chart */}
                                    <div className="space-y-2">
                                        <div className="flex items-end gap-1 h-48">
                                            {dailyBreakdown.slice(-14).map((day) => {
                                                const maxTotal = Math.max(...dailyBreakdown.map(d => d.total), 1);
                                                const heightPercent = (day.total / maxTotal) * 100;
                                                const isToday = day.date === new Date().toISOString().split('T')[0];
                                                return (
                                                    <div
                                                        key={day.date}
                                                        className="flex-1 flex flex-col items-center group"
                                                    >
                                                        <div className="w-full flex flex-col items-center">
                                                            <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {day.total}
                                                            </span>
                                                            <div
                                                                className={`w-full rounded-t transition-all duration-200 ${isToday ? 'bg-primary' : 'bg-primary/60 hover:bg-primary/80'}`}
                                                                style={{ height: `${Math.max(heightPercent, 2)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground mt-1 rotate-45 origin-left">
                                                            {new Date(day.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Daily Table */}
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead className="text-right">Total Actions</TableHead>
                                                <TableHead>Contributors</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {dailyBreakdown.slice().reverse().slice(0, 14).map((day) => {
                                                const userEntries = Object.entries(day.byUser).sort((a, b) => b[1].count - a[1].count);
                                                const isToday = day.date === new Date().toISOString().split('T')[0];
                                                return (
                                                    <TableRow key={day.date} className={isToday ? 'bg-primary/5' : ''}>
                                                        <TableCell className="font-medium">
                                                            {new Date(day.date).toLocaleDateString('en-AU', {
                                                                weekday: 'short',
                                                                day: 'numeric',
                                                                month: 'short'
                                                            })}
                                                            {isToday && <Badge variant="outline" className="ml-2 text-xs">Today</Badge>}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <span className={`font-bold ${day.total === 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                                {day.total}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            {userEntries.length === 0 ? (
                                                                <span className="text-muted-foreground text-sm">No activity</span>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {userEntries.slice(0, 4).map(([userId, { name, count }]) => (
                                                                        <Badge key={userId} variant="secondary" className="text-xs">
                                                                            {name}: {count}
                                                                        </Badge>
                                                                    ))}
                                                                    {userEntries.length > 4 && (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            +{userEntries.length - 4} more
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Individual Reports */}
                <TabsContent value="individual" className="space-y-4 mt-4">
                    {/* Search and Filter Controls */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-full sm:w-48">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter by role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                {uniqueRoles.map((role) => (
                                    <SelectItem key={role} value={role} className="capitalize">
                                        {role.charAt(0).toUpperCase() + role.slice(1)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {staffSummaries.length === 0 ? (
                        <Card className="p-12 text-center">
                            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                            <p className="text-muted-foreground">No staff activity data available</p>
                        </Card>
                    ) : filteredStaffSummaries.length === 0 ? (
                        <Card className="p-12 text-center">
                            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                            <p className="text-muted-foreground">No staff match your search criteria</p>
                            <Button
                                variant="link"
                                onClick={() => { setSearchTerm(''); setRoleFilter('all'); }}
                                className="mt-2"
                            >
                                Clear filters
                            </Button>
                        </Card>
                    ) : (
                        filteredStaffSummaries
                            .sort((a, b) => b.totalActions - a.totalActions)
                            .map((staff) => (
                                <Collapsible
                                    key={staff.userId}
                                    open={expandedStaff.has(staff.userId)}
                                    onOpenChange={() => toggleExpand(staff.userId)}
                                >
                                    <Card>
                                        <CollapsibleTrigger render={
                                            <div className="p-4 cursor-pointer hover:bg-muted/50">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                            <User className="h-5 w-5 text-primary" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">{staff.userName}</span>
                                                                <Badge variant="outline" className="capitalize">
                                                                    {staff.role}
                                                                </Badge>
                                                                {getInactivityBadge(staff.currentInactivityDays)}
                                                            </div>
                                                            <p className="text-sm text-muted-foreground">
                                                                Last active: {formatRelativeTime(staff.lastActivityAt)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-6">
                                                        <div className="text-right">
                                                            <p className="text-2xl font-bold">{staff.totalActions}</p>
                                                            <p className="text-xs text-muted-foreground">actions</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className={`text-lg font-semibold ${getActivityRateColor(staff.activityRate)}`}>
                                                                {staff.activityRate.toFixed(0)}%
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">activity rate</p>
                                                        </div>
                                                        <Button variant="ghost" size="icon">
                                                            {expandedStaff.has(staff.userId) ? (
                                                                <ChevronUp className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronDown className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        } />

                                        <CollapsibleContent>
                                            <div className="px-4 pb-4 pt-2 border-t">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                    {/* Activity Stats */}
                                                    <div className="space-y-4">
                                                        <h4 className="font-medium text-sm">Activity Stats</h4>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-muted-foreground">Today</span>
                                                                <span className="font-medium">{staff.actionsToday}</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-muted-foreground">This Week</span>
                                                                <span className="font-medium">{staff.actionsThisWeek}</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-muted-foreground">This Month</span>
                                                                <span className="font-medium">{staff.actionsThisMonth}</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-muted-foreground">Avg/Day</span>
                                                                <span className="font-medium">{staff.averageActionsPerDay.toFixed(1)}</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-muted-foreground">Active Days</span>
                                                                <span className="font-medium">{staff.activeDaysCount} / {staff.totalDaysInPeriod}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Activity Patterns */}
                                                    <div className="space-y-4">
                                                        <h4 className="font-medium text-sm">Patterns</h4>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-muted-foreground">Most Active Hour</span>
                                                                <span className="font-medium">
                                                                    {staff.mostActiveHour}:00 - {staff.mostActiveHour + 1}:00
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-muted-foreground">Most Active Day</span>
                                                                <span className="font-medium">{staff.mostActiveDay}</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-muted-foreground">First Activity</span>
                                                                <span className="font-medium">{formatDate(staff.firstActivityAt)}</span>
                                                            </div>
                                                        </div>

                                                        {/* Actions by type */}
                                                        <div className="pt-2">
                                                            <p className="text-xs text-muted-foreground mb-2">Actions by Type</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {Object.entries(staff.actionsByType).map(([type, count]) => (
                                                                    <Badge key={type} variant="secondary" className="text-xs">
                                                                        {type}: {count}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Inactivity Analysis */}
                                                    <div className="space-y-4">
                                                        <h4 className="font-medium text-sm">Inactivity Analysis</h4>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-muted-foreground">Current Gap</span>
                                                                <span className={`font-medium ${staff.currentInactivityDays > 3 ? 'text-red-600' : ''}`}>
                                                                    {staff.currentInactivityDays} days
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-muted-foreground">Longest Gap</span>
                                                                <span className="font-medium">{staff.longestInactivityStreak} days</span>
                                                            </div>
                                                        </div>

                                                        {staff.inactivityPeriods.length > 0 && (
                                                            <div className="pt-2">
                                                                <p className="text-xs text-muted-foreground mb-2">Inactivity Periods</p>
                                                                <div className="space-y-1">
                                                                    {staff.inactivityPeriods.slice(0, 3).map((period, i) => (
                                                                        <div key={i} className="text-xs text-muted-foreground">
                                                                            {period.startDate} → {period.endDate} ({period.durationDays}d)
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </CollapsibleContent>
                                    </Card>
                                </Collapsible>
                            ))
                    )}
                </TabsContent>

                {/* Leaderboard */}
                <TabsContent value="leaderboard" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Activity Leaderboard</CardTitle>
                            <CardDescription>Top performers by total actions in the selected period</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">#</TableHead>
                                        <TableHead>Staff Member</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                        <TableHead className="text-right">Avg/Day</TableHead>
                                        <TableHead className="text-right">Activity Rate</TableHead>
                                        <TableHead>Most Active Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {staffSummaries
                                        .sort((a, b) => b.totalActions - a.totalActions)
                                        .map((staff, index) => (
                                            <TableRow key={staff.userId}>
                                                <TableCell className="font-medium">
                                                    {index < 3 ? (
                                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                            index === 1 ? 'bg-gray-200 text-gray-700' :
                                                                'bg-orange-100 text-orange-700'
                                                            }`}>
                                                            {index + 1}
                                                        </span>
                                                    ) : (
                                                        index + 1
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{staff.userName}</span>
                                                        <Badge variant="outline" className="capitalize text-xs">
                                                            {staff.role}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {staff.totalActions.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {staff.averageActionsPerDay.toFixed(1)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className={getActivityRateColor(staff.activityRate)}>
                                                        {staff.activityRate.toFixed(0)}%
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {staff.mostActiveDay}, {staff.mostActiveHour}:00
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Inactive Staff */}
                <TabsContent value="inactive" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                                Inactive Staff
                            </CardTitle>
                            <CardDescription>Staff members with no activity for more than 3 days</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {teamOverview && teamOverview.inactiveStaff.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <TrendingUp className="h-12 w-12 mx-auto mb-4 text-green-500" />
                                    <p className="font-medium text-green-600">All staff members are active!</p>
                                    <p className="text-sm">Everyone has activity within the last 3 days.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Staff Member</TableHead>
                                            <TableHead>Last Activity</TableHead>
                                            <TableHead className="text-right">Inactive Days</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {teamOverview?.inactiveStaff.map((staff) => (
                                            <TableRow key={staff.userId}>
                                                <TableCell className="font-medium">{staff.userName}</TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {formatRelativeTime(staff.lastActive)}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-red-600">
                                                    {staff.inactiveDays} days
                                                </TableCell>
                                                <TableCell>
                                                    {getInactivityBadge(staff.inactiveDays)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
