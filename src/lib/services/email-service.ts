import nodemailer from 'nodemailer';
import { BRAND_PORTAL_NAME } from '@/lib/brand';

export interface SendEmailInput {
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
    attachments?: Array<{
        filename: string;
        content: Buffer | string;
        contentType?: string;
    }>;
}

export interface EmailSendResult {
    success: boolean;
    messageId: string | null;
    error: string | null;
    providerResponse: Record<string, unknown> | null;
}

interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromEmail: string;
    fromName: string;
}

let transporter: nodemailer.Transporter | null = null;
let cachedConfig: SmtpConfig | null = null;

function isStubEmailModeEnabled(): boolean {
    return process.env.INTEGRATION_TEST_STUB_EMAIL === '1'
        || process.env.EMAIL_DELIVERY_MODE === 'stub';
}

function parseBoolean(value: string | undefined): boolean | null {
    if (!value) return null;

    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;

    return null;
}

function getSmtpConfig(): SmtpConfig {
    const host = process.env.SMTP_HOST || '';
    const user = process.env.SMTP_USER || process.env.USER_NAME || '';
    const pass = process.env.SMTP_PASS || process.env.PASSWORD || '';

    const rawPort =
        process.env.SMTP_PORT ||
        process.env.SSL_PORT ||
        process.env.TLS_PORT ||
        '465';

    const port = Number.parseInt(rawPort, 10);
    const secureOverride = parseBoolean(process.env.SMTP_SECURE);
    const secure = secureOverride ?? port === 465;

    const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_FROM || user;
    const fromName = process.env.EMAIL_FROM_NAME || BRAND_PORTAL_NAME;

    if (!host) {
        throw new Error('SMTP_HOST is not configured');
    }

    if (!Number.isFinite(port) || port <= 0) {
        throw new Error(`Invalid SMTP port: ${rawPort}`);
    }

    if (!user) {
        throw new Error('SMTP_USER or USER_NAME is not configured');
    }

    if (!pass) {
        throw new Error('SMTP_PASS or PASSWORD is not configured');
    }

    return {
        host,
        port,
        secure,
        user,
        pass,
        fromEmail,
        fromName,
    };
}

function getTransporter(): { transporter: nodemailer.Transporter; config: SmtpConfig } {
    if (!transporter || !cachedConfig) {
        const config = getSmtpConfig();
        transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: config.user,
                pass: config.pass,
            },
        });
        cachedConfig = config;
    }

    return { transporter, config: cachedConfig };
}

function escapeHtml(content: string): string {
    return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function textToHtml(text: string): string {
    return `<div>${escapeHtml(text).replace(/\n/g, '<br />')}</div>`;
}

export function isEmailServiceConfigured(): boolean {
    if (isStubEmailModeEnabled()) {
        return true;
    }

    return Boolean(
        process.env.SMTP_HOST &&
        (process.env.SMTP_USER || process.env.USER_NAME) &&
        (process.env.SMTP_PASS || process.env.PASSWORD)
    );
}

export async function sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
    if (isStubEmailModeEnabled()) {
        return {
            success: true,
            messageId: `stub-${Date.now()}`,
            error: null,
            providerResponse: {
                mode: 'stub',
                to: input.to,
                subject: input.subject,
                attachmentCount: input.attachments?.length || 0,
            },
        };
    }

    try {
        const { transporter: smtpTransport, config } = getTransporter();

        const info = await smtpTransport.sendMail({
            from: `${config.fromName} <${config.fromEmail}>`,
            to: input.to,
            subject: input.subject,
            text: input.text,
            html: input.html || textToHtml(input.text),
            replyTo: input.replyTo,
            attachments: input.attachments?.map((attachment) => ({
                filename: attachment.filename,
                content: attachment.content,
                contentType: attachment.contentType,
            })),
        });

        const acceptedRecipients = Array.isArray(info.accepted)
            ? info.accepted.filter((entry: unknown): entry is string => typeof entry === 'string')
            : [];
        const rejectedRecipients = Array.isArray(info.rejected)
            ? info.rejected.filter((entry: unknown): entry is string => typeof entry === 'string')
            : [];
        const providerResponse = {
            accepted: info.accepted,
            rejected: info.rejected,
            response: info.response,
            envelope: info.envelope,
        };

        if (acceptedRecipients.length === 0) {
            const rejectionDetail = rejectedRecipients.length > 0
                ? `SMTP rejected recipient(s): ${rejectedRecipients.join(', ')}`
                : 'SMTP did not accept any recipients';

            return {
                success: false,
                messageId: info.messageId || null,
                error: rejectionDetail,
                providerResponse,
            };
        }

        return {
            success: true,
            messageId: info.messageId,
            error: null,
            providerResponse,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown email send error';
        console.error('SMTP send failed:', errorMessage);

        return {
            success: false,
            messageId: null,
            error: errorMessage,
            providerResponse: null,
        };
    }
}
