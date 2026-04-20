import https from 'node:https';
import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type BackblazeConfig = {
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    endpoint: string;
    region: string;
};

let cachedClient: S3Client | null = null;
let cachedConfig: BackblazeConfig | null = null;

const BACKBLAZE_CONNECTION_TIMEOUT_MS = 10_000;
const BACKBLAZE_SOCKET_TIMEOUT_MS = 30_000;
const BACKBLAZE_MAX_ATTEMPTS = 3;

function readRequiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required Backblaze env var: ${name}`);
    }

    return value;
}

export function getBackblazeConfig(): BackblazeConfig {
    if (cachedConfig) {
        return cachedConfig;
    }

    const endpoint = readRequiredEnv('BACKBLAZE_BUCKET_ENDPOINT').replace(/\/+$/, '');
    if (!/^https:\/\//i.test(endpoint)) {
        throw new Error('BACKBLAZE_BUCKET_ENDPOINT must start with https://');
    }

    cachedConfig = {
        accessKeyId: readRequiredEnv('BACKBLAZE_ACCESS_KEY_ID'),
        secretAccessKey: readRequiredEnv('BACKBLAZE_SECRET_ACCESS_KEY'),
        bucketName: readRequiredEnv('BACKBLAZE_APPLICATION_BUCKETNAME'),
        endpoint,
        region: readRequiredEnv('BACKBLAZE_BUCKET_REGION'),
    };

    return cachedConfig;
}

export function getBackblazeS3Client(): S3Client {
    if (cachedClient) {
        return cachedClient;
    }

    const config = getBackblazeConfig();
    cachedClient = new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: true,
        requestHandler: new NodeHttpHandler({
            httpsAgent: new https.Agent({
                keepAlive: true,
                family: 4,
            }),
            connectionTimeout: BACKBLAZE_CONNECTION_TIMEOUT_MS,
            socketTimeout: BACKBLAZE_SOCKET_TIMEOUT_MS,
        }),
        maxAttempts: BACKBLAZE_MAX_ATTEMPTS,
    });

    return cachedClient;
}

export async function createBackblazeUploadUrl(input: {
    key: string;
    contentType: string;
    expiresIn?: number;
}): Promise<string> {
    const client = getBackblazeS3Client();
    const config = getBackblazeConfig();

    return getSignedUrl(
        client,
        new PutObjectCommand({
            Bucket: config.bucketName,
            Key: input.key,
            ContentType: input.contentType,
        }),
        { expiresIn: input.expiresIn ?? 900 }
    );
}

export async function putBackblazeObject(input: {
    key: string;
    body: Buffer | Uint8Array | string;
    contentType: string;
    contentDisposition?: string;
}): Promise<void> {
    const client = getBackblazeS3Client();
    const config = getBackblazeConfig();

    await client.send(new PutObjectCommand({
        Bucket: config.bucketName,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ...(input.contentDisposition
            ? { ContentDisposition: input.contentDisposition }
            : {}),
    }));
}

export async function createBackblazeDownloadUrl(input: {
    key: string;
    fileName?: string;
    expiresIn?: number;
}): Promise<string> {
    const client = getBackblazeS3Client();
    const config = getBackblazeConfig();

    return getSignedUrl(
        client,
        new GetObjectCommand({
            Bucket: config.bucketName,
            Key: input.key,
            ...(input.fileName
                ? {
                    ResponseContentDisposition: `inline; filename="${input.fileName.replace(/"/g, '')}"`,
                }
                : {}),
        }),
        { expiresIn: input.expiresIn ?? 3600 }
    );
}

export async function headBackblazeObject(key: string) {
    const client = getBackblazeS3Client();
    const config = getBackblazeConfig();

    return client.send(new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: key,
    }));
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableHeadObjectError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const candidate = error as {
        name?: string;
        code?: string;
        message?: string;
        $metadata?: { httpStatusCode?: number };
    };

    const name = (candidate.name || '').toLowerCase();
    const code = (candidate.code || '').toLowerCase();
    const message = (candidate.message || '').toLowerCase();
    const status = candidate.$metadata?.httpStatusCode;

    return (
        name.includes('timeout')
        || code.includes('timeout')
        || code === 'notfound'
        || name === 'notfound'
        || message.includes('timed out')
        || message.includes('timeout')
        || message.includes('socket hang up')
        || status === 408
        || status === 429
        || status === 500
        || status === 502
        || status === 503
        || status === 504
    );
}

export async function headBackblazeObjectWithRetry(input: {
    key: string;
    attempts?: number;
    delaysMs?: number[];
}) {
    const attempts = input.attempts ?? 4;
    const delaysMs = input.delaysMs ?? [250, 750, 1500];

    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await headBackblazeObject(input.key);
        } catch (error) {
            lastError = error;

            if (attempt >= attempts || !isRetryableHeadObjectError(error)) {
                throw error;
            }

            const delay = delaysMs[Math.min(attempt - 1, delaysMs.length - 1)] ?? 1500;
            await sleep(delay);
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error('Backblaze object verification failed after retries.');
}

export async function getBackblazeObjectBuffer(key: string): Promise<{
    buffer: Buffer;
    contentType: string | null;
    contentLength: number | null;
}> {
    const client = getBackblazeS3Client();
    const config = getBackblazeConfig();
    const response = await client.send(new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
    }));

    if (!response.Body) {
        throw new Error('Backblaze returned an empty object body.');
    }

    const bytes = await response.Body.transformToByteArray();
    return {
        buffer: Buffer.from(bytes),
        contentType: response.ContentType || null,
        contentLength: typeof response.ContentLength === 'number' ? response.ContentLength : null,
    };
}

export async function deleteBackblazeObject(key: string): Promise<void> {
    const client = getBackblazeS3Client();
    const config = getBackblazeConfig();

    await client.send(new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: key,
    }));
}
