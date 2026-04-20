'use client';

// RTO Client Utility Functions
// Browser-only functions for RTO CSV import/export operations

import type { Rto, TgaSyncStatus } from '@/types/database';

// ===========================================
// CSV Export
// ===========================================

export interface RtoExportData {
    code: string;
    name: string;
    status: string;
    location: string;
    state: string;
    phone: string;
    email: string;
    website: string;
    cricos_provider_code: string;
    tga_sync_status: string;
    notes: string;
}

/**
 * Export RTOs to CSV format
 * @param rtos - Array of RTO records to export
 */
export function exportRTOsToCSV(rtos: Rto[]): void {
    const headers = [
        'code',
        'name',
        'status',
        'location',
        'state',
        'phone',
        'email',
        'website',
        'cricos_provider_code',
        'tga_sync_status',
        'notes'
    ];

    const rows = rtos.map((rto) => [
        rto.code,
        rto.name,
        rto.status,
        rto.location || '',
        rto.state || '',
        rto.phone || '',
        rto.email || '',
        rto.website || '',
        rto.cricos_provider_code || '',
        rto.tga_sync_status || 'never',
        rto.notes || ''
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rtos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// ===========================================
// CSV Import
// ===========================================

export interface ParsedRTO {
    code: string;
    name: string;
    status?: 'active' | 'pending' | 'suspended' | 'inactive';
    location?: string;
    state?: string;
    phone?: string;
    email?: string;
    website?: string;
    cricos_provider_code?: string;
    tga_sync_status?: TgaSyncStatus;
    notes?: string;
}

/**
 * Parse CSV file and convert to RTO objects
 * @param file - CSV file to parse
 * @returns Promise resolving to array of parsed RTOs
 */
export async function parseRTOCSV(file: File): Promise<ParsedRTO[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const lines = text.split('\n').filter(line => line.trim());

                if (lines.length < 2) {
                    throw new Error('CSV file must contain headers and at least one row');
                }

                const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                const data: ParsedRTO[] = [];

                for (let i = 1; i < lines.length; i++) {
                    const values = parseCSVLine(lines[i]);
                    const row: Record<string, string> = {};

                    headers.forEach((header, index) => {
                        row[header] = values[index] || '';
                    });

                    data.push({
                        code: row.code,
                        name: row.name,
                        status: row.status as ParsedRTO['status'],
                        location: row.location,
                        state: row.state,
                        phone: row.phone,
                        email: row.email,
                        website: row.website,
                        cricos_provider_code: row.cricos_provider_code,
                        tga_sync_status: row.tga_sync_status as TgaSyncStatus,
                        notes: row.notes
                    });
                }

                resolve(data);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    values.push(current.trim());
    return values;
}
