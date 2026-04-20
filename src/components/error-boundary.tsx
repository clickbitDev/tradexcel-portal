'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorStateCard } from '@/components/error-state-card';
import { toDisplayError } from '@/lib/error-display';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

const CHUNK_RELOAD_GUARD_KEY = 'lumiere:chunk-reload-attempted';

/**
 * Error Boundary component to catch React errors and chunk loading errors
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Check if it's a chunk loading error
    const isChunkError = 
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('ChunkLoadError') ||
      error.name === 'ChunkLoadError';

    if (isChunkError) {
      console.warn('[ErrorBoundary] Chunk loading error detected, attempting recovery...');

      // Keep development stable: no automatic reload loops while coding.
      if (process.env.NODE_ENV !== 'production') {
        return;
      }

      // In production, allow a single automatic recovery reload.
      const hasReloaded = window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) === '1';
      if (hasReloaded) {
        console.warn('[ErrorBoundary] Chunk auto-reload already attempted, skipping');
        return;
      }

      window.sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, '1');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    
    // Also reload the page to ensure fresh state
    window.location.reload();
  };

  componentDidMount() {
    if (process.env.NODE_ENV === 'production') {
      window.sessionStorage.removeItem(CHUNK_RELOAD_GUARD_KEY);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isChunkError = 
        this.state.error?.message?.includes('Loading chunk') ||
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('ChunkLoadError') ||
        this.state.error?.name === 'ChunkLoadError';

      return (
        <ErrorStateCard
          title={isChunkError ? 'Loading Error' : 'Something went wrong'}
          description={isChunkError
            ? 'The application failed to load a required file. This usually happens after a deployment. Use reload to recover.'
            : 'An unexpected error occurred. Please try refreshing the page.'}
          error={toDisplayError(this.state.error)}
          componentStack={this.state.errorInfo?.componentStack || null}
          retryAction={{ label: 'Reload Page', mode: 'reload' }}
          debugContext={{
            boundary: 'src/components/error-boundary.tsx',
            chunkError: isChunkError,
          }}
        />
      );
    }

    return this.props.children;
  }
}
