'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseLockOptions {
    tableName: string;
    recordId: string;
    lockTimeoutMinutes?: number; // How long before a lock expires
    refreshIntervalMs?: number; // How often to refresh the lock
}

interface LockState {
    isLocked: boolean;
    lockedBy: string | null;
    lockedByName: string | null;
    lockedAt: Date | null;
    isOwnLock: boolean;
    canEdit: boolean;
}

interface UseLockReturn {
    lockState: LockState;
    acquireLock: () => Promise<boolean>;
    releaseLock: () => Promise<void>;
    isLoading: boolean;
    error: string | null;
}

const LOCK_TIMEOUT_MINUTES = 15; // Default: lock expires after 15 minutes
const LOCK_REFRESH_INTERVAL_MS = 60000; // Refresh lock every minute

export function useRecordLock({
    tableName,
    recordId,
    lockTimeoutMinutes = LOCK_TIMEOUT_MINUTES,
    refreshIntervalMs = LOCK_REFRESH_INTERVAL_MS,
}: UseLockOptions): UseLockReturn {
    const supabase = createClient();
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const [lockState, setLockState] = useState<LockState>({
        isLocked: false,
        lockedBy: null,
        lockedByName: null,
        lockedAt: null,
        isOwnLock: false,
        canEdit: true,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Get current user on mount
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUserId(user?.id || null);
        };
        getUser();
    }, [supabase]);

    // Check lock status
    const checkLockStatus = useCallback(async () => {
        if (!recordId) return;

        try {
            const { data, error: fetchError } = await supabase
                .from(tableName)
                .select(`
                    locked_by,
                    lock_timestamp
                `)
                .eq('id', recordId)
                .single();

            if (fetchError) {
                console.error('Error checking lock:', fetchError);
                return;
            }

            const lockedBy = data?.locked_by;
            const lockTimestamp = data?.lock_timestamp ? new Date(data.lock_timestamp) : null;

            let lockerProfile: { full_name?: string } | null = null;
            if (lockedBy) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', lockedBy)
                    .single();
                lockerProfile = profileData;
            }

            // Check if lock has expired
            const lockExpired = lockTimestamp
                ? (new Date().getTime() - lockTimestamp.getTime()) > (lockTimeoutMinutes * 60 * 1000)
                : true;

            const isLocked = !!lockedBy && !lockExpired;
            const isOwnLock = isLocked && lockedBy === currentUserId;

            setLockState({
                isLocked,
                lockedBy: isLocked ? lockedBy : null,
                lockedByName: isLocked ? lockerProfile?.full_name || null : null,
                lockedAt: isLocked ? lockTimestamp : null,
                isOwnLock,
                canEdit: !isLocked || isOwnLock,
            });
        } catch (err) {
            console.error('Error checking lock status:', err);
        }
    }, [supabase, tableName, recordId, currentUserId, lockTimeoutMinutes]);

    // Initial check and polling
    useEffect(() => {
        if (currentUserId && recordId) {
            setIsLoading(true);
            checkLockStatus().finally(() => setIsLoading(false));

            // Poll for lock status changes
            const pollInterval = setInterval(checkLockStatus, 5000); // Check every 5 seconds
            return () => clearInterval(pollInterval);
        }
    }, [currentUserId, recordId, checkLockStatus]);

    // Acquire lock
    const acquireLock = useCallback(async (): Promise<boolean> => {
        if (!currentUserId || !recordId) return false;
        setError(null);

        try {
            // First check if someone else has the lock
            await checkLockStatus();

            if (lockState.isLocked && !lockState.isOwnLock) {
                setError(`This record is currently being edited by ${lockState.lockedByName || 'another user'}`);
                return false;
            }

            // Acquire the lock
            const { error: updateError } = await supabase
                .from(tableName)
                .update({
                    locked_by: currentUserId,
                    lock_timestamp: new Date().toISOString(),
                })
                .eq('id', recordId);

            if (updateError) {
                setError('Failed to acquire lock');
                return false;
            }

            // Start refresh interval
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }

            refreshIntervalRef.current = setInterval(async () => {
                await supabase
                    .from(tableName)
                    .update({ lock_timestamp: new Date().toISOString() })
                    .eq('id', recordId)
                    .eq('locked_by', currentUserId);
            }, refreshIntervalMs);

            await checkLockStatus();
            return true;
        } catch (err) {
            setError('Failed to acquire lock');
            return false;
        }
    }, [supabase, tableName, recordId, currentUserId, lockState, checkLockStatus, refreshIntervalMs]);

    // Release lock
    const releaseLock = useCallback(async (): Promise<void> => {
        if (!currentUserId || !recordId) return;

        // Clear refresh interval
        if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = null;
        }

        try {
            await supabase
                .from(tableName)
                .update({
                    locked_by: null,
                    lock_timestamp: null,
                })
                .eq('id', recordId)
                .eq('locked_by', currentUserId); // Only release if we own the lock

            await checkLockStatus();
        } catch (err) {
            console.error('Error releasing lock:', err);
        }
    }, [supabase, tableName, recordId, currentUserId, checkLockStatus]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
            // Release lock when component unmounts
            if (lockState.isOwnLock) {
                releaseLock();
            }
        };
    }, [lockState.isOwnLock, releaseLock]);

    return {
        lockState,
        acquireLock,
        releaseLock,
        isLoading,
        error,
    };
}
