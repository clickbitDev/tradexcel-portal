/**
 * MentionTextarea Component
 * 
 * A textarea with @mention support for mentioning users.
 * Shows an autocomplete popup when typing "@" followed by characters.
 */

'use client';

import { useState, useRef, useEffect, useCallback, useMemo, KeyboardEvent } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { User, Loader2 } from 'lucide-react';
import { NON_DELETED_PROFILE_FILTER } from '@/lib/staff/profile-filters';

interface UserProfile {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
}

interface MentionTextareaProps {
    value: string;
    onChange: (value: string) => void;
    onMentionsChange?: (mentions: string[]) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function MentionTextarea({
    value,
    onChange,
    onMentionsChange,
    placeholder = 'Add a comment... Use @ to mention users',
    className,
    disabled = false,
}: MentionTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [showMentionPopup, setShowMentionPopup] = useState(false);
    const [mentionSearch, setMentionSearch] = useState('');
    const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });

    // Fetch users on mount
    useEffect(() => {
        async function fetchUsers() {
            setLoading(true);
            const supabase = createClient();
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url')
                .neq('role', 'agent')
                .eq('account_status', 'active')
                .or(NON_DELETED_PROFILE_FILTER)
                .order('full_name', { ascending: true });

            if (!error && data) {
                setUsers(data);
                setLoading(false);
                return;
            }

            const { data: fallbackUsers, error: fallbackError } = await supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url')
                .neq('role', 'agent')
                .or(NON_DELETED_PROFILE_FILTER)
                .order('full_name', { ascending: true });

            if (!fallbackError && fallbackUsers) {
                setUsers(fallbackUsers);
            }
            setLoading(false);
        }

        fetchUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        if (mentionSearch) {
            const search = mentionSearch.toLowerCase();
            return users
                .filter(user =>
                    user.full_name?.toLowerCase().includes(search) ||
                    user.email?.toLowerCase().includes(search)
                );
        }

        return users;
    }, [mentionSearch, users]);

    // Extract mentioned user IDs from content
    const extractMentions = useCallback((text: string): string[] => {
        const mentionPattern = /@\[([^\]]+)\]\(user:([^)]+)\)/g;
        const mentions: string[] = [];
        let match;
        while ((match = mentionPattern.exec(text)) !== null) {
            mentions.push(match[2]); // User ID
        }
        return mentions;
    }, []);

    // Handle text change
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const cursorPos = e.target.selectionStart || 0;

        onChange(newValue);

        // Check if we're in the middle of typing a mention
        const textBeforeCursor = newValue.substring(0, cursorPos);
        const atIndex = textBeforeCursor.lastIndexOf('@');

        if (atIndex !== -1) {
            // Check if there's a space after @ or if @ is at start/after whitespace
            const charBeforeAt = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
            const textAfterAt = textBeforeCursor.substring(atIndex + 1);

            // Only trigger mention if @ is at start or after whitespace, and no spaces in search
            if ((charBeforeAt === ' ' || charBeforeAt === '\n' || atIndex === 0) &&
                !textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
                setMentionSearch(textAfterAt);
                setMentionStartPos(atIndex);
                setShowMentionPopup(true);
                setSelectedIndex(0);

                // Calculate popup position
                if (textareaRef.current) {
                    const textarea = textareaRef.current;
                    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
                    const lines = textBeforeCursor.split('\n');
                    const currentLineNum = lines.length - 1;
                    const top = Math.min((currentLineNum + 1) * lineHeight + 4, 100);
                    setPopupPosition({ top, left: 0 });
                }
            } else {
                setShowMentionPopup(false);
                setMentionStartPos(null);
            }
        } else {
            setShowMentionPopup(false);
            setMentionStartPos(null);
        }

        // Update mentions list
        if (onMentionsChange) {
            onMentionsChange(extractMentions(newValue));
        }
    };

    // Insert mention
    const insertMention = useCallback((user: UserProfile) => {
        if (mentionStartPos === null || !textareaRef.current) return;

        const beforeMention = value.substring(0, mentionStartPos);
        const afterMention = value.substring(textareaRef.current.selectionStart || value.length);

        // Format: @[Name](user:id) - includes user ID for notification matching
        const mentionText = `@[${user.full_name || user.email}](user:${user.id}) `;
        const newValue = beforeMention + mentionText + afterMention;

        onChange(newValue);
        setShowMentionPopup(false);
        setMentionStartPos(null);
        setMentionSearch('');

        // Update mentions list
        if (onMentionsChange) {
            onMentionsChange(extractMentions(newValue));
        }

        // Focus back on textarea
        setTimeout(() => {
            if (textareaRef.current) {
                const newCursorPos = beforeMention.length + mentionText.length;
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);
    }, [mentionStartPos, value, onChange, onMentionsChange, extractMentions]);

    // Handle keyboard navigation
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (!showMentionPopup || filteredUsers.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
                break;
            case 'Enter':
            case 'Tab':
                if (showMentionPopup && filteredUsers[selectedIndex]) {
                    e.preventDefault();
                    insertMention(filteredUsers[selectedIndex]);
                }
                break;
            case 'Escape':
                setShowMentionPopup(false);
                setMentionStartPos(null);
                break;
        }
    };

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
                textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
                setShowMentionPopup(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative flex-1">
            <Textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={cn('min-h-[60px]', className)}
                disabled={disabled}
            />

            {/* Mention Popup */}
            {showMentionPopup && filteredUsers.length > 0 && (
                <div
                    ref={popoverRef}
                    className="absolute z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden"
                    style={{
                        top: popupPosition.top,
                        left: popupPosition.left,
                        minWidth: '240px',
                        maxWidth: '320px'
                    }}
                >
                    <div className="py-1 max-h-60 overflow-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            filteredUsers.map((user, index) => (
                                <button
                                    key={user.id}
                                    type="button"
                                    className={cn(
                                        'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted transition-colors',
                                        index === selectedIndex && 'bg-muted'
                                    )}
                                    onClick={() => insertMention(user)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        {user.avatar_url ? (
                                            <Image
                                                src={user.avatar_url}
                                                alt=""
                                                width={32}
                                                height={32}
                                                unoptimized
                                                className="w-8 h-8 rounded-full object-cover"
                                            />
                                        ) : (
                                            <User className="h-4 w-4 text-primary" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate text-foreground">
                                            {user.full_name || 'Unknown User'}
                                        </p>
                                        {user.email && (
                                            <p className="text-xs text-muted-foreground truncate">
                                                {user.email}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                    <div className="px-3 py-2 border-t border-border bg-muted/50 text-xs text-muted-foreground">
                        Type to search • ↑↓ to navigate • Enter to select
                    </div>
                </div>
            )}

            {/* No results */}
            {showMentionPopup && !loading && filteredUsers.length === 0 && (
                <div
                    ref={popoverRef}
                    className="absolute z-50 bg-popover border border-border rounded-md shadow-lg p-4"
                    style={{
                        top: popupPosition.top,
                        left: popupPosition.left,
                        minWidth: '200px'
                    }}
                >
                    <p className="text-sm text-muted-foreground text-center">
                        No users found
                    </p>
                </div>
            )}
        </div>
    );
}

/**
 * Render comment content with highlighted mentions
 */
export function CommentContent({ content }: { content: string }) {
    // Parse content for @mentions (format: @Name or @[Name](user:id))
    const parts = content.split(/(@\[[^\]]+\]\(user:[^)]+\)|@\S+)/g);

    return (
        <span>
            {parts.map((part, index) => {
                // Check if this is a formatted mention @[Name](user:id)
                const formattedMatch = part.match(/@\[([^\]]+)\]\(user:([^)]+)\)/);
                if (formattedMatch) {
                    return (
                        <span
                            key={index}
                            className="text-primary font-medium bg-primary/10 px-1 rounded"
                        >
                            @{formattedMatch[1]}
                        </span>
                    );
                }

                // Check if this is a simple @mention
                if (part.startsWith('@') && part.length > 1) {
                    return (
                        <span
                            key={index}
                            className="text-primary font-medium bg-primary/10 px-1 rounded"
                        >
                            {part}
                        </span>
                    );
                }

                return <span key={index}>{part}</span>;
            })}
        </span>
    );
}
