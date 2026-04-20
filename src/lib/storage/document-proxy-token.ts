import { createHmac, timingSafeEqual } from 'crypto';

function getDocumentProxySecret(): string {
    return process.env.PORTAL_TRANSFER_ENCRYPTION_KEY
        || process.env.TRANSFER_SECRET_ENCRYPTION_KEY
        || process.env.SUPABASE_SERVICE_ROLE_KEY
        || 'document-proxy-fallback-secret';
}

function base64UrlEncode(value: string): string {
    return Buffer.from(value, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function base64UrlDecode(value: string): string {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function sign(value: string): string {
    return createHmac('sha256', getDocumentProxySecret()).update(value).digest('hex');
}

export function createDocumentProxyToken(documentId: string, expiresInSeconds = 300): string {
    const payload = JSON.stringify({
        documentId,
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    });
    const encodedPayload = base64UrlEncode(payload);
    return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyDocumentProxyToken(token: string | null | undefined, documentId: string): boolean {
    if (!token) {
        return false;
    }

    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) {
        return false;
    }

    const expected = Buffer.from(sign(encodedPayload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
        return false;
    }

    try {
        const payload = JSON.parse(base64UrlDecode(encodedPayload)) as {
            documentId?: string;
            exp?: number;
        };

        return payload.documentId === documentId
            && typeof payload.exp === 'number'
            && payload.exp >= Math.floor(Date.now() / 1000);
    } catch {
        return false;
    }
}
