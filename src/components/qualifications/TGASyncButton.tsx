/**
 * TGA Sync Button Component
 * 
 * Client component for triggering TGA API sync
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { syncQualificationWithTGA } from '@/lib/services/qualification-sync';
import { RefreshCw, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TGASyncButtonProps {
  qualificationId: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
}

export function TGASyncButton({ qualificationId, size = 'sm', variant = 'outline' }: TGASyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const router = useRouter();

  const handleSync = async () => {
    setSyncing(true);
    setStatus('idle');

    try {
      const result = await syncQualificationWithTGA(qualificationId, { updateUnits: true });

      if (result.success) {
        setStatus('success');
        // Refresh the page to show updated data
        router.refresh();

        // Reset status after 3 seconds
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('error');
        console.error('Sync failed:', result.error);
        setTimeout(() => setStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('Sync error:', error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button onClick={handleSync} disabled={syncing} variant={variant} size={size}>
      {syncing ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Syncing...
        </>
      ) : status === 'success' ? (
        <>
          <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
          Synced
        </>
      ) : status === 'error' ? (
        <>
          <XCircle className="h-4 w-4 mr-2 text-red-600" />
          Failed
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync with TGA
        </>
      )}
    </Button>
  );
}
