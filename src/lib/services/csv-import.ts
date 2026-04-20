/**
 * CSV Import/Export Service for Qualifications
 * 
 * Handles bulk import and export of qualifications and units
 */

'use server';

import Papa from 'papaparse';
import { createServerClient } from '@/lib/supabase/server';
import type {
    QualificationCSVRow,
    UnitImportRow,
    ImportPreview,
} from '@/lib/types/qualifications';

function parseOptionalInt(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    if (s === '') return null;
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
}

function qualificationCsvRowToInsertPayload(q: QualificationCSVRow) {
    return {
        code: q.code,
        name: q.name,
        level: q.level || null,
        status: ((q.status as string | undefined) || 'current') as 'current' | 'superseded' | 'deleted',
        release_date: q.release_date || null,
        superseded_by: q.superseded_by || null,
        entry_requirements: q.entry_requirements || null,
        cricos_code: q.cricos_code || null,
        core_units: parseOptionalInt(q.core_units),
        elective_units: parseOptionalInt(q.elective_units),
        total_units: parseOptionalInt(q.total_units),
    };
}

function qualificationCsvRowToUpdatePayload(q: QualificationCSVRow) {
    return {
        name: q.name,
        level: q.level || null,
        status: ((q.status as string | undefined) || 'current') as 'current' | 'superseded' | 'deleted',
        release_date: q.release_date || null,
        superseded_by: q.superseded_by || null,
        entry_requirements: q.entry_requirements || null,
        cricos_code: q.cricos_code || null,
        core_units: parseOptionalInt(q.core_units),
        elective_units: parseOptionalInt(q.elective_units),
        total_units: parseOptionalInt(q.total_units),
    };
}

/**
 * Export qualifications to CSV format
 */
export async function exportQualificationsToCSV(
    qualificationIds?: string[]
): Promise<string> {
    const supabase = await createServerClient();

    let query = supabase
        .from('qualifications')
        .select('*')
        .order('code');

    if (qualificationIds && qualificationIds.length > 0) {
        query = query.in('id', qualificationIds);
    }

    const { data: qualifications, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch qualifications: ${error.message}`);
    }

    if (!qualifications || qualifications.length === 0) {
        throw new Error('No qualifications to export');
    }

    // Create CSV header
    const headers = [
        'code',
        'name',
        'level',
        'status',
        'release_date',
        'superseded_by',
        'entry_requirements',
        'cricos_code',
        'core_units',
        'elective_units',
        'total_units',
    ];

    const csvRows = [headers.join(',')];

    // Add data rows
    for (const qual of qualifications) {
        const row = [
            escapeCsvValue(qual.code),
            escapeCsvValue(qual.name),
            escapeCsvValue(qual.level),
            escapeCsvValue(qual.status),
            qual.release_date || '',
            qual.superseded_by || '',
            escapeCsvValue(qual.entry_requirements),
            qual.cricos_code || '',
            qual.core_units || '',
            qual.elective_units || '',
            qual.total_units || '',
        ];
        csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
}

/**
 * Export qualification units to CSV
 */
export async function exportQualificationUnitsToCSV(
    qualificationIds?: string[]
): Promise<string> {
    const supabase = await createServerClient();

    let query = supabase
        .from('qualification_units')
        .select('*, qualifications(code)')
        .order('qualification_id')
        .order('unit_type')
        .order('unit_code');

    if (qualificationIds && qualificationIds.length > 0) {
        query = query.in('qualification_id', qualificationIds);
    }

    const { data: units, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch units: ${error.message}`);
    }

    if (!units || units.length === 0) {
        throw new Error('No units to export');
    }

    // Create CSV header
    const headers = [
        'qualification_code',
        'unit_code',
        'unit_title',
        'unit_type',
        'field_of_education',
        'nominal_hours',
    ];

    const csvRows = [headers.join(',')];

    // Add data rows
    for (const unit of units) {
        const row = [
            unit.qualifications?.code || '',
            escapeCsvValue(unit.unit_code),
            escapeCsvValue(unit.unit_title),
            unit.unit_type || '',
            escapeCsvValue(unit.field_of_education),
            unit.nominal_hours || '',
        ];
        csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
}

/**
 * Parse and preview CSV import (supports multiline quoted fields via Papa Parse)
 */
