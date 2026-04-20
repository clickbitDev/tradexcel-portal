/**
 * Staff Activity Service
 * Provides analytics on employee activity, productivity, and engagement
 */

import { createClient } from '@/lib/supabase/client';

export interface StaffActivitySummary {
    userId: string;
    userName: string;
    avatarUrl?: string;
    email: string;
    role: string;
    // Activity counts
    totalActions: number;
    actionsToday: number;
    actionsThisWeek: number;
    actionsThisMonth: number;
    // Activity breakdown
    actionsByType: Record<string, number>;
    actionsByTable: Record<string, number>;
    // Time-based metrics
    firstActivityAt: string | null;
    lastActivityAt: string | null;
    averageActionsPerDay: number;
    mostActiveHour: number;
    mostActiveDay: string;
    // Inactivity analysis
    currentInactivityDays: number;
    longestInactivityStreak: number;
    inactivityPeriods: Array<{
        startDate: string;
        endDate: string;
        durationDays: number;
    }>;
    // Session analysis
    activeDaysCount: number;
    totalDaysInPeriod: number;
    activityRate: number; // percentage of days with activity
}

export interface DailyActivity {
    date: string;
    count: number;
    actions: Record<string, number>;
}

export interface HourlyDistribution {
    hour: number;
    count: number;
}

/**
 * Get activity summary for a specific staff member
 */
export async function getStaffActivitySummary(
    userId: string,
    daysBack: number = 30
): Promise<StaffActivitySummary | null> {
    const supabase = createClient();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    // Fetch user profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email, role')
        .eq('id', userId)
        .single();

    if (!profile) return null;

    // Fetch all activity for this user
    const { data: activities } = await supabase
        .from('record_activity')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', fromDate.toISOString())
        .order('created_at', { ascending: true });

    const allActivities = activities || [];

    // Calculate metrics
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    const actionsToday = allActivities.filter(a => new Date(a.created_at) >= todayStart).length;
    const actionsThisWeek = allActivities.filter(a => new Date(a.created_at) >= weekStart).length;
    const actionsThisMonth = allActivities.filter(a => new Date(a.created_at) >= monthStart).length;

    // Action breakdown
    const actionsByType: Record<string, number> = {};
    const actionsByTable: Record<string, number> = {};
    const hourCounts: number[] = new Array(24).fill(0);
    const dayCounts: Record<string, number> = {};
    const activeDates = new Set<string>();

    for (const activity of allActivities) {
        // By type
        actionsByType[activity.action] = (actionsByType[activity.action] || 0) + 1;
        // By table
        actionsByTable[activity.table_name] = (actionsByTable[activity.table_name] || 0) + 1;
        // By hour
        const hour = new Date(activity.created_at).getHours();
        hourCounts[hour]++;
        // By day of week
        const dayName = new Date(activity.created_at).toLocaleDateString('en-US', { weekday: 'long' });
        dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
        // Track active dates
        const dateKey = new Date(activity.created_at).toISOString().split('T')[0];
        activeDates.add(dateKey);
    }

    // Find most active hour
    const mostActiveHour = hourCounts.indexOf(Math.max(...hourCounts));

    // Find most active day
    const mostActiveDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // Calculate inactivity periods
    const sortedDates = Array.from(activeDates).sort();
    const inactivityPeriods: StaffActivitySummary['inactivityPeriods'] = [];
    let longestInactivityStreak = 0;

    for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i - 1]);
        const currDate = new Date(sortedDates[i]);
        const gapDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)) - 1;

        if (gapDays > 1) { // Only track gaps > 1 day (excludes weekends naturally)
            inactivityPeriods.push({
                startDate: new Date(prevDate.getTime() + 86400000).toISOString().split('T')[0],
                endDate: new Date(currDate.getTime() - 86400000).toISOString().split('T')[0],
                durationDays: gapDays,
            });
            if (gapDays > longestInactivityStreak) {
                longestInactivityStreak = gapDays;
            }
        }
    }

    // Current inactivity
    const lastActivityDate = allActivities.length > 0
        ? new Date(allActivities[allActivities.length - 1].created_at)
        : null;
    const currentInactivityDays = lastActivityDate
        ? Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
        : daysBack;

    // Activity rate
    const totalDaysInPeriod = daysBack;
    const activeDaysCount = activeDates.size;
    const activityRate = totalDaysInPeriod > 0 ? (activeDaysCount / totalDaysInPeriod) * 100 : 0;

    return {
        userId: profile.id,
        userName: profile.full_name || 'Unknown',
        avatarUrl: profile.avatar_url,
        email: profile.email,
        role: profile.role,
        totalActions: allActivities.length,
        actionsToday,
        actionsThisWeek,
        actionsThisMonth,
        actionsByType,
        actionsByTable,
        firstActivityAt: allActivities[0]?.created_at || null,
        lastActivityAt: allActivities[allActivities.length - 1]?.created_at || null,
        averageActionsPerDay: activeDaysCount > 0 ? allActivities.length / activeDaysCount : 0,
        mostActiveHour,
        mostActiveDay,
        currentInactivityDays,
        longestInactivityStreak,
        inactivityPeriods: inactivityPeriods.sort((a, b) => b.durationDays - a.durationDays).slice(0, 5),
        activeDaysCount,
        totalDaysInPeriod,
        activityRate,
    };
}

