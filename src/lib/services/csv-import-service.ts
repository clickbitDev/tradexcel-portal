'use client';

import Papa from 'papaparse';
import { createClient } from '@/lib/supabase/client';

export interface CSVImportResult {
    success: boolean;
    totalRows: number;
    successfulRows: number;
    failedRows: number;
    errors: Array<{ row: number; field: string; message: string }>;
    createdApplicationIds: string[];
}

export interface CSVRow {
    student_first_name: string;
    student_last_name: string;
    student_email?: string;
    student_phone?: string;
    student_dob?: string;
    student_passport_number?: string;
    student_nationality?: string;
    qualification_code: string;
    rto_code?: string;
    partner_name?: string;
    appointment_date?: string;
    appointment_time?: string;
    appointment_datetime?: string;
    notes?: string;
}

export interface ParsedCSVData {
    headers: string[];
    rows: Record<string, string>[];
    errors: Array<{ row: number; message: string }>;
}

// Required fields for application import
const REQUIRED_FIELDS = ['student_first_name', 'student_last_name', 'qualification_code'];

// Field aliases for flexible matching
const FIELD_ALIASES: Record<string, string[]> = {
    student_first_name: ['first_name', 'firstname', 'first name', 'given_name', 'given name'],
    student_last_name: ['last_name', 'lastname', 'last name', 'surname', 'family_name', 'family name'],
    student_email: ['email', 'email_address', 'email address', 'student email'],
    student_phone: ['phone', 'mobile', 'phone_number', 'phone number', 'contact'],
    student_dob: ['dob', 'date_of_birth', 'date of birth', 'birthdate', 'birth_date', 'birthday'],
    student_passport_number: ['passport', 'passport_number', 'passport number', 'passport_no'],
    student_nationality: ['nationality', 'country', 'citizen'],
    qualification_code: ['qualification', 'qual_code', 'qual code', 'course_code', 'course code', 'course'],
    rto_code: ['rto', 'rto_code', 'provider_code', 'provider code'],
    partner_name: ['partner', 'agent', 'agent_name', 'agent name', 'company'],
    appointment_date: ['appointment', 'appointment_date', 'intake', 'intake_date', 'start_date', 'start date', 'commencement'],
    appointment_time: ['appointment_time', 'time', 'appointment time', 'start_time', 'start time'],
    appointment_datetime: ['appointment_datetime', 'appointment date time', 'appointment datetime'],
    notes: ['note', 'comments', 'comment', 'remarks'],
};

/**
 * Parse a CSV file and return structured data
 */
export function parseCSVFile(file: File): Promise<ParsedCSVData> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim().toLowerCase(),
            complete: (results) => {
                const headers = results.meta.fields || [];
                const rows = results.data as Record<string, string>[];
                const errors: Array<{ row: number; message: string }> = [];

                // Add parsing errors
                results.errors.forEach((err) => {
                    errors.push({
                        row: err.row || 0,
                        message: err.message,
                    });
                });

                resolve({ headers, rows, errors });
            },
            error: (error) => {
                reject(new Error(`Failed to parse CSV: ${error.message}`));
            },
        });
    });
}

/**
 * Normalize CSV headers to match expected field names
 */
export function normalizeHeaders(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};

    headers.forEach((header) => {
        const normalizedHeader = header.trim().toLowerCase();

        // Direct match
        if (Object.keys(FIELD_ALIASES).includes(normalizedHeader)) {
            mapping[header] = normalizedHeader;
            return;
        }

        // Alias match
        for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
            if (aliases.includes(normalizedHeader)) {
                mapping[header] = field;
                return;
            }
        }

        // Keep original if no match
        mapping[header] = normalizedHeader;
    });

    return mapping;
}

/**
 * Validate a single row of CSV data
 */
export function validateRow(row: Record<string, string>, rowIndex: number, headerMapping: Record<string, string>): {
    isValid: boolean;
    normalizedRow: Partial<CSVRow>;
    errors: Array<{ row: number; field: string; message: string }>;
} {
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const normalizedRow: Partial<CSVRow> = {};

    // Map row data using normalized headers
    for (const [originalHeader, value] of Object.entries(row)) {
        const mappedField = headerMapping[originalHeader];
        if (mappedField && value?.trim()) {
            (normalizedRow as any)[mappedField] = value.trim();
        }
    }

    // Check required fields
    for (const field of REQUIRED_FIELDS) {
        if (!(normalizedRow as any)[field]) {
            errors.push({
                row: rowIndex + 1,
                field,
                message: `Missing required field: ${field}`,
            });
        }
    }

    // Validate email format if provided
    if (normalizedRow.student_email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedRow.student_email)) {
            errors.push({
                row: rowIndex + 1,
                field: 'student_email',
                message: 'Invalid email format',
            });
        }
    }

    // Validate date format if provided
    if (normalizedRow.student_dob) {
        const date = new Date(normalizedRow.student_dob);
        if (isNaN(date.getTime())) {
            errors.push({
                row: rowIndex + 1,
                field: 'student_dob',
                message: 'Invalid date format for DOB',
            });
        }
    }

    return {
        isValid: errors.length === 0,
        normalizedRow,
        errors,
    };
}

