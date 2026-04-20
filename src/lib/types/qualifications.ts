// Extended database types for qualifications feature
// Generated for migration 006_qualifications_extended

export type SyncResult = 'success' | 'partial' | 'failed' | 'skipped';
export type UnitType = 'core' | 'elective';

export interface QualificationUnit {
    id: string;
    qualification_id: string;
    unit_code: string;
    unit_title: string;
    unit_type: UnitType | null;
    field_of_education: string | null;
    nominal_hours: number | null;
    is_current: boolean;
    created_at: string;
    updated_at: string;
}

export interface TGASyncLog {
    id: string;
    qualification_id: string | null;
    sync_result: SyncResult;
    changes_detected: Record<string, unknown>;
    api_response: Record<string, unknown> | null;
    error_message: string | null;
    synced_by: string | null;
    created_at: string;
}

export interface QualificationRTOUsage {
    qualification_id: string;
    code: string;
    name: string;
    rto_count: number;
    rto_ids: string[] | null;
    rto_names: string[] | null;
}

// Extended Qualification type with new fields
export interface QualificationExtended {
    id: string;
    code: string;
    name: string;
    level: string | null;
    status: 'current' | 'superseded' | 'deleted';
    release_date: string | null;
    superseded_by: string | null;
    tga_sync_status: 'synced' | 'pending' | 'error' | 'never';
    tga_last_synced_at: string | null;

    // New fields from migration 006
    core_units: number | null;
    elective_units: number | null;
    total_units: number | null;
    entry_requirements: string | null;
    prerequisites: string[] | null;
    cricos_code: string | null;
    certificate_preview_path: string | null;
    certificate_preview_provider: 'supabase' | 'b2' | null;
    certificate_preview_bucket: string | null;
    certificate_preview_key: string | null;

    // New fields from migration 036
    delivery_mode: string[] | null;
    last_edited_by: string | null;

    created_at: string;
    updated_at: string;
}

// Qualification with units breakdown
export interface QualificationWithUnits extends QualificationExtended {
    units: QualificationUnit[];
}

// Qualification with RTO usage
export interface QualificationWithUsage extends QualificationExtended {
    rto_usage: QualificationRTOUsage;
}

// Full qualification detail (all data)
export interface QualificationDetail extends QualificationExtended {
    units: QualificationUnit[];
    rto_usage: QualificationRTOUsage;
    sync_logs?: TGASyncLog[];
}

// Helper types for unit counts
export interface UnitCounts {
    core_count: number;
    elective_count: number;
    total_count: number;
}

// TGA API Response types
export interface TGAQualificationResponse {
    code: string;
    title: string;
    level: string;
    status: 'current' | 'superseded' | 'deleted';
    releaseDate?: string;
    supersededBy?: string;
    cricosCode?: string;
    units?: TGAUnitResponse[];
}

export interface TGAUnitResponse {
    code: string;
    title: string;
    type: 'core' | 'elective';
    fieldOfEducation?: string;
    nominalHours?: number;
}

// CSV Import/Export types
export interface QualificationCSVRow {
    code: string;
    name: string;
    level?: string;
    status?: string;
    release_date?: string;
    superseded_by?: string;
    entry_requirements?: string;
    cricos_code?: string;
    core_units?: string;
    elective_units?: string;
    total_units?: string;
}

export interface UnitCSVRow {
    qualification_code: string;
    unit_code: string;
    unit_title: string;
    unit_type: 'core' | 'elective';
    field_of_education?: string;
    nominal_hours?: number | string;
}

// Unit import row with resolved qualification_id
export interface UnitImportRow extends UnitCSVRow {
    qualification_id: string;
}

export interface ImportPreview {
    qualifications: {
        toInsert: QualificationCSVRow[];
        toUpdate: QualificationCSVRow[];
        errors: { row: number; message: string }[];
    };
    units: {
        toInsert: UnitImportRow[];
        toUpdate: UnitImportRow[];
        errors: { row: number; message: string }[];
    };
}
