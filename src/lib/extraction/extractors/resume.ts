/**
 * Resume/CV Extractor
 * 
 * Extracts contact information from resume documents.
 */

import type { ExtractionResult, ResumeExtractionFields, ExtractedField } from '../types';

const PATTERNS = {
    // Email pattern
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,

    // Phone patterns (international formats)
    phone: /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/,

    // Australian phone
    phone_au: /(?:\+61|0)[2-478](?:\s?\d{4}\s?\d{4}|\d{8})/,

    // Address patterns
    address: /\d+\s+[A-Za-z]+\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl)[,\s]+[A-Za-z\s]+[,\s]+(?:NSW|VIC|QLD|WA|SA|TAS|NT|ACT|\d{4})/i,
};

// Common resume section headers to skip
const SECTION_HEADERS = [
    'objective', 'summary', 'experience', 'education', 'skills',
    'qualifications', 'employment', 'work history', 'references',
    'professional', 'career', 'achievements', 'certifications',
];

function extractName(text: string): ExtractedField | null {
    // Normalize text: if all on one line, split on double/triple spaces
    let normalizedText = text;
    if (!text.includes('\n') || text.split('\n').filter(l => l.trim()).length <= 3) {
        // No line breaks or very few - normalize by splitting on multiple spaces
        normalizedText = text.replace(/\s{2,}/g, '\n');
        console.log('[Resume Extractor] Normalized single-line text');
    }

    const lines = normalizedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    console.log('[Resume Extractor] First 10 lines:', lines.slice(0, 10));

    // Common titles and suffixes to strip
    const TITLES = /^(mr\.?|mrs\\.?|ms\.?|dr\.?|prof\.)\\s+/i;
    const SUFFIXES = /\\s+(jr\.?|sr\.?|ii|iii|iv|phd|md|esq\\.?)$/i;

    // The name is typically in the first few lines of a resume
    for (let i = 0; i < Math.min(12, lines.length); i++) {
        const line = lines[i];

        // Skip if it looks like a section header
        if (SECTION_HEADERS.some(h => line.toLowerCase().includes(h))) continue;

        // Skip if it's an email or phone
        if (PATTERNS.email.test(line) || PATTERNS.phone.test(line)) continue;

        // Skip if it's just numbers, too short, or looks like an address
        if (/^\d+$/.test(line) || line.length < 3) continue;
        if (/\d{4,}/.test(line)) continue; // Contains 4+ digit numbers (postal codes, phone)
        if (PATTERNS.address.test(line)) continue;

        // Skip common non-name patterns
        if (/^(resume|curriculum vitae|cv|profile|contact|personal details)/i.test(line)) continue;
        if (/^(phone|email|address|linkedin|github|website|portfolio)/i.test(line)) continue;

        // Strip common titles and suffixes for checking
        const cleanLine = line.replace(TITLES, '').replace(SUFFIXES, '').trim();
        const words = cleanLine.split(/\s+/);

        // Should be 1-5 words for a name
        if (words.length < 1 || words.length > 5) continue;

        // Check for name-like patterns
        // Pattern 1: Each word starts with capital letter (standard names)
        const startsWithCapital = words.every(w => /^[A-Z\u00C0-\u00FF][a-z\u00E0-\u00FF'-]*$/.test(w) || /^[A-Z\u00C0-\u00FF]+$/.test(w));

        // Pattern 2: First word starts with capital, others may be lowercase (e.g., "John van der Berg")
        const firstCapital = /^[A-Z\u00C0-\u00FF]/.test(words[0] || '');

        // Pattern 3: Hyphenated names or names with apostrophes
        const hasNameChars = words.every(w => /^[A-Za-z\u00C0-\u00FF'-]+$/.test(w));

        // Pattern 4: ALL CAPS name (common on documents)
        const allCaps = /^[A-Z\u00C0-\u00FF\s'-]+$/.test(cleanLine) && cleanLine.length >= 3;

        // Pattern 5: Mixed case 2-4 words that look like a name (more lenient)
        const looksLikeName = words.length >= 2 && words.length <= 4 &&
            words.every(w => /^[A-Za-z\u00C0-\u00FF'-]+$/.test(w)) &&
            words.every(w => w.length >= 2);

        if ((startsWithCapital || (firstCapital && hasNameChars) || allCaps || looksLikeName) && words.length >= 1 && words.length <= 4) {
            // Convert ALL CAPS to Title Case
            let value = cleanLine;
            if (allCaps && cleanLine === cleanLine.toUpperCase()) {
                value = cleanLine.split(/\s+/).map(w =>
                    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
                ).join(' ');
            }

            console.log('[Resume Extractor] Found name:', value, 'from line:', line);
            return {
                value,
                confidence: startsWithCapital ? 0.85 : (allCaps ? 0.75 : 0.70),
                rawMatch: line,
            };
        }
    }

    // Fallback: Look for "Name:" or "Full Name:" labels
    const nameLabel = text.match(/(?:full\s*name|name)\s*[:\|]\s*([A-Z][a-zA-Z\s'-]+)/i);
    if (nameLabel && nameLabel[1]) {
        const name = nameLabel[1].trim();
        const words = name.split(/\s+/);
        if (words.length >= 1 && words.length <= 5) {
            console.log('[Resume Extractor] Found name via label:', name);
            return {
                value: name,
                confidence: 0.80,
                rawMatch: nameLabel[0],
            };
        }
    }

    console.log('[Resume Extractor] No name found in first lines');
    return null;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' };
    }
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
    };
}

export function extractResumeData(text: string): ExtractionResult {
    const fields: ResumeExtractionFields = {};

    // Extract email
    const emailMatch = text.match(PATTERNS.email);
    if (emailMatch) {
        fields.email = {
            value: emailMatch[0].toLowerCase(),
            confidence: 0.95,
            rawMatch: emailMatch[0],
        };
    }

    // Extract phone (prefer Australian format)
    const phoneAuMatch = text.match(PATTERNS.phone_au);
    const phoneMatch = phoneAuMatch || text.match(PATTERNS.phone);
    if (phoneMatch) {
        fields.phone = {
            value: phoneMatch[0].replace(/[\s.-]/g, ''),
            confidence: phoneAuMatch ? 0.90 : 0.75,
            rawMatch: phoneMatch[0],
        };
    }

    // Extract address
    const addressMatch = text.match(PATTERNS.address);
    if (addressMatch) {
        fields.address = {
            value: addressMatch[0],
            confidence: 0.80,
            rawMatch: addressMatch[0],
        };
    }

    // Extract name
    const nameField = extractName(text);
    if (nameField) {
        fields.full_name = nameField;
        const { firstName, lastName } = splitName(nameField.value);
        fields.first_name = { value: firstName, confidence: nameField.confidence * 0.9, rawMatch: firstName };
        if (lastName) {
            fields.last_name = { value: lastName, confidence: nameField.confidence * 0.9, rawMatch: lastName };
        }
    }

    const fieldCount = Object.keys(fields).length;

    if (fieldCount === 0) {
        return {
            documentType: 'Resume/CV',
            status: 'failed',
            overallConfidence: 0,
            fields: {},
            rawText: text,
            error: 'Could not extract any contact information from the resume',
        };
    }

    const avgConfidence = Object.values(fields)
        .reduce((sum, f) => sum + (f?.confidence || 0), 0) / fieldCount;

    return {
        documentType: 'Resume/CV',
        status: 'completed',
        overallConfidence: avgConfidence,
        fields: fields as Record<string, ExtractedField>,
        rawText: text,
    };
}
