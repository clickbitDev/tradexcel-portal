import { randomBytes } from 'node:crypto';
import { createAdminServerClient } from '@/lib/supabase/server';
import { readEnvValue } from '@/lib/public-env';

const CERTIFICATE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CERTIFICATE_SUFFIX_LENGTH = 8;
const MAX_CERTIFICATE_NUMBER_ATTEMPTS = 10;

function generateRandomSuffix(length: number): string {
    const bytes = randomBytes(length);

    return Array.from(bytes, (byte) => CERTIFICATE_ALPHABET[byte % CERTIFICATE_ALPHABET.length]).join('');
}

async function certificateNumberExists(certificateNumber: string): Promise<boolean> {
    const supabase = createAdminServerClient();
    const { data, error } = await supabase
        .from('certificate_records')
        .select('id')
        .eq('certificate_number', certificateNumber)
        .maybeSingle<{ id: string }>();

    if (error) {
        throw new Error(`Unable to check certificate number uniqueness: ${error.message}`);
    }

    return Boolean(data?.id);
}

export async function generatePortalCertificateNumber(): Promise<string> {
    const prefix = readEnvValue('CERTIFICATE_PREFIX') || 'CERT';
    const year = new Date().getFullYear();

    for (let attempt = 0; attempt < MAX_CERTIFICATE_NUMBER_ATTEMPTS; attempt += 1) {
        const candidate = `${prefix}-${year}-${generateRandomSuffix(CERTIFICATE_SUFFIX_LENGTH)}`;
        const exists = await certificateNumberExists(candidate);

        if (!exists) {
            return candidate;
        }
    }

    throw new Error('Failed to generate a unique certificate number. Please try again.');
}
