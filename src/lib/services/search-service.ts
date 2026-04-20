/**
 * Global Search Service
 * Provides unified search across all entities
 */

import { createClient } from '@/lib/supabase/client';
import { resolveApplicationId } from '@/lib/application-identifiers';

export interface SearchResult {
    id: string;
    type: 'application' | 'partner' | 'rto' | 'qualification' | 'document';
    title: string;
    subtitle: string;
    url: string;
    metadata?: Record<string, unknown>;
}

export interface SearchResults {
    applications: SearchResult[];
    partners: SearchResult[];
    rtos: SearchResult[];
    qualifications: SearchResult[];
    total: number;
}

const RECENT_SEARCHES_KEY = 'lumiere_recent_searches';
const MAX_RECENT_SEARCHES = 10;

/**
 * Search across all entities
 */
export async function globalSearch(query: string, limit: number = 5): Promise<SearchResults> {
    if (!query || query.length < 2) {
        return { applications: [], partners: [], rtos: [], qualifications: [], total: 0 };
    }

    const supabase = createClient();
    const searchTerm = `%${query}%`;

    // Search in parallel
    const [applications, partners, qualifications] = await Promise.all([
        // Applications
        supabase
            .from('applications')
            .select('id, application_number, student_uid, student_first_name, student_last_name, student_email, workflow_stage')
            .eq('is_deleted', false)
            .or(`application_number.ilike.${searchTerm},student_uid.ilike.${searchTerm},student_first_name.ilike.${searchTerm},student_last_name.ilike.${searchTerm},student_email.ilike.${searchTerm}`)
            .limit(limit),

        // Partners
        supabase
            .from('partners')
            .select('id, company_name, contact_name, email, type, status')
            .eq('is_deleted', false)
            .or(`company_name.ilike.${searchTerm},contact_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
            .limit(limit),

        // Qualifications
        supabase
            .from('qualifications')
            .select('id, code, name, level')
            .or(`code.ilike.${searchTerm},name.ilike.${searchTerm}`)
            .limit(limit),
    ]);

    const results: SearchResults = {
        applications: (applications.data || []).map(app => ({
            id: app.id,
            type: 'application' as const,
            title: `${app.student_first_name} ${app.student_last_name}`,
            subtitle: `${resolveApplicationId(app.application_number, app.student_uid)} • ${app.workflow_stage}`,
            url: `/portal/applications/${app.id}`,
            metadata: { email: app.student_email, stage: app.workflow_stage },
        })),
        partners: (partners.data || []).map(partner => ({
            id: partner.id,
            type: 'partner' as const,
            title: partner.company_name,
            subtitle: `${partner.type} • ${partner.status}`,
            url: `/portal/partners/${partner.id}`,
            metadata: { contact: partner.contact_name, email: partner.email },
        })),
        rtos: [],
        qualifications: (qualifications.data || []).map(qual => ({
            id: qual.id,
            type: 'qualification' as const,
            title: qual.name,
            subtitle: `${qual.code} • ${qual.level}`,
            url: `/portal/qualifications/${qual.id}`,
        })),
        total: 0,
    };

    results.total =
        results.applications.length +
        results.partners.length +
        results.rtos.length +
        results.qualifications.length;

    return results;
}

/**
 * Get recent searches from localStorage
 */
export function getRecentSearches(): string[] {
    if (typeof window === 'undefined') return [];

    try {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

/**
 * Add a search term to recent searches
 */
export function addRecentSearch(term: string): void {
    if (typeof window === 'undefined' || !term.trim()) return;

    try {
        const recent = getRecentSearches();
        const filtered = recent.filter(s => s.toLowerCase() !== term.toLowerCase());
        const updated = [term, ...filtered].slice(0, MAX_RECENT_SEARCHES);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
        // Ignore localStorage errors
    }
}

/**
 * Clear recent searches
 */
export function clearRecentSearches(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(RECENT_SEARCHES_KEY);
}

/**
 * Get icon for search result type
 */
export function getSearchTypeIcon(type: SearchResult['type']): string {
    const icons: Record<SearchResult['type'], string> = {
        application: '📋',
        partner: '🤝',
        rto: '🏫',
        qualification: '🎓',
        document: '📄',
    };
    return icons[type];
}

/**
 * Get color class for search result type
 */
export function getSearchTypeColor(type: SearchResult['type']): string {
    const colors: Record<SearchResult['type'], string> = {
        application: 'bg-blue-100 text-blue-700',
        partner: 'bg-green-100 text-green-700',
        rto: 'bg-purple-100 text-purple-700',
        qualification: 'bg-orange-100 text-orange-700',
        document: 'bg-gray-100 text-gray-700',
    };
    return colors[type];
}
