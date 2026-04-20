/**
 * Transcript/Certificate Extractor
 * 
 * Extracts qualification and institution information from academic documents.
 */

import type { ExtractionResult, TranscriptExtractionFields, ExtractedField } from '../types';

// Common Australian qualification levels
const QUALIFICATION_PATTERNS = [
    /(?:Certificate\s+(?:I{1,4}|IV?|[1-4])\s+in\s+)([A-Za-z\s&-]+)/i,
    /(?:Diploma\s+of\s+)([A-Za-z\s&-]+)/i,
    /(?:Advanced\s+Diploma\s+of\s+)([A-Za-z\s&-]+)/i,
    /(?:Bachelor\s+of\s+)([A-Za-z\s&-]+)/i,
    /(?:Master\s+of\s+)([A-Za-z\s&-]+)/i,
    /(?:Graduate\s+Certificate\s+in\s+)([A-Za-z\s&-]+)/i,
    /(?:Graduate\s+Diploma\s+of\s+)([A-Za-z\s&-]+)/i,
];

// Full qualification with code pattern
const QUALIFICATION_CODE_PATTERN = /([A-Z]{2,4}\d{4,5})\s*[-–]\s*([A-Za-z\s&-]+)/;

// Institution patterns
const INSTITUTION_PATTERNS = [
    /(?:Institution|Provider|RTO|College|University|Institute)[:\s]+([A-Za-z\s&.-]+)/i,
    /(?:Issued\s+by|Awarded\s+by|From)[:\s]+([A-Za-z\s&.-]+)/i,
];

// RTO code pattern
const RTO_CODE_PATTERN = /RTO[:\s#]*(\d{4,5})/i;

// Date patterns for completion/issue date
const DATE_PATTERNS = [
    /(?:Date\s+(?:of\s+)?(?:Completion|Issue|Award))[:\s]+(\d{1,2}[\s\/-]\w{3,9}[\s\/-]\d{4})/i,
    /(?:Completed|Issued|Awarded)[:\s]+(\d{1,2}[\s\/-]\w{3,9}[\s\/-]\d{4})/i,
    /(?:Completed|Issued|Awarded)\s+on[:\s]+(\d{1,2}[\s\/-]\w{3,9}[\s\/-]\d{4})/i,
];

// Student name patterns on certificates
const STUDENT_NAME_PATTERNS = [
    /(?:This\s+is\s+to\s+certify\s+that|Awarded\s+to|Presented\s+to|Student)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /(?:Name)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
];

function parseDate(dateStr: string): string | null {
    const months: Record<string, string> = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'june': '06', 'july': '07', 'august': '08',
        'september': '09', 'october': '10', 'november': '11', 'december': '12',
    };

    const match = dateStr.match(/(\d{1,2})[\s\/-](\w{3,9})[\s\/-](\d{4})/i);
    if (match) {
        const day = match[1].padStart(2, '0');
        const monthStr = match[2].toLowerCase();
        const month = months[monthStr] || months[monthStr.slice(0, 3)];
        const year = match[3];
        if (month) {
            return `${year}-${month}-${day}`;
        }
    }
    return null;
}

export function extractTranscriptData(text: string): ExtractionResult {
    const fields: TranscriptExtractionFields = {};

    // Try to extract qualification with code first
    const codeMatch = text.match(QUALIFICATION_CODE_PATTERN);
    if (codeMatch) {
        fields.qualification_name = {
            value: `${codeMatch[1]} - ${codeMatch[2].trim()}`,
            confidence: 0.90,
            rawMatch: codeMatch[0],
        };
    } else {
        // Try individual qualification patterns
        for (const pattern of QUALIFICATION_PATTERNS) {
            const match = text.match(pattern);
            if (match) {
                const qualType = match[0].split(/\s+in\s+|\s+of\s+/i)[0];
                fields.qualification_name = {
                    value: `${qualType} ${match[1].trim()}`,
                    confidence: 0.80,
                    rawMatch: match[0],
                };
                break;
            }
        }
    }

    // Extract institution
    for (const pattern of INSTITUTION_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            fields.institution_name = {
                value: match[1].trim(),
                confidence: 0.85,
                rawMatch: match[0],
            };
            break;
        }
    }

    // Try RTO code if no institution found
    if (!fields.institution_name) {
        const rtoMatch = text.match(RTO_CODE_PATTERN);
        if (rtoMatch) {
            fields.institution_name = {
                value: `RTO ${rtoMatch[1]}`,
                confidence: 0.75,
                rawMatch: rtoMatch[0],
            };
        }
    }

    // Extract completion date
    for (const pattern of DATE_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            const parsedDate = parseDate(match[1]);
            fields.completion_date = {
                value: parsedDate || match[1],
                confidence: parsedDate ? 0.85 : 0.70,
                rawMatch: match[0],
            };
            break;
        }
    }

    // Extract student name
    for (const pattern of STUDENT_NAME_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            fields.student_name = {
                value: match[1].trim(),
                confidence: 0.80,
                rawMatch: match[0],
            };
            break;
        }
    }

    const fieldCount = Object.keys(fields).length;

    if (fieldCount === 0) {
        return {
            documentType: 'Transcript',
            status: 'failed',
            overallConfidence: 0,
            fields: {},
            rawText: text,
            error: 'Could not extract any academic information from the document',
        };
    }

    const avgConfidence = Object.values(fields)
        .reduce((sum, f) => sum + (f?.confidence || 0), 0) / fieldCount;

    return {
        documentType: 'Transcript',
        status: 'completed',
        overallConfidence: avgConfidence,
        fields: fields as Record<string, ExtractedField>,
        rawText: text,
    };
}