/**
 * Import applications from parsed CSV data
 */
export async function importApplicationsFromCSV(
    rows: Record<string, string>[],
    headerMapping: Record<string, string>
): Promise<CSVImportResult> {
    const supabase = createClient();
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const createdApplicationIds: string[] = [];
    let successfulRows = 0;
    let failedRows = 0;

    // Fetch qualifications for lookup
    const { data: qualifications } = await supabase
        .from('qualifications')
        .select('id, code, name');

    const qualificationMap = new Map(
        qualifications?.map((q) => [q.code.toLowerCase(), q]) || []
    );

    // Fetch partners for lookup
    const { data: partners } = await supabase
        .from('partners')
        .select('id, company_name');

    const partnerMap = new Map(
        partners?.map((p) => [p.company_name.toLowerCase(), p]) || []
    );

    // Process each row
    for (let i = 0; i < rows.length; i++) {
        const { isValid, normalizedRow, errors: rowErrors } = validateRow(rows[i], i, headerMapping);

        if (!isValid) {
            errors.push(...rowErrors);
            failedRows++;
            continue;
        }

        // Look up qualification
        const qualification = qualificationMap.get(normalizedRow.qualification_code?.toLowerCase() || '');
        if (!qualification) {
            errors.push({
                row: i + 1,
                field: 'qualification_code',
                message: `Qualification not found: ${normalizedRow.qualification_code}`,
            });
            failedRows++;
            continue;
        }

        // Look up partner if provided
        let partnerId: string | null = null;
        if (normalizedRow.partner_name) {
            const partner = partnerMap.get(normalizedRow.partner_name.toLowerCase());
            if (partner) {
                partnerId = partner.id;
            }
        }

        // Create application
        const response = await fetch('/api/applications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                qualification_id: qualification.id,
                partner_id: partnerId,
                student_first_name: normalizedRow.student_first_name,
                student_last_name: normalizedRow.student_last_name,
                student_email: normalizedRow.student_email || null,
                student_phone: normalizedRow.student_phone || null,
                student_dob: normalizedRow.student_dob || null,
                student_passport_number: normalizedRow.student_passport_number || null,
                student_nationality: normalizedRow.student_nationality || null,
                appointment_date: normalizedRow.appointment_datetime
                    ? normalizedRow.appointment_datetime.split('T')[0] || null
                    : (normalizedRow.appointment_date || null),
                appointment_time: normalizedRow.appointment_datetime
                    ? (normalizedRow.appointment_datetime.split('T')[1]?.slice(0, 5) || null)
                    : (normalizedRow.appointment_time || null),
                notes: normalizedRow.notes || null,
            }),
        });

        const payload = await response.json().catch(() => null) as { data?: { id?: string }; error?: string } | null;

        if (!response.ok || !payload?.data?.id) {
            errors.push({
                row: i + 1,
                field: 'database',
                message: payload?.error || 'Failed to create application',
            });
            failedRows++;
        } else {
            createdApplicationIds.push(payload.data.id);
            successfulRows++;
        }
    }

    return {
        success: failedRows === 0,
        totalRows: rows.length,
        successfulRows,
        failedRows,
        errors,
        createdApplicationIds,
    };
}

/**
 * Generate a sample CSV template
 */
export function generateCSVTemplate(): string {
    const headers = [
        'student_first_name',
        'student_last_name',
        'student_email',
        'student_phone',
        'student_dob',
        'student_passport_number',
        'student_nationality',
        'qualification_code',
        'rto_code',
        'partner_name',
        'appointment_date',
        'appointment_time',
        'appointment_datetime',
        'notes',
    ];

    const sampleRow = [
        'John',
        'Doe',
        'john.doe@example.com',
        '+61412345678',
        '1990-01-15',
        'PA1234567',
        'Australia',
        'BSB40120',
        '45760',
        'Sample Agent',
        '2026-03-01',
        'Sample notes',
    ];

    return [headers.join(','), sampleRow.join(',')].join('\n');
}
