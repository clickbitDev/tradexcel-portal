import {
    createCipheriv,
    createDecipheriv,
    createHash,
    createHmac,
    randomBytes,
    timingSafeEqual,
} from 'crypto';

type JsonRecord = Record<string, unknown>;

function base64UrlEncode(input: Buffer | string): string {
    return Buffer.from(input)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(`${normalized}${padding}`, 'base64');
}

function getEncryptionKey(): Buffer {
    const rawKey =
        process.env.PORTAL_TRANSFER_ENCRYPTION_KEY
        || process.env.TRANSFER_SECRET_ENCRYPTION_KEY
        || process.env.SUPABASE_SERVICE_ROLE_KEY
        || '';

    if (!rawKey) {
        throw new Error('PORTAL_TRANSFER_ENCRYPTION_KEY is not configured.');
    }

    return createHash('sha256').update(rawKey).digest();
}

export function generateTransferSecret(): string {
    return randomBytes(32).toString('hex');
}

export function encryptSecret(secret: string): string {
    const key = getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
        base64UrlEncode(iv),
        base64UrlEncode(tag),
        base64UrlEncode(encrypted),
    ].join('.');
}

export function decryptSecret(encryptedSecret: string | null | undefined): string | null {
    if (!encryptedSecret) {
        return null;
    }

    const [ivPart, tagPart, dataPart] = encryptedSecret.split('.');
    if (!ivPart || !tagPart || !dataPart) {
        return null;
    }

    try {
        const key = getEncryptionKey();
        const decipher = createDecipheriv('aes-256-gcm', key, base64UrlDecode(ivPart));
        decipher.setAuthTag(base64UrlDecode(tagPart));
        const decrypted = Buffer.concat([
            decipher.update(base64UrlDecode(dataPart)),
            decipher.final(),
        ]);

        return decrypted.toString('utf8');
    } catch {
        return null;
    }
}

export function signPayload(secret: string, rawPayload: string): string {
    return createHmac('sha256', secret).update(rawPayload).digest('hex');
}

export function verifyPayloadSignature(secret: string, rawPayload: string, signature: string | null | undefined): boolean {
    if (!signature) {
        return false;
    }

    const expected = Buffer.from(signPayload(secret, rawPayload), 'hex');
    const received = Buffer.from(signature, 'hex');

    if (expected.length !== received.length) {
        return false;
    }

    return timingSafeEqual(expected, received);
}

function encodeJwtSection(input: JsonRecord): string {
    return base64UrlEncode(JSON.stringify(input));
}

export function createTransferToken(secret: string, payload: JsonRecord, expiresInSeconds = 300): string {
    const header = encodeJwtSection({ alg: 'HS256', typ: 'JWT' });
    const body = encodeJwtSection({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    });
    const signature = base64UrlEncode(createHmac('sha256', secret).update(`${header}.${body}`).digest());

    return `${header}.${body}.${signature}`;
}

export function verifyTransferToken<T extends JsonRecord>(secret: string, token: string): T | null {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) {
        return null;
    }

    const expectedSignature = base64UrlEncode(
        createHmac('sha256', secret).update(`${header}.${body}`).digest()
    );

    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(signature);
    if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
        return null;
    }

    try {
        const parsed = JSON.parse(base64UrlDecode(body).toString('utf8')) as T & { exp?: number };
        if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}
