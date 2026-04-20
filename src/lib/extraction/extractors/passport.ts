/**
 * Passport Extractor
 * 
 * Extracts data from passport images and PDFs using OCR text analysis.
 * Supports MRZ (Machine Readable Zone) parsing for higher accuracy.
 */

import type { ExtractionResult, PassportExtractionFields, ExtractedField } from '../types';

// Clean noisy OCR text
function cleanText(text: string): string {
    return text
        // Remove dots and special characters that are likely OCR noise
        .replace(/[•·.]{2,}/g, ' ')
        .replace(/[!1l|]+(?=[A-Z])/g, '') // OCR confuses 1, l, I, |
        .replace(/~+/g, 'a') // ~ often is 'a' in OCR
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}

// MRZ patterns (Machine Readable Zone on passports)
const MRZ_LINE1_PATTERN = /P[<A-Z]{1}([A-Z]{3})([A-Z<]+)<<([A-Z<]+)/;
const MRZ_LINE2_PATTERN = /([A-Z0-9<]{9})(\d)([A-Z]{3})(\d{6})(\d)([MF<])(\d{6})(\d)/;

// Fallback patterns for visual text extraction
const PATTERNS = {
    // Multiple passport number patterns
    passport_number: /(?:passport\s*(?:no|number|#)?[:\s]*)?([A-Z]{1,2}\d{6,9})/i,
    passport_number_alt: /\b([A-Z]{2}\d{7,8})\b/i,
    passport_number_au: /\b([NPM][A-Z]?\d{7,8})\b/i,

    surname: /(?:surname|family\s*name|last\s*name)[:\s]*([A-Z][a-zA-Z\s-]+)/i,
    given_names: /(?:given\s*names?|first\s*name|forename)[:\s]*([A-Z][a-zA-Z\s]+)/i,

    // Pattern for personal data forms: "Name: FIRSTNAME LASTNAME" or "H~mo:" (OCR for "Name:")
    name_label: /(?:name|h[~a]mo)[:\s]*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,3})/i,

    nationality: /(?:nationality|citizenship)[:\s]*([A-Z][a-zA-Z\s]+)/i,
    dob: /(?:date\s*of\s*birth|dob|born|d\.?o\.?b)[:\s]*(\d{1,2}[\s\/-]\w{3,9}[\s\/-]\d{2,4}|\d{2,4}[\/-]\d{2}[\/-]\d{2,4})/i,
    expiry: /(?:expiry|expiration|valid\s*until|date\s*of\s*expiry|must\s*not\s*arrive\s*after)[:\s]*(\d{1,2}[\s\/-]\w{3,9}[\s\/-]\d{2,4}|\d{2,4}[\/-]\d{2}[\/-]\d{2,4})/i,
    gender: /(?:sex|gender)[:\s]*([MF]|MALE|FEMALE)/i,

    // Visa-specific patterns
    visa_grant_number: /(?:visa\s*grant\s*(?:no|number)?|grant\s*(?:no|number)?)[:\s]*(\d{13,15})/i,
    visa_grant_date: /(?:visa\s*grant\s*date|grant\s*date|date\s*of\s*grant|granted)[:\s]*(\d{1,2}[\s\/-]\w{3,9}[\s\/-]\d{2,4}|\d{2,4}[\/-]\d{2}[\/-]\d{2,4})/i,
    visa_expiry: /(?:visa\s*expiry|must\s*not\s*arrive\s*after|stay\s*until|visa\s*valid\s*until)[:\s]*(\d{1,2}[\s\/-]\w{3,9}[\s\/-]\d{2,4}|\d{2,4}[\/-]\d{2}[\/-]\d{2,4})/i,
    visa_subclass: /(?:visa\s*subclass|subclass)[:\s]*(\d{3})/i,
    visa_label_number: /(?:visa\s*label\s*number|label\s*number)[:\s]*([A-Z0-9-]+)/i,

    // Flexible date pattern - any date in DD Mon YYYY or DD/MM/YYYY format
    date_generic: /\b(\d{1,2}[\s\/-](?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s\/-]\d{4})\b/gi,

    // Name at start pattern (common in passports: SURNAME given names)
    name_line: /\b([A-Z]{2,})\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/,
};

