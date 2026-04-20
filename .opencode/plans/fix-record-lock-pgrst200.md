# Fix: PostgREST PGRST200 Error in useRecordLock

## Problem
The `useRecordLock` hook at `src/hooks/use-record-lock.ts:68-74` uses a PostgREST foreign key relationship to join `applications` with `profiles` via the `locked_by` column:

```typescript
const { data, error: fetchError } = await supabase
    .from(tableName)
    .select(`
        locked_by,
        lock_timestamp,
        locker:profiles!locked_by(full_name)
    `)
    .eq('id', recordId)
    .single();
```

PostgREST returns error `PGRST200` because it cannot find the FK relationship between `applications.locked_by` and `profiles.id` in its schema cache, even though the migration defines it.

## Solution: Two-Step Query

Replace the single join query with two separate queries:
1. Fetch the record's `locked_by` and `lock_timestamp`
2. If `locked_by` exists, fetch the profile separately

## Changes Required

### File: `src/hooks/use-record-lock.ts`

**Lines 64-85** — Replace the `checkLockStatus` function body:

**Before:**
```typescript
const checkLockStatus = useCallback(async () => {
    if (!recordId) return;

    try {
        const { data, error: fetchError } = await supabase
            .from(tableName)
            .select(`
                locked_by,
                lock_timestamp,
                locker:profiles!locked_by(full_name)
            `)
            .eq('id', recordId)
            .single();

        if (fetchError) {
            console.error('Error checking lock:', fetchError);
            return;
        }

        const lockedBy = data?.locked_by;
        const lockTimestamp = data?.lock_timestamp ? new Date(data.lock_timestamp) : null;
        const lockerProfile = data?.locker as { full_name?: string } | null;
```

**After:**
```typescript
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
```

## Impact
- **No functional change**: The hook still retrieves the same data (locked_by, lock_timestamp, locker's full_name)
- **Slightly more network requests**: 2 queries instead of 1 when a lock exists, 1 query when no lock
- **Eliminates PGRST200 error**: No longer depends on PostgREST FK relationship cache
- **No other files affected**: The rest of the codebase uses the hook's return interface, which remains unchanged
