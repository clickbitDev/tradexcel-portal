// RTO Server Utility Functions
// Server-safe validation and types (NO browser APIs)

import type { TgaSyncStatus } from '@/types/database';

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

export interface ValidationError {
    row: number;
    field: string;
    message: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    data: ParsedRTO[];
}

export function validateRTOData(data: ParsedRTO[]): ValidationResult {
    const errors: ValidationError[] = [];
    const validStatuses = ['active', 'pending', 'suspended', 'inactive'];
    const validSyncStatuses = ['synced', 'pending', 'error', 'never'];
    const codes = new Set<string>();

    data.forEach((rto, index) => {
        const rowNum = index + 2;

        if (!rto.code || !rto.code.trim()) {
            errors.push({ row: rowNum, field: 'code', message: 'Code is required' });
        }

        if (!rto.name || !rto.name.trim()) {
            errors.push({ row: rowNum, field: 'name', message: 'Name is required' });
        }

        if (rto.code) {
            if (codes.has(rto.code)) {
                errors.push({ row: rowNum, field: 'code', message: `Duplicate code: ${rto.code}` });
            }
            codes.add(rto.code);
        }

        if (rto.status && !validStatuses.includes(rto.status)) {
            errors.push({ 
                row: rowNum, 
                field: 'status', 
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
            });
        }

        if (rto.tga_sync_status && !validSyncStatuses.includes(rto.tga_sync_status)) {
            errors.push({ 
                row: rowNum, 
                field: 'tga_sync_status', 
                message: `Invalid TGA sync status. Must be one of: ${validSyncStatuses.join(', ')}` 
            });
        }

        if (rto.email && rto.email.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(rto.email)) {
                errors.push({ row: rowNum, field: 'email', message: 'Invalid email format' });
            }
        }

        if (rto.website && rto.website.trim()) {
            try {
                new URL(rto.website.startsWith('http') ? rto.website : `https://${rto.website}`);
            } catch {
                errors.push({ row: rowNum, field: 'website', message: 'Invalid website URL' });
            }
        }
    });

    return { valid: errors.length === 0, errors, data };
}