// Country code to name mapping (subset)
const COUNTRY_CODES: Record<string, string> = {
    'IND': 'India',
    'CHN': 'China',
    'AUS': 'Australia',
    'USA': 'United States',
    'GBR': 'United Kingdom',
    'NPL': 'Nepal',
    'BGD': 'Bangladesh',
    'PAK': 'Pakistan',
    'PHL': 'Philippines',
    'VNM': 'Vietnam',
    'THA': 'Thailand',
    'IDN': 'Indonesia',
    'MYS': 'Malaysia',
    'SGP': 'Singapore',
    'NZL': 'New Zealand',
};

function parseDate(dateStr: string): string | null {
    // Normalize: remove extra digits that might be OCR artifacts (e.g., "200000" -> "2000")
    const normalized = dateStr.replace(/(\d{4})\d+/g, '$1');

    // Try various date formats
    const formats = [
        // DD Mon YYYY, DD-Mon-YYYY - use negative lookahead to prevent matching more than 4 digits
        /(\d{1,2})[\s\/-](\w{3,9})[\s\/-](\d{4})(?!\d)/,
        // YYYY-MM-DD
        /(\d{4})(?!\d)[\/-](\d{2})[\/-](\d{2})/,
        // DD/MM/YYYY
        /(\d{2})[\/-](\d{2})[\/-](\d{4})(?!\d)/,
        // MRZ format: YYMMDD
        /^(\d{2})(\d{2})(\d{2})$/,
    ];

    for (const format of formats) {
        const match = normalized.match(format);
        if (match) {
            try {
                // Simple validation - just return if it looks like a date
                if (match[1].length === 4) {
                    // YYYY-MM-DD format - validate year
                    const year = parseInt(match[1]);
                    if (year < 1900 || year > 2099) {
                        console.log('[Passport Extractor] Invalid year:', year);
                        return null;
                    }
                    return `${match[1]}-${match[2]}-${match[3]}`;
                } else if (match[3].length === 4) {
                    // DD/MM/YYYY format - validate year and convert to YYYY-MM-DD
                    const year = parseInt(match[3]);
                    if (year < 1900 || year > 2099) {
                        console.log('[Passport Extractor] Invalid year:', year);
                        return null;
                    }
                    const months: Record<string, string> = {
                        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
                        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
                        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
                        'january': '01', 'february': '02', 'march': '03', 'april': '04',
                        'june': '06', 'july': '07', 'august': '08',
                        'september': '09', 'october': '10', 'november': '11', 'december': '12',
                    };
                    const monthStr = match[2].toLowerCase();
                    const month = months[monthStr] || match[2].padStart(2, '0');
                    return `${match[3]}-${month}-${match[1].padStart(2, '0')}`;
                } else if (match[1].length === 2 && match[2].length === 2 && match[3].length === 2) {
                    // MRZ YYMMDD format
                    const year = parseInt(match[1]) > 50 ? `19${match[1]}` : `20${match[1]}`;
                    return `${year}-${match[2]}-${match[3]}`;
                }
            } catch {
                continue;
            }
        }
    }
    return null;
}

