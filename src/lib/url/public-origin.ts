function firstHeaderValue(value: string | null): string | null {
    if (!value) {
        return null;
    }

    const normalized = value
        .split(',')[0]
        .trim();

    return normalized || null;
}

function normalizeSiteUrl(url: string | undefined): string | null {
    if (!url) {
        return null;
    }

    const trimmed = url.trim();
    if (!trimmed) {
        return null;
    }

    try {
        const parsed = new URL(trimmed);
        return parsed.origin;
    } catch {
        return null;
    }
}

function isUsableHost(host: string | null): boolean {
    if (!host) {
        return false;
    }

    const hostname = host.split(':')[0].toLowerCase();
    if (!hostname) {
        return false;
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return true;
    }

    if (hostname.includes('.')) {
        return true;
    }

    if (hostname.endsWith('.local')) {
        return true;
    }

    if (/^[a-f0-9]{12,}$/i.test(hostname)) {
        return false;
    }

    return false;
}

export function getPublicOrigin(request: Request): string {
    const requestUrl = new URL(request.url);
    const configuredOrigin = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

    const forwardedHost = firstHeaderValue(request.headers.get('x-forwarded-host'));
    const forwardedProto = firstHeaderValue(request.headers.get('x-forwarded-proto')) || requestUrl.protocol.replace(':', '');

    if (isUsableHost(forwardedHost)) {
        return `${forwardedProto}://${forwardedHost}`;
    }

    const host = firstHeaderValue(request.headers.get('host'));
    const requestProto = requestUrl.protocol.replace(':', '');

    if (isUsableHost(host)) {
        return `${requestProto}://${host}`;
    }

    if (configuredOrigin) {
        return configuredOrigin;
    }

    return requestUrl.origin;
}

export function createPublicUrl(request: Request, path: string): URL {
    return new URL(path, getPublicOrigin(request));
}
