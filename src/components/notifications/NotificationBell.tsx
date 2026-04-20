'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, X, ExternalLink } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    subscribeToNotifications,
    getNotificationIcon,
    getNotificationLink,
    type Notification,
} from '@/lib/services/notification-service';
import { createClient } from '@/lib/supabase/client';

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);

    const loadNotifications = useCallback(async (isMounted: () => boolean) => {
        try {
            setLoading(true);
            const [notifs, count] = await Promise.all([
                getNotifications({ limit: 20 }),
                getUnreadCount(),
            ]);
            // Only update state if still mounted
            if (isMounted()) {
                setNotifications(notifs);
                setUnreadCount(count);
            }
        } catch (err) {
            // Silently handle errors (AbortError, network failures, auth failures)
            // This prevents console spam and crashes during component unmount
            console.debug('NotificationBell: Error loading notifications:', err);
        } finally {
            if (isMounted()) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        let unsubscribe: (() => void) | undefined;
        const isMounted = () => mounted;

        // Load initial notifications
        loadNotifications(isMounted);

        // Subscribe to realtime updates
        const setupRealtime = async () => {
            try {
                const supabase = createClient();
                const { data: { user }, error } = await supabase.auth.getUser();

                // Check if user exists and component is still mounted
                if (error || !user || !mounted) {
                    if (error) {
                        console.debug('NotificationBell: Auth error during realtime setup:', error.message);
                    }
                    return;
                }

                unsubscribe = subscribeToNotifications(user.id, (notification) => {
                    if (mounted) {
                        setNotifications(prev => [notification, ...prev]);
                        setUnreadCount(prev => prev + 1);
                    }
                });
            } catch (err) {
                // Silently handle errors during realtime setup
                console.debug('NotificationBell: Error setting up realtime:', err);
            }
        };

        setupRealtime();

        return () => {
            mounted = false;
            // Immediately cleanup subscription if available
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [loadNotifications]);


    const handleMarkAsRead = async (notificationId: string) => {
        await markAsRead(notificationId);
        setNotifications(prev =>
            prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const handleMarkAllAsRead = async () => {
        await markAllAsRead();
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger render={
                <Button variant="ghost" size="icon" className="relative" />
            }>
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge
                            className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center p-0 text-xs"
                            variant="destructive"
                        >
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                    )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h3 className="font-semibold">Notifications</h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleMarkAllAsRead}
                            className="text-xs h-7"
                        >
                            <CheckCheck className="h-3 w-3 mr-1" />
                            Mark all read
                        </Button>
                    )}
                </div>

                <ScrollArea className="h-[400px]">
                    {loading ? (
                        <div className="p-8 text-center text-muted-foreground">
                            Loading...
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No notifications yet</p>
                        </div>
                    ) : (
                        <div className="py-1">
                            {notifications.map((notification) => {
                                const link = getNotificationLink(notification);
                                const content = (
                                    <div
                                        className={`px-4 py-3 hover:bg-muted/50 cursor-pointer border-b last:border-0 transition-colors ${!notification.is_read ? 'bg-primary/5' : ''
                                            }`}
                                        onClick={() => {
                                            if (!notification.is_read) {
                                                handleMarkAsRead(notification.id);
                                            }
                                            if (link) {
                                                setOpen(false);
                                            }
                                        }}
                                    >
                                        <div className="flex gap-3">
                                            <span className="text-xl flex-shrink-0">
                                                {getNotificationIcon(notification.type)}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-sm font-medium ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'
                                                        }`}>
                                                        {notification.title}
                                                    </p>
                                                    {!notification.is_read && (
                                                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {formatTime(notification.created_at)}
                                                    </span>
                                                    {link && (
                                                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );

                                return link ? (
                                    <Link key={notification.id} href={link}>
                                        {content}
                                    </Link>
                                ) : (
                                    <div key={notification.id}>{content}</div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>

                <DropdownMenuSeparator />
                <div className="p-2">
                    <Link href="/portal/settings/notifications">
                        <Button variant="ghost" size="sm" className="w-full">
                            Notification Settings
                        </Button>
                    </Link>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