function parseMRZ(text: string): PassportExtractionFields | null {
    // Look for MRZ lines (typically at bottom of passport)
    const lines = text.split('\n').map(l => l.trim().replace(/\s/g, ''));

    const mrzLines: string[] = [];
    for (const line of lines) {
        // MRZ lines are 44 characters for TD3 (passport)
        if (line.length >= 42 && /^[A-Z0-9<]+$/.test(line)) {
            mrzLines.push(line);
        }
    }

    if (mrzLines.length < 2) return null;

    console.log('[Passport Extractor] Found MRZ lines:', mrzLines);

    // Parse Line 1: P<GBRSMITH<<JOHN<EDWARD
    const line1Match = mrzLines[0].match(MRZ_LINE1_PATTERN);
    if (!line1Match) return null;

    const countryCode = line1Match[1];
    const surname = line1Match[2].replace(/</g, ' ').trim();
    const givenNames = line1Match[3].replace(/</g, ' ').trim();

    // Parse Line 2: L898902C<3GBR9001014<4M29010813
    const line2Match = mrzLines[1].match(MRZ_LINE2_PATTERN);
    if (!line2Match) return null;

    const passportNumber = line2Match[1].replace(/</g, '');
    const nationality = line2Match[3];
    const dobRaw = line2Match[4];
    const gender = line2Match[6];
    const expiryRaw = line2Match[7];

    return {
        last_name: { value: surname, confidence: 0.95, rawMatch: mrzLines[0] },
        first_name: { value: givenNames.split(' ')[0] || givenNames, confidence: 0.95, rawMatch: mrzLines[0] },
        passport_number: { value: passportNumber, confidence: 0.98, rawMatch: line2Match[1] },
        nationality: { value: COUNTRY_CODES[nationality] || nationality, confidence: 0.95, rawMatch: nationality },
        dob: { value: parseDate(dobRaw) || dobRaw, confidence: 0.90, rawMatch: dobRaw },
        gender: { value: gender === 'M' ? 'Male' : gender === 'F' ? 'Female' : gender, confidence: 0.98, rawMatch: gender },
        expiry_date: { value: parseDate(expiryRaw) || expiryRaw, confidence: 0.90, rawMatch: expiryRaw },
        issuing_country: { value: COUNTRY_CODES[countryCode] || countryCode, confidence: 0.95, rawMatch: countryCode },
    };
}

function extractWithPatterns(text: string): PassportExtractionFields {
    const fields: PassportExtractionFields = {};

    // Clean the text to remove OCR noise
    const cleaned = cleanText(text);
    console.log('[Passport Extractor] Cleaned text:', cleaned.substring(0, 500));

    // Try labeled patterns first
    for (const [fieldName, pattern] of Object.entries(PATTERNS)) {
        if (fieldName === 'date_generic' || fieldName === 'name_line' || fieldName === 'name_label') continue; // Skip these, handled separately
        if (fieldName.includes('_alt') || fieldName.includes('_au')) continue; // Alternate patterns handled below

        const match = cleaned.match(pattern);
        if (match && match[1]) {
            const value = match[1].trim();
            let processedValue = value;

            if (fieldName === 'dob' || fieldName === 'expiry') {
                const parsed = parseDate(value);
                if (parsed) processedValue = parsed;
            }

            const field: ExtractedField = {
                value: processedValue,
                confidence: 0.75,
                rawMatch: match[0],
            };

            // Map pattern name to field name
            if (fieldName === 'surname') fields.last_name = field;
            else if (fieldName === 'given_names') fields.first_name = field;
            else if (fieldName === 'expiry' || fieldName === 'visa_expiry') fields.expiry_date = field;
            else if (fieldName === 'visa_grant_number') fields.visa_number = field;
            else if (fieldName === 'visa_grant_date') fields.visa_grant_date = field;
            else if (fieldName === 'visa_subclass' || fieldName === 'visa_label_number') {
                // Skip subclass/label - just log them for now
            }
            else fields[fieldName as keyof PassportExtractionFields] = field;

            console.log(`[Passport Extractor] Found ${fieldName}:`, processedValue);
        }
    }

    // Try name_label pattern for personal data forms
    if (!fields.first_name || !fields.last_name) {
        const nameMatch = cleaned.match(PATTERNS.name_label);
        if (nameMatch && nameMatch[1]) {
            const nameParts = nameMatch[1].trim().split(/\s+/);
            console.log('[Passport Extractor] Found name via label:', nameParts);

            if (nameParts.length >= 2) {
                // First part is first name, rest is last name
                if (!fields.first_name) {
                    fields.first_name = {
                        value: nameParts[0],
                        confidence: 0.70,
                        rawMatch: nameParts[0],
                    };
                }
                if (!fields.last_name) {
                    fields.last_name = {
                        value: nameParts.slice(1).join(' '),
                        confidence: 0.70,
                        rawMatch: nameParts.slice(1).join(' '),
                    };
                }
            }
        }
    }

    // Try alternate passport number patterns if not found
    if (!fields.passport_number) {
        const altMatch = cleaned.match(PATTERNS.passport_number_alt);
        const auMatch = cleaned.match(PATTERNS.passport_number_au);
        const passportMatch = altMatch || auMatch;
        if (passportMatch && passportMatch[1]) {
            fields.passport_number = {
                value: passportMatch[1],
                confidence: 0.70,
                rawMatch: passportMatch[0],
            };
            console.log('[Passport Extractor] Found passport number via alt pattern:', passportMatch[1]);
        }
    }

    // Try extracting dates generically if DOB/expiry not found
    if (!fields.dob || !fields.expiry_date) {
        const dates = cleaned.match(PATTERNS.date_generic);
        if (dates && dates.length >= 1) {
            console.log('[Passport Extractor] Found generic dates:', dates);
            if (!fields.dob && dates[0]) {
                const parsed = parseDate(dates[0]);
                fields.dob = {
                    value: parsed || dates[0],
                    confidence: 0.60,
                    rawMatch: dates[0],
                };
            }
            if (!fields.expiry_date && dates.length >= 2 && dates[1]) {
                const parsed = parseDate(dates[1]);
                fields.expiry_date = {
                    value: parsed || dates[1],
                    confidence: 0.60,
                    rawMatch: dates[1],
                };
            }
        }
    }

    // Try extracting name from "SURNAME Given Names" pattern
    if (!fields.last_name || !fields.first_name) {
        const nameLine = cleaned.match(PATTERNS.name_line);
        if (nameLine && nameLine[1] && nameLine[2]) {
            console.log('[Passport Extractor] Found name line:', nameLine[0]);
            if (!fields.last_name) {
                fields.last_name = {
                    value: nameLine[1].charAt(0) + nameLine[1].slice(1).toLowerCase(),
                    confidence: 0.65,
                    rawMatch: nameLine[1],
                };
            }
            if (!fields.first_name) {
                fields.first_name = {
                    value: nameLine[2].split(' ')[0],
                    confidence: 0.65,
                    rawMatch: nameLine[2],
                };
            }
        }
    }

    console.log('[Passport Extractor] Pattern extraction results:', Object.keys(fields));
    return fields;
}

