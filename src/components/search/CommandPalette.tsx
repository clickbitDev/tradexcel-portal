'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Search,
    Command,
    FileText,
    Users,
    Building2,
    GraduationCap,
    Clock,
    Loader2,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePathname, useRouter } from 'next/navigation';
import {
    globalSearch,
    getRecentSearches,
    addRecentSearch,
    clearRecentSearches,
    type SearchResult,
    type SearchResults,
} from '@/lib/services/search-service';
import { usePermissions } from '@/hooks/usePermissions';
import { applyPortalRouteBase, getPortalRouteBase } from '@/lib/routes/portal';

const typeIcons: Record<SearchResult['type'], React.ReactNode> = {
    application: <FileText className="h-4 w-4" />,
    partner: <Users className="h-4 w-4" />,
    rto: <Building2 className="h-4 w-4" />,
    qualification: <GraduationCap className="h-4 w-4" />,
    document: <FileText className="h-4 w-4" />,
};

const typeColors: Record<SearchResult['type'], string> = {
    application: 'bg-blue-100 text-blue-700',
    partner: 'bg-green-100 text-green-700',
    rto: 'bg-purple-100 text-purple-700',
    qualification: 'bg-orange-100 text-orange-700',
    document: 'bg-gray-100 text-gray-700',
};

const typeLabels: Record<SearchResult['type'], string> = {
    application: 'Application',
    partner: 'Partner',
    rto: 'RTO',
    qualification: 'Qualification',
    document: 'Document',
};

interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResults | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const pathname = usePathname();
    const { role } = usePermissions();
    const routeBase = getPortalRouteBase(pathname, role);

    // Get all results as flat array
    const allResults = results
        ? [
            ...results.applications,
            ...results.partners,
            ...results.rtos,
            ...results.qualifications,
        ]
        : [];

    // Load recent searches when opening
    useEffect(() => {
        if (open) {
            setRecentSearches(getRecentSearches());
            setQuery('');
            setResults(null);
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    // Search with debounce
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length >= 2) {
                setLoading(true);
                const searchResults = await globalSearch(query);
                setResults(searchResults);
                setSelectedIndex(0);
                setLoading(false);
            } else {
                setResults(null);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = useCallback((result: SearchResult) => {
        addRecentSearch(query);
        onOpenChange(false);
        router.push(applyPortalRouteBase(result.url, routeBase));
    }, [query, onOpenChange, routeBase, router]);

    const handleRecentSearch = useCallback((term: string) => {
        setQuery(term);
    }, []);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => Math.min(prev + 1, allResults.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter' && allResults[selectedIndex]) {
                e.preventDefault();
                handleSelect(allResults[selectedIndex]);
            } else if (e.key === 'Escape') {
                onOpenChange(false);
            }
        },
        [allResults, selectedIndex, handleSelect, onOpenChange]
    );

    const renderResults = (items: SearchResult[], title: string) => {
        if (items.length === 0) return null;

        return (
            <div className="mb-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
                    {title}
                </h3>
                {items.map((result) => {
                    const globalIndex = allResults.indexOf(result);
                    return (
                        <button
                            key={`${result.type}-${result.id}`}
                            onClick={() => handleSelect(result)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-colors ${globalIndex === selectedIndex
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                                }`}
                        >
                            <span className={`p-1.5 rounded ${globalIndex === selectedIndex
                                ? 'bg-primary-foreground/20'
                                : typeColors[result.type]
                                }`}>
                                {typeIcons[result.type]}
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{result.title}</p>
                                <p className={`text-xs truncate ${globalIndex === selectedIndex
                                    ? 'text-primary-foreground/70'
                                    : 'text-muted-foreground'
                                    }`}>
                                    {result.subtitle}
                                </p>
                            </div>
                            <Badge
                                variant="outline"
                                className={`text-[10px] ${globalIndex === selectedIndex
                                    ? 'border-primary-foreground/30 text-primary-foreground'
                                    : ''
                                    }`}
                            >
                                {typeLabels[result.type]}
                            </Badge>
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
                <DialogTitle className="sr-only">Search</DialogTitle>
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 border-b">
                    <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <Input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search applications, partners, RTOs, qualifications..."
                        className="flex-1 border-0 focus-visible:ring-0 text-base py-6"
                    />
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <ScrollArea className="max-h-[400px]">
                    <div className="p-3">
                        {!query && recentSearches.length > 0 && (
                            <div className="mb-4">
                                <div className="flex items-center justify-between px-3 mb-2">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Recent Searches
                                    </h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => {
                                            clearRecentSearches();
                                            setRecentSearches([]);
                                        }}
                                    >
                                        Clear
                                    </Button>
                                </div>
                                {recentSearches.map((term, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleRecentSearch(term)}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg hover:bg-muted transition-colors"
                                    >
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">{term}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {query && !loading && results && results.total === 0 && (
                            <div className="py-12 text-center text-muted-foreground">
                                <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p>No results found for &ldquo;{query}&rdquo;</p>
                                <p className="text-sm mt-1">Try a different search term</p>
                            </div>
                        )}

                        {results && (
                            <>
                                {renderResults(results.applications, 'Applications')}
                                {renderResults(results.partners, 'Partners')}
                                {renderResults(results.rtos, 'RTOs')}
                                {renderResults(results.qualifications, 'Qualifications')}
                            </>
                        )}

                        {!query && recentSearches.length === 0 && (
                            <div className="py-12 text-center text-muted-foreground">
                                <Command className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p>Start typing to search</p>
                                <p className="text-sm mt-1">
                                    Search across applications, partners, RTOs, and qualifications
                                </p>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/50 text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded border bg-background">↑</kbd>
                            <kbd className="px-1.5 py-0.5 rounded border bg-background">↓</kbd>
                            to navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded border bg-background">Enter</kbd>
                            to select
                        </span>
                    </div>
                    {results && results.total > 0 && (
                        <span>{results.total} results</span>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Search trigger button for header
export function SearchTrigger({ onClick }: { onClick: () => void }) {
    // Keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                onClick();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClick]);

    return (
        <Button
            variant="outline"
            className="relative h-9 w-full justify-start items-center text-sm text-muted-foreground sm:pr-12 md:w-64"
            onClick={onClick}
        >
            <Search className="mr-2 h-4 w-4 flex-shrink-0" />
            <span className="hidden lg:inline-flex items-center">Search...</span>
            <span className="inline-flex lg:hidden items-center">Search</span>
            <kbd className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
                <span className="text-xs">⌘</span>K
            </kbd>
        </Button>
    );
}