export async function parseCSVImport(csvContent: string): Promise<ImportPreview> {
    const parsed = Papa.parse<Record<string, string>>(csvContent, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
    });

    const fatalParseError = parsed.errors.find((e) => e.type === 'Quotes' || e.type === 'Delimiter');
    if (fatalParseError) {
        throw new Error(`CSV parse error: ${fatalParseError.message} (row ${fatalParseError.row})`);
    }

    const headers = parsed.meta.fields ?? [];
    if (headers.length === 0) {
        throw new Error('CSV file has no header row');
    }

    const preview: ImportPreview = {
        qualifications: {
            toInsert: [],
            toUpdate: [],
            errors: [],
        },
        units: {
            toInsert: [],
            toUpdate: [],
            errors: [],
        },
    };

    const isQualificationCSV = headers.includes('code') && headers.includes('name');
    const isUnitsCSV = headers.includes('qualification_code') && headers.includes('unit_code');

    if (!isQualificationCSV && !isUnitsCSV) {
        throw new Error('Invalid CSV format. Must be either qualifications or units CSV.');
    }

    const supabase = await createServerClient();

    for (let i = 0; i < parsed.data.length; i++) {
        const raw = parsed.data[i];
        const rowNumber = i + 2; // line 1 = header; first data row = 2

        try {
            const row: Record<string, string | null> = {};
            for (const key of headers) {
                const v = raw[key];
                row[key] = v !== undefined && v !== null && String(v).trim() !== '' ? String(v) : null;
            }

            if (isQualificationCSV) {
                if (!row.code || !row.name) {
                    if (Object.values(raw).some((cell) => cell && String(cell).trim() !== '')) {
                        preview.qualifications.errors.push({
                            row: rowNumber,
                            message: 'Missing required fields: code and name',
                        });
                    }
                    continue;
                }

                const qRow = row as unknown as QualificationCSVRow;

                const { data: existing } = await supabase
                    .from('qualifications')
                    .select('id')
                    .eq('code', qRow.code)
                    .single();

                if (existing) {
                    preview.qualifications.toUpdate.push(qRow);
                } else {
                    preview.qualifications.toInsert.push(qRow);
                }
            } else if (isUnitsCSV) {
                if (!row.qualification_code || !row.unit_code || !row.unit_title) {
                    preview.units.errors.push({
                        row: rowNumber,
                        message: 'Missing required fields: qualification_code, unit_code, unit_title',
                    });
                    continue;
                }

                const { data: qual } = await supabase
                    .from('qualifications')
                    .select('id')
                    .eq('code', row.qualification_code)
                    .single();

                if (!qual) {
                    preview.units.errors.push({
                        row: rowNumber,
                        message: `Qualification ${row.qualification_code} not found`,
                    });
                    continue;
                }

                const { data: existing } = await supabase
                    .from('qualification_units')
                    .select('id')
                    .eq('qualification_id', qual.id)
                    .eq('unit_code', row.unit_code)
                    .single();

                const unitRow = {
                    ...row,
                    qualification_id: qual.id,
                };

                if (existing) {
                    preview.units.toUpdate.push(unitRow as UnitImportRow);
                } else {
                    preview.units.toInsert.push(unitRow as UnitImportRow);
                }
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            if (isQualificationCSV) {
                preview.qualifications.errors.push({ row: rowNumber, message: errorMsg });
            } else if (isUnitsCSV) {
                preview.units.errors.push({ row: rowNumber, message: errorMsg });
            }
        }
    }

    return preview;
}

/**
 * Commit CSV import to database
 */
export async function commitCSVImport(preview: ImportPreview): Promise<{
    inserted: number;
    updated: number;
    errors: number;
}> {
    const supabase = await createServerClient();
    let inserted = 0;
    let updated = 0;
    let errors = preview.qualifications.errors.length + preview.units.errors.length;

    // Import qualifications
    if (preview.qualifications.toInsert.length > 0) {
        const { error } = await supabase
            .from('qualifications')
            .insert(preview.qualifications.toInsert.map((q) => qualificationCsvRowToInsertPayload(q)));

        if (error) {
            console.error('Error inserting qualifications:', error);
            errors += preview.qualifications.toInsert.length;
        } else {
            inserted += preview.qualifications.toInsert.length;
        }
    }

    if (preview.qualifications.toUpdate.length > 0) {
        for (const q of preview.qualifications.toUpdate) {
            const { error } = await supabase
                .from('qualifications')
                .update(qualificationCsvRowToUpdatePayload(q))
                .eq('code', q.code);

            if (error) {
                console.error('Error updating qualification:', error);
                errors++;
            } else {
                updated++;
            }
        }
    }

    // Import units
    if (preview.units.toInsert.length > 0) {
        const { error } = await supabase
            .from('qualification_units')
            .insert(
                preview.units.toInsert.map((u) => ({
                    qualification_id: u.qualification_id,
                    unit_code: u.unit_code,
                    unit_title: u.unit_title,
                    unit_type: u.unit_type || null,
                    field_of_education: u.field_of_education || null,
                    nominal_hours: u.nominal_hours ? parseInt(String(u.nominal_hours)) : null,
                    is_current: true,
                }))
            );

        if (error) {
            console.error('Error inserting units:', error);
            errors += preview.units.toInsert.length;
        } else {
            inserted += preview.units.toInsert.length;
        }
    }

    if (preview.units.toUpdate.length > 0) {
        for (const u of preview.units.toUpdate) {
            const { error } = await supabase
                .from('qualification_units')
                .update({
                    unit_title: u.unit_title,
                    unit_type: u.unit_type || null,
                    field_of_education: u.field_of_education || null,
                    nominal_hours: u.nominal_hours ? parseInt(String(u.nominal_hours)) : null,
                    is_current: true,
                })
                .eq('qualification_id', u.qualification_id)
                .eq('unit_code', u.unit_code);

            if (error) {
                console.error('Error updating unit:', error);
                errors++;
            } else {
                updated++;
            }
        }
    }

    return { inserted, updated, errors };
}

/**
 * Helper: Escape CSV values
 */
function escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }

    const stringValue = String(value);

    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
}