export function extractPassportData(text: string): ExtractionResult {
    console.log('[Passport Extractor] Starting extraction on text length:', text.length);
    console.log('[Passport Extractor] First 300 chars:', text.substring(0, 300));

    // Try MRZ parsing first (highest accuracy)
    const mrzFields = parseMRZ(text);

    if (mrzFields && Object.keys(mrzFields).length >= 3) {
        console.log('[Passport Extractor] MRZ extraction successful:', Object.keys(mrzFields));
        const avgConfidence = Object.values(mrzFields)
            .reduce((sum, f) => sum + (f?.confidence || 0), 0) / Object.keys(mrzFields).length;

        return {
            documentType: 'Passport',
            status: 'completed',
            overallConfidence: avgConfidence,
            fields: mrzFields as Record<string, ExtractedField>,
            rawText: text,
        };
    }

    // Fallback to pattern matching
    console.log('[Passport Extractor] MRZ parsing failed, using pattern matching');
    const patternFields = extractWithPatterns(text);
    const fieldCount = Object.keys(patternFields).length;

    if (fieldCount === 0) {
        console.log('[Passport Extractor] No fields extracted');
        return {
            documentType: 'Passport',
            status: 'failed',
            overallConfidence: 0,
            fields: {},
            rawText: text,
            error: 'Could not extract any passport fields from the document',
        };
    }

    const avgConfidence = Object.values(patternFields)
        .reduce((sum, f) => sum + (f?.confidence || 0), 0) / fieldCount;

    return {
        documentType: 'Passport',
        status: 'completed',
        overallConfidence: avgConfidence,
        fields: patternFields as Record<string, ExtractedField>,
        rawText: text,
    };
}
