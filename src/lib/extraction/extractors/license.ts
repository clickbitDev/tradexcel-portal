/**
 * Driver License Extractor
 * 
 * Extracts data from driver license images using OCR text analysis.
 * Works with various license formats (Australian, international).
 */

import type { ExtractionResult, ExtractedField } from '../types';

// Driver license extraction fields
export interface DriverLicenseExtractionFields {
    first_name?: ExtractedField;
    last_name?: ExtractedField;
    full_name?: ExtractedField;
    license_number?: ExtractedField;
    dob?: ExtractedField;
    expiry_date?: ExtractedField;
    address?: ExtractedField;
    state?: ExtractedField;
}

// Common patterns for Australian and international licenses
const PATTERNS = {
    // License number patterns - Australian style (8-10 digits)
    license_number_au: /(?:licence\s*(?:no\.?|number|#)?[:\s]*)(\d{6,10})/i,
    license_number_generic: /(?:licence|license|lic\.?\s*(?:no\.?|number|#)?)[:\s]*([A-Z0-9]{6,12})/i,

    // Card number (NSW style: 2 060 012 901)
    card_number: /(?:card\s*(?:no\.?|number)?[:\s]*)?(\d[\s\d]{8,12}\d)/i,

    // Name patterns - look for names near top of card
    surname: /(?:surname|family\s*name|last\s*name)[:\s]*([A-Z][a-zA-Z\s'-]+)/i,
    given_names: /(?:given\s*names?|first\s*name|forename|other\s*names?)[:\s]*([A-Z][a-zA-Z\s]+)/i,
    full_name_label: /(?:name|full\s*name)[:\s]*([A-Z][a-zA-Z\s'-]+)/i,

    // Look for name pattern at start - FirstName LastName or FirstName MiddleName LastName
    // Common on Australian licenses where name appears prominently
    name_at_start: /^[^a-z]*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/m,

    // Date patterns - multiple formats
    dob: /(?:date\s*of\s*birth|dob|born|d\.?o\.?b\.?)[:\s]*(\d{1,2}[\s./-]\w{3,9}[\s./-]\d{2,4}|\d{2,4}[./-]\d{2}[./-]\d{2,4})/i,
    date_labeled: /(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4})/gi,
    expiry: /(?:expiry|expires?|exp\.?|valid\s*(?:until|to)|expiry\s*date)[:\s]*(\d{1,2}[\s./-]\w{3,9}[\s./-]\d{2,4}|\d{2,4}[./-]\d{2}[./-]\d{2,4})/i,

    // Address patterns in Australian format
    address: /(\d+\s+[A-Za-z]+\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl|Way|Crescent|Cres)[,.\s]+[A-Za-z\s]+[,.\s]+(?:NSW|VIC|QLD|WA|SA|TAS|NT|ACT)?\s*\d{4})/i,
    // Alternative: just street + suburb + postcode
    address_simple: /(\d+\s+[A-Z][A-Za-z]+\s+(?:ST|RD|AVE|DR|LN|PL|WAY|CRES)\s+[A-Z][A-Za-z\s]+\s*(?:NSW|VIC|QLD|WA|SA|TAS|NT|ACT)?\s*\d{4})/i,

    // State patterns
    state_au: /\b(NSW|VIC|QLD|WA|SA|TAS|NT|ACT|New\s*South\s*Wales|Victoria|Queensland|Western\s*Australia|South\s*Australia|Tasmania|Northern\s*Territory)\b/i,
};

// Australian state codes
const STATE_CODES: Record<string, string> = {
    'new south wales': 'NSW',
    'victoria': 'VIC',
    'queensland': 'QLD',
    'western australia': 'WA',
    'south australia': 'SA',
    'tasmania': 'TAS',
    'northern territory': 'NT',
    'australian capital territory': 'ACT',
};

function parseDate(dateStr: string): string | null {
    // Normalize: remove extra digits that might be OCR artifacts (e.g., "200000" -> "2000")
    const normalized = dateStr.replace(/(\d{4})\d+/g, '$1');

    const formats = [
        // DD Mon YYYY, DD-Mon-YYYY - use negative lookahead to prevent matching more than 4 digits
        /(\d{1,2})[\s\/-](\w{3,9})[\s\/-](\d{4})(?!\d)/,
        // YYYY-MM-DD
        /(\d{4})(?!\d)[\/-](\d{2})[\/-](\d{2})/,
        // DD/MM/YYYY
        /(\d{2})[\/-](\d{2})[\/-](\d{4})(?!\d)/,
    ];

    for (const format of formats) {
        const match = normalized.match(format);
        if (match) {
            try {
                // Validate year is reasonable (1900-2099)
                const yearStr = match[1].length === 4 ? match[1] : match[3];
                const year = parseInt(yearStr);
                if (year < 1900 || year > 2099) {
                    console.log('[License Extractor] Invalid year:', year);
                    return null;
                }

                if (match[1].length === 4) {
                    return `${match[1]}-${match[2]}-${match[3]}`;
                } else if (match[3].length === 4) {
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
                }
            } catch {
                continue;
            }
        }
    }
    return null;
}

function extractNameFromText(text: string): { firstName?: ExtractedField; lastName?: ExtractedField; fullName?: ExtractedField } | null {
    console.log('[License Extractor] Attempting name extraction...');

    // Try labeled name extraction first
    const surnameMatch = text.match(PATTERNS.surname);
    const givenNamesMatch = text.match(PATTERNS.given_names);

    if (surnameMatch || givenNamesMatch) {
        const result: { firstName?: ExtractedField; lastName?: ExtractedField; fullName?: ExtractedField } = {};

        if (givenNamesMatch && givenNamesMatch[1]) {
            const firstName = givenNamesMatch[1].trim().split(/\s+/)[0];
            result.firstName = {
                value: firstName,
                confidence: 0.85,
                rawMatch: givenNamesMatch[0],
            };
        }

        if (surnameMatch && surnameMatch[1]) {
            result.lastName = {
                value: surnameMatch[1].trim(),
                confidence: 0.85,
                rawMatch: surnameMatch[0],
            };
        }

        if (result.firstName || result.lastName) {
            console.log('[License Extractor] Found name via labeled pattern:', result);
            return result;
        }
    }

    // Try full name label
    const fullNameMatch = text.match(PATTERNS.full_name_label);
    if (fullNameMatch && fullNameMatch[1]) {
        const fullName = fullNameMatch[1].trim();
        const parts = fullName.split(/\s+/);
        console.log('[License Extractor] Found name via full name label:', fullName);

        return {
            fullName: { value: fullName, confidence: 0.80, rawMatch: fullNameMatch[0] },
            firstName: parts[0] ? { value: parts[0], confidence: 0.75, rawMatch: parts[0] } : undefined,
            lastName: parts.length > 1 ? { value: parts.slice(1).join(' '), confidence: 0.75, rawMatch: parts.slice(1).join(' ') } : undefined,
        };
    }

    // First try: Look for pattern "FirstName LASTNAME" or "FirstName MiddleName LASTNAME"
    // Where LASTNAME is in uppercase letters (most reliable for Australian licenses)
    // Exclude common words that appear on licenses
    const excludeWords = /^(Australia|Australian|Driver|Licence|License|New|South|Wales|Victoria|Queensland|Western|Northern|Territory|ACT|NSW|VIC|QLD|WA|SA|TAS|NT)$/i;
    const uppercaseLastName = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+([A-Z]{3,})\b/g);

    if (uppercaseLastName) {
        // Find the first match that isn't an excluded word
        for (const match of uppercaseLastName) {
            const parts = match.split(/\s+/);
            const lastName = parts.pop() || '';
            const firstNames = parts.join(' ');
            const firstName = parts[0] || '';

            // Skip if any part is an excluded word
            if (parts.some(p => excludeWords.test(p)) || excludeWords.test(lastName)) {
                continue;
            }

            console.log('[License Extractor] Found name via uppercase pattern:', match);
            return {
                fullName: { value: match, confidence: 0.75, rawMatch: match },
                firstName: { value: firstName, confidence: 0.70, rawMatch: firstName },
                lastName: { value: lastName, confidence: 0.75, rawMatch: lastName },
            };
        }
    }

    // Fallback: Look for name immediately before "Card Number" (on same line)
    // Pattern: "FirstName MiddleName LASTNAME Card Number"
    const beforeCardNumber = text.match(/\n\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+[A-Z]{2,})\s*(?:Card\s*Number|Card\s*No)/i);
    if (beforeCardNumber && beforeCardNumber[1]) {
        const fullName = beforeCardNumber[1].trim();
        const parts = fullName.split(/\s+/);

        // Skip if contains excluded words
        if (!parts.some(p => excludeWords.test(p))) {
            console.log('[License Extractor] Found name before Card Number:', fullName);

            const lastName = parts.pop() || '';
            const firstName = parts[0] || '';

            return {
                fullName: { value: fullName, confidence: 0.70, rawMatch: beforeCardNumber[0] },
                firstName: firstName ? { value: firstName, confidence: 0.65, rawMatch: firstName } : undefined,
                lastName: lastName ? { value: lastName, confidence: 0.70, rawMatch: lastName } : undefined,
            };
        }
    }

    console.log('[License Extractor] No name patterns matched');
    return null;
}

export function extractDriverLicenseData(text: string): ExtractionResult {
    const fields: DriverLicenseExtractionFields = {};

    console.log('[License Extractor] Starting extraction on text length:', text.length);

    // Extract license number
    const licenseAuMatch = text.match(PATTERNS.license_number_au);
    const licenseGenericMatch = text.match(PATTERNS.license_number_generic);
    const licenseMatch = licenseGenericMatch || licenseAuMatch;

    if (licenseMatch && licenseMatch[1]) {
        fields.license_number = {
            value: licenseMatch[1].trim(),
            confidence: licenseGenericMatch ? 0.90 : 0.75,
            rawMatch: licenseMatch[0],
        };
        console.log('[License Extractor] Found license number:', licenseMatch[1]);
    }

    // Extract name
    const nameResult = extractNameFromText(text);
    if (nameResult) {
        if (nameResult.firstName) fields.first_name = nameResult.firstName;
        if (nameResult.lastName) fields.last_name = nameResult.lastName;
        if (nameResult.fullName) fields.full_name = nameResult.fullName;
        console.log('[License Extractor] Found name:', nameResult);
    }

    // Extract DOB - try multiple patterns
    const dobMatch = text.match(PATTERNS.dob);
    if (dobMatch && dobMatch[1]) {
        const parsed = parseDate(dobMatch[1]);
        fields.dob = {
            value: parsed || dobMatch[1],
            confidence: parsed ? 0.85 : 0.70,
            rawMatch: dobMatch[0],
        };
        console.log('[License Extractor] Found DOB:', dobMatch[1]);
    } else {
        // Fallback: look for dates near "Date of Birth" or "Born" text
        const allDates = text.match(PATTERNS.date_labeled) || [];
        const firstDate = allDates[0];
        if (firstDate) {
            // First date is usually DOB on Australian licenses
            const parsed = parseDate(firstDate);
            fields.dob = {
                value: parsed || firstDate,
                confidence: 0.60, // Lower confidence for unlabeled date
                rawMatch: firstDate,
            };
            console.log('[License Extractor] Found DOB from date pattern:', firstDate);
        }
    }

    // Extract expiry date - try multiple patterns
    const expiryMatch = text.match(PATTERNS.expiry);
    if (expiryMatch && expiryMatch[1]) {
        const parsed = parseDate(expiryMatch[1]);
        fields.expiry_date = {
            value: parsed || expiryMatch[1],
            confidence: parsed ? 0.85 : 0.70,
            rawMatch: expiryMatch[0],
        };
        console.log('[License Extractor] Found expiry:', expiryMatch[1]);
    } else {
        // Fallback: use second date found (if we have multiple dates)
        const allDates = text.match(PATTERNS.date_labeled) || [];
        const secondDate = allDates[1];
        if (secondDate) {
            // Second date is usually expiry on Australian licenses
            const parsed = parseDate(secondDate);
            fields.expiry_date = {
                value: parsed || secondDate,
                confidence: 0.60,
                rawMatch: secondDate,
            };
            console.log('[License Extractor] Found expiry from date pattern:', secondDate);
        }
    }

    // Extract address - try multiple patterns
    let addressMatch = text.match(PATTERNS.address);
    if (!addressMatch) {
        addressMatch = text.match(PATTERNS.address_simple);
    }
    if (addressMatch) {
        fields.address = {
            value: addressMatch[1],
            confidence: 0.80,
            rawMatch: addressMatch[0],
        };
        console.log('[License Extractor] Found address:', addressMatch[1]);
    }

    // Extract state
    const stateMatch = text.match(PATTERNS.state_au);
    if (stateMatch) {
        let state = stateMatch[1].toUpperCase();
        // Convert full names to codes
        const lowerState = stateMatch[1].toLowerCase();
        if (STATE_CODES[lowerState]) {
            state = STATE_CODES[lowerState];
        }
        fields.state = {
            value: state,
            confidence: 0.95,
            rawMatch: stateMatch[0],
        };
        console.log('[License Extractor] Found state:', state);
    }

    const fieldCount = Object.keys(fields).length;

    if (fieldCount === 0) {
        return {
            documentType: 'Driver License',
            status: 'failed',
            overallConfidence: 0,
            fields: {},
            rawText: text,
            error: 'Could not extract any information from the driver license',
        };
    }

    const avgConfidence = Object.values(fields)
        .reduce((sum, f) => sum + (f?.confidence || 0), 0) / fieldCount;

    return {
        documentType: 'Driver License',
        status: 'completed',
        overallConfidence: avgConfidence,
        fields: fields as Record<string, ExtractedField>,
        rawText: text,
    };
}
