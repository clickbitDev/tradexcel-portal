'use client';

import { useEffect } from 'react';
import { initializeChunkErrorHandlers } from '@/lib/chunk-error-handler';

/**
 * Client component to initialize chunk loading error handlers
 * This should be added to the root layout
 */
export function ChunkErrorHandler() {
  useEffect(() => {
    initializeChunkErrorHandlers();
  }, []);

  return null;
}
