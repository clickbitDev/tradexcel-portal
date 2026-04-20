/**
 * USI (Unique Student Identifier) Extractor
 * 
 * Extracts USI number from documents.
 * USI is a 10-character alphanumeric identifier.
 */

import type { ExtractionResult, USIExtractionFields, ExtractedField } from '../types';

// USI format: 10 alphanumeric characters (no I, O, or 1, 0 - they use L and O substitutes)
// Valid characters: 2-9, A-H, J-N, P-Z
const USI_PATTERN = /\b([2-9A-HJ-NP-Z]{10})\b/g;

// Context patterns that suggest a USI is nearby
const USI_CONTEXT_PATTERNS = [
    /USI[:\s]+([2-9A-HJ-NP-Z]{10})/i,
    /Unique\s+Student\s+Identifier[:\s]+([2-9A-HJ-NP-Z]{10})/i,
    /Student\s+ID[:\s]+([2-9A-HJ-NP-Z]{10})/i,
];

function validateUSI(usi: string): boolean {
    // USI must be exactly 10 characters
    if (usi.length !== 10) return false;

    // Must only contain valid USI characters (no I, O, 1, 0)
    return /^[2-9A-HJ-NP-Z]{10}$/.test(usi);
}

export function extractUSIData(text: string): ExtractionResult {
    const fields: USIExtractionFields = {};
    console.log('[USI Extractor] Starting extraction, text length:', text.length);

    // Try context-aware patterns first (higher confidence)
    for (const pattern of USI_CONTEXT_PATTERNS) {
        const match = text.match(pattern);
        if (match && match[1] && validateUSI(match[1])) {
            console.log('[USI Extractor] Found USI with context:', match[1]);
            fields.usi_number = {
                value: match[1].toUpperCase(),
                confidence: 0.95,
                rawMatch: match[0],
            };
            break;
        }
    }

    // If no context match, look for standalone USI-like patterns
    if (!fields.usi_number) {
        const matches = text.match(USI_PATTERN);
        if (matches) {
            // Filter to valid USIs and take the first one
            const validUSIs = matches.filter(m => validateUSI(m));
            if (validUSIs.length > 0) {
                console.log('[USI Extractor] Found USI standalone:', validUSIs[0]);
                fields.usi_number = {
                    value: validUSIs[0].toUpperCase(),
                    confidence: 0.70, // Lower confidence without context
                    rawMatch: validUSIs[0],
                };
            }
        }
    }

    if (!fields.usi_number) {
        console.log('[USI Extractor] No USI found');
        return {
            documentType: 'USI',
            status: 'failed',
            overallConfidence: 0,
            fields: {},
            rawText: text,
            error: 'Could not find a valid USI number in the document',
        };
    }

    return {
        documentType: 'USI',
        status: 'completed',
        overallConfidence: fields.usi_number.confidence,
        fields: fields as Record<string, ExtractedField>,
        rawText: text,
    };
}
