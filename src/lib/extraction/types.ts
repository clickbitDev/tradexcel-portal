/**
 * Document Extraction Types
 * 
 * Defines the interfaces for document data extraction system
 */

export type DocumentType =
    | 'Passport'
    | 'Visa'
    | 'Driver License'
    | 'Transcript'
    | 'English Test'
    | 'TAS'
    | 'LLN Management'
    | 'Photo'
    | 'Resume/CV'
    | 'Offer Letter'
    | 'CoE'
    | 'Student Assessment Report'
    | 'Assessment Meeting Record'
    | 'Evaluation File'
    | 'USI'
    | 'Other';

export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface ExtractedField {
    value: string;
    confidence: number; // 0-1
    rawMatch?: string; // Original matched text
}

export interface ExtractionResult {
    documentType: DocumentType;
    status: ExtractionStatus;
    overallConfidence: number;
    fields: Record<string, ExtractedField>;
    rawText?: string;
    error?: string;
}

// Passport/Visa-specific extraction result
export interface PassportExtractionFields {
    first_name?: ExtractedField;
    last_name?: ExtractedField;
    dob?: ExtractedField;
    nationality?: ExtractedField;
    passport_number?: ExtractedField;
    visa_number?: ExtractedField;
    visa_grant_date?: ExtractedField;
    gender?: ExtractedField;
    expiry_date?: ExtractedField;
    issuing_country?: ExtractedField;
}

// Resume-specific extraction result
export interface ResumeExtractionFields {
    full_name?: ExtractedField;
    first_name?: ExtractedField;
    last_name?: ExtractedField;
    email?: ExtractedField;
    phone?: ExtractedField;
    address?: ExtractedField;
}

// Transcript-specific extraction result
export interface TranscriptExtractionFields {
    institution_name?: ExtractedField;
    qualification_name?: ExtractedField;
    completion_date?: ExtractedField;
    student_name?: ExtractedField;
}

// USI-specific extraction result
export interface USIExtractionFields {
    usi_number?: ExtractedField;
    student_name?: ExtractedField;
}

// Application field mapping - maps extracted fields to database columns
export interface ApplicationFieldMapping {
    student_first_name?: string;
    student_last_name?: string;
    student_email?: string;
    student_phone?: string;
    student_dob?: string;
    student_passport_number?: string;
    student_nationality?: string;
    student_address?: string;
    student_usi?: string;
    student_visa_number?: string;
    student_visa_grant_date?: string;
    student_visa_expiry?: string;
}

// Extraction request
export interface ExtractionRequest {
    file: File;
    documentType: DocumentType;
}

// File reader result
export interface FileContent {
    text: string;
    mimeType: string;
}
