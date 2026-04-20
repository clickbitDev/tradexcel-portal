'use server';

import { createServerClient } from '@/lib/supabase/server';

// Types
export interface TicketComment {
    id: string;
    ticket_id: string;
    user_id: string | null;
    content: string;
    is_internal: boolean;
    created_at: string;
    user?: {
        full_name: string;
        avatar_url: string | null;
    } | null;
}

export interface CreateCommentInput {
    ticket_id: string;
    content: string;
    is_internal?: boolean;
}

// Get comments for a ticket
export async function getTicketComments(ticketId: string): Promise<{ data: TicketComment[] | null; error: string | null }> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from('ticket_comments')
        .select(`
            *,
            user:profiles(full_name, avatar_url)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching ticket comments:', error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Add comment to ticket
export async function addTicketComment(input: CreateCommentInput): Promise<{ data: TicketComment | null; error: string | null }> {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from('ticket_comments')
        .insert({
            ticket_id: input.ticket_id,
            user_id: user?.id || null,
            content: input.content,
            is_internal: input.is_internal ?? false,
        })
        .select(`
            *,
            user:profiles(full_name, avatar_url)
        `)
        .single();

    if (error) {
        console.error('Error adding ticket comment:', error);
        return { data: null, error: error.message };
    }

    // Update ticket's updated_at timestamp
    await supabase
        .from('tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', input.ticket_id);

    return { data, error: null };
}

// Delete comment
export async function deleteTicketComment(commentId: string): Promise<{ error: string | null }> {
    const supabase = await createServerClient();

    const { error } = await supabase
        .from('ticket_comments')
        .delete()
        .eq('id', commentId);

    if (error) {
        console.error('Error deleting ticket comment:', error);
        return { error: error.message };
    }

    return { error: null };
}

// Get comment count for ticket
export async function getTicketCommentCount(ticketId: string): Promise<{ count: number; error: string | null }> {
    const supabase = await createServerClient();

    const { count, error } = await supabase
        .from('ticket_comments')
        .select('*', { count: 'exact', head: true })
        .eq('ticket_id', ticketId);

    if (error) {
        return { count: 0, error: error.message };
    }

    return { count: count || 0, error: null };
}
