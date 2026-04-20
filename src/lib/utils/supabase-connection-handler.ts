/**
 * Supabase Connection Handler
 * 
 * Manages Supabase Realtime WebSocket connections with auto-reconnect
 * and graceful degradation capabilities
 */

import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { logError } from './error-handlers';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface ConnectionHandlerOptions {
    autoReconnect?: boolean;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
    onStatusChange?: (status: ConnectionStatus) => void;
    onError?: (error: Error) => void;
}

const DEFAULT_OPTIONS: Required<ConnectionHandlerOptions> = {
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectDelay: 3000,
    onStatusChange: () => { },
    onError: () => { }
};

/**
 * Manages a Supabase Realtime subscription with auto-reconnection
 */
export class SupabaseConnectionHandler {
    private supabase: SupabaseClient;
    private channel: RealtimeChannel | null = null;
    private status: ConnectionStatus = 'disconnected';
    private reconnectAttempts = 0;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private options: Required<ConnectionHandlerOptions>;
    private isDestroyed = false;

    constructor(
        supabase: SupabaseClient,
        options: ConnectionHandlerOptions = {}
    ) {
        this.supabase = supabase;
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * Subscribe to a Realtime channel
     */
    subscribe(
        channelName: string,
        tableName: string,
        callback: (payload: unknown) => void
    ): void {
        if (this.isDestroyed) {
            console.warn('Cannot subscribe: ConnectionHandler is destroyed');
            return;
        }

        try {
            this.updateStatus('connecting');

            this.channel = this.supabase
                .channel(channelName)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: tableName
                    },
                    (payload) => {
                        this.reconnectAttempts = 0; // Reset on successful message
                        callback(payload);
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        this.updateStatus('connected');
                        this.reconnectAttempts = 0;
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        this.handleConnectionError(
                            new Error(`Subscription ${status.toLowerCase()}`)
                        );
                    } else if (status === 'CLOSED') {
                        this.updateStatus('disconnected');
                        this.handleDisconnection();
                    }
                });

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.handleConnectionError(err);
        }
    }

    /**
     * Unsubscribe and clean up
     */
    async unsubscribe(): Promise<void> {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.channel) {
            try {
                await this.supabase.removeChannel(this.channel);
                this.channel = null;
            } catch (error) {
                logError(error, { context: 'unsubscribe' });
            }
        }

        this.updateStatus('disconnected');
    }

    /**
     * Destroy the handler (prevents reconnection)
     */
    async destroy(): Promise<void> {
        this.isDestroyed = true;
        await this.unsubscribe();
    }

    /**
     * Get current connection status
     */
    getStatus(): ConnectionStatus {
        return this.status;
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.status === 'connected';
    }

    /**
     * Update connection status and notify
     */
    private updateStatus(status: ConnectionStatus): void {
        if (this.status !== status) {
            this.status = status;
            this.options.onStatusChange(status);
        }
    }

    /**
     * Handle connection errors
     */
    private handleConnectionError(error: Error): void {
        logError(error, { context: 'supabase-realtime' });
        this.updateStatus('error');
        this.options.onError(error);
        this.handleDisconnection();
    }

    /**
     * Handle disconnection and attempt reconnection
     */
    private handleDisconnection(): void {
        if (this.isDestroyed || !this.options.autoReconnect) {
            return;
        }

        if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            console.warn('Max reconnection attempts reached');
            this.updateStatus('disconnected');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.options.reconnectDelay * this.reconnectAttempts;

        console.log(
            `Attempting reconnection ${this.reconnectAttempts}/${this.options.maxReconnectAttempts} in ${delay}ms`
        );

        this.reconnectTimeout = setTimeout(() => {
            if (!this.isDestroyed && this.channel) {
                // Attempt to resubscribe
                this.channel.subscribe();
            }
        }, delay);
    }
}

/**
 * Create a simple connection monitor for Supabase
 */
export function createConnectionMonitor(
    supabase: SupabaseClient,
    onStatusChange?: (status: ConnectionStatus) => void
): { status: ConnectionStatus; cleanup: () => void } {
    let status: ConnectionStatus = 'disconnected';

    // Create a minimal channel just to monitor connection
    const channel = supabase
        .channel('connection-monitor')
        .subscribe((channelStatus) => {
            const newStatus: ConnectionStatus =
                channelStatus === 'SUBSCRIBED' ? 'connected' :
                    channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT' ? 'error' :
                        'disconnected';

            if (status !== newStatus) {
                status = newStatus;
                onStatusChange?.(newStatus);
            }
        });

    return {
        get status() {
            return status;
        },
        cleanup: async () => {
            await supabase.removeChannel(channel);
        }
    };
}