/**
 * Get activity summaries for all staff members
 */
export async function getAllStaffActivitySummaries(
    daysBack: number = 30
): Promise<StaffActivitySummary[]> {
    const supabase = createClient();

    // Get all staff members (non-agent roles)
    const { data: staff } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'accounts_manager', 'assessor', 'dispatch_coordinator', 'frontdesk', 'executive_manager', 'developer', 'ceo']);

    if (!staff) return [];

    const summaries = await Promise.all(
        staff.map(s => getStaffActivitySummary(s.id, daysBack))
    );

    return summaries.filter((s): s is StaffActivitySummary => s !== null);
}

/**
 * Get daily activity breakdown for a user
 */
export async function getDailyActivityBreakdown(
    userId: string,
    daysBack: number = 30
): Promise<DailyActivity[]> {
    const supabase = createClient();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const { data: activities } = await supabase
        .from('record_activity')
        .select('action, created_at')
        .eq('user_id', userId)
        .gte('created_at', fromDate.toISOString());

    if (!activities) return [];

    const dailyMap: Record<string, { count: number; actions: Record<string, number> }> = {};

    // Initialize all days in range
    for (let i = 0; i < daysBack; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        dailyMap[dateKey] = { count: 0, actions: {} };
    }

    // Fill in actual data
    for (const activity of activities) {
        const dateKey = new Date(activity.created_at).toISOString().split('T')[0];
        if (dailyMap[dateKey]) {
            dailyMap[dateKey].count++;
            dailyMap[dateKey].actions[activity.action] = (dailyMap[dateKey].actions[activity.action] || 0) + 1;
        }
    }

    return Object.entries(dailyMap)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get hourly activity distribution
 */
export async function getHourlyDistribution(
    userId: string,
    daysBack: number = 30
): Promise<HourlyDistribution[]> {
    const supabase = createClient();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const { data: activities } = await supabase
        .from('record_activity')
        .select('created_at')
        .eq('user_id', userId)
        .gte('created_at', fromDate.toISOString());

    if (!activities) return [];

    const hourCounts = new Array(24).fill(0);

    for (const activity of activities) {
        const hour = new Date(activity.created_at).getHours();
        hourCounts[hour]++;
    }

    return hourCounts.map((count, hour) => ({ hour, count }));
}

/**
 * Get team overview stats
 */
export async function getTeamOverview(daysBack: number = 30): Promise<{
    totalStaff: number;
    activeToday: number;
    activeThisWeek: number;
    totalActions: number;
    topPerformers: Array<{ userId: string; userName: string; actions: number }>;
    inactiveStaff: Array<{ userId: string; userName: string; lastActive: string | null; inactiveDays: number }>;
}> {
    const summaries = await getAllStaffActivitySummaries(daysBack);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    return {
        totalStaff: summaries.length,
        activeToday: summaries.filter(s => s.actionsToday > 0).length,
        activeThisWeek: summaries.filter(s => s.actionsThisWeek > 0).length,
        totalActions: summaries.reduce((sum, s) => sum + s.totalActions, 0),
        topPerformers: summaries
            .sort((a, b) => b.totalActions - a.totalActions)
            .slice(0, 5)
            .map(s => ({ userId: s.userId, userName: s.userName, actions: s.totalActions })),
        inactiveStaff: summaries
            .filter(s => s.currentInactivityDays > 3) // Inactive for more than 3 days
            .sort((a, b) => b.currentInactivityDays - a.currentInactivityDays)
            .map(s => ({
                userId: s.userId,
                userName: s.userName,
                lastActive: s.lastActivityAt,
                inactiveDays: s.currentInactivityDays,
            })),
    };
}

/**
 * Get team-wide daily activity breakdown (all staff combined)
 */
export async function getTeamDailyBreakdown(
    daysBack: number = 30
): Promise<Array<{
    date: string;
    total: number;
    byUser: Record<string, { name: string; count: number }>;
}>> {
    const supabase = createClient();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    // Get all activity with user info
    const { data: activities } = await supabase
        .from('record_activity')
        .select('user_id, created_at, profiles!record_activity_user_id_fkey(full_name)')
        .gte('created_at', fromDate.toISOString())
        .order('created_at', { ascending: true });

    if (!activities) return [];

    // Initialize all days
    const dailyMap: Record<string, { total: number; byUser: Record<string, { name: string; count: number }> }> = {};
    for (let i = 0; i < daysBack; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        dailyMap[dateKey] = { total: 0, byUser: {} };
    }

    // Aggregate activity
    for (const activity of activities) {
        const dateKey = new Date(activity.created_at).toISOString().split('T')[0];
        if (dailyMap[dateKey]) {
            dailyMap[dateKey].total++;
            const userId = activity.user_id || 'unknown';
            const userName = (activity.profiles as any)?.full_name || 'Unknown';
            if (!dailyMap[dateKey].byUser[userId]) {
                dailyMap[dateKey].byUser[userId] = { name: userName, count: 0 };
            }
            dailyMap[dateKey].byUser[userId].count++;
        }
    }

    return Object.entries(dailyMap)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));
}
