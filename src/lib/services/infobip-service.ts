/**
 * Infobip Service
 * Handles SMS and WhatsApp messaging via Infobip API
 */

// Infobip Configuration from environment
const INFOBIP_API_KEY = process.env.INFOBIP_API_KEY || '';
const INFOBIP_BASE_URL = process.env.INFOBIP_BASE_URL || '4kmz58.api.infobip.com';
const INFOBIP_SMS_SENDER = process.env.INFOBIP_SMS_SENDER || '447491163443';
const INFOBIP_WHATSAPP_SENDER = process.env.INFOBIP_WHATSAPP_SENDER || '447860088970';

export interface InfobipResult {
    success: boolean;
    messageId: string | null;
    error: string | null;
    statusCode?: number;
}

interface InfobipSmsResponse {
    messages: Array<{
        messageId: string;
        status: {
            groupId: number;
            groupName: string;
            id: number;
            name: string;
            description: string;
        };
        to: string;
    }>;
}

interface InfobipWhatsAppResponse {
    messages: Array<{
        messageId: string;
        status: {
            groupId: number;
            groupName: string;
            id: number;
            name: string;
            description: string;
        };
        to: string;
    }>;
}

/**
 * Send an SMS message via Infobip
 */
export async function sendSms(to: string, message: string): Promise<InfobipResult> {
    if (!INFOBIP_API_KEY) {
        console.error('Infobip API key not configured');
        return { success: false, messageId: null, error: 'Infobip API key not configured' };
    }

    // Normalize phone number (remove spaces, ensure + prefix for international)
    const normalizedTo = normalizePhoneNumber(to);

    try {
        const response = await fetch(`https://${INFOBIP_BASE_URL}/sms/2/text/advanced`, {
            method: 'POST',
            headers: {
                'Authorization': `App ${INFOBIP_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                messages: [{
                    destinations: [{ to: normalizedTo }],
                    from: INFOBIP_SMS_SENDER,
                    text: message,
                }],
            }),
        });

        const data: InfobipSmsResponse = await response.json();

        if (!response.ok) {
            console.error('Infobip SMS error:', data);
            return {
                success: false,
                messageId: null,
                error: `HTTP ${response.status}: ${JSON.stringify(data)}`,
                statusCode: response.status,
            };
        }

        const firstMessage = data.messages?.[0];
        if (firstMessage) {
            // Check if status indicates success (groupId 1 = PENDING, 3 = DELIVERED)
            const isSuccess = [1, 3].includes(firstMessage.status.groupId);
            return {
                success: isSuccess,
                messageId: firstMessage.messageId,
                error: isSuccess ? null : firstMessage.status.description,
                statusCode: response.status,
            };
        }

        return { success: false, messageId: null, error: 'No message in response' };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Infobip SMS exception:', errorMessage);
        return { success: false, messageId: null, error: errorMessage };
    }
}

/**
 * Send a WhatsApp template message via Infobip
 * Note: WhatsApp requires pre-approved templates from Meta
 */
export async function sendWhatsAppTemplate(
    to: string,
    templateName: string = 'test_whatsapp_template_en',
    placeholders: string[] = ['ClickBIT'],
    language: string = 'en'
): Promise<InfobipResult> {
    if (!INFOBIP_API_KEY) {
        console.error('Infobip API key not configured');
        return { success: false, messageId: null, error: 'Infobip API key not configured' };
    }

    // Normalize phone number
    const normalizedTo = normalizePhoneNumber(to);

    try {
        const response = await fetch(`https://${INFOBIP_BASE_URL}/whatsapp/1/message/template`, {
            method: 'POST',
            headers: {
                'Authorization': `App ${INFOBIP_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                messages: [{
                    from: INFOBIP_WHATSAPP_SENDER,
                    to: normalizedTo,
                    content: {
                        templateName,
                        templateData: {
                            body: {
                                placeholders,
                            },
                        },
                        language,
                    },
                }],
            }),
        });

        const data: InfobipWhatsAppResponse = await response.json();

        if (!response.ok) {
            console.error('Infobip WhatsApp error:', data);
            return {
                success: false,
                messageId: null,
                error: `HTTP ${response.status}: ${JSON.stringify(data)}`,
                statusCode: response.status,
            };
        }

        const firstMessage = data.messages?.[0];
        if (firstMessage) {
            // Check if status indicates success
            const isSuccess = [1, 3].includes(firstMessage.status.groupId);
            return {
                success: isSuccess,
                messageId: firstMessage.messageId,
                error: isSuccess ? null : firstMessage.status.description,
                statusCode: response.status,
            };
        }

        return { success: false, messageId: null, error: 'No message in response' };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Infobip WhatsApp exception:', errorMessage);
        return { success: false, messageId: null, error: errorMessage };
    }
}

/**
 * Send a free-form WhatsApp message (only works within 24-hour customer service window)
 */
export async function sendWhatsAppText(to: string, message: string): Promise<InfobipResult> {
    if (!INFOBIP_API_KEY) {
        console.error('Infobip API key not configured');
        return { success: false, messageId: null, error: 'Infobip API key not configured' };
    }

    const normalizedTo = normalizePhoneNumber(to);

    try {
        const response = await fetch(`https://${INFOBIP_BASE_URL}/whatsapp/1/message/text`, {
            method: 'POST',
            headers: {
                'Authorization': `App ${INFOBIP_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                from: INFOBIP_WHATSAPP_SENDER,
                to: normalizedTo,
                content: {
                    text: message,
                },
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Infobip WhatsApp text error:', data);
            return {
                success: false,
                messageId: null,
                error: `HTTP ${response.status}: ${JSON.stringify(data)}`,
                statusCode: response.status,
            };
        }

        return {
            success: true,
            messageId: data.messageId || null,
            error: null,
            statusCode: response.status,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Infobip WhatsApp text exception:', errorMessage);
        return { success: false, messageId: null, error: errorMessage };
    }
}

/**
 * Normalize phone number to international format
 */
function normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters except +
    let normalized = phone.replace(/[^\d+]/g, '');

    // If starts with 0, assume Australian and replace with 61
    if (normalized.startsWith('0')) {
        normalized = '61' + normalized.slice(1);
    }

    // Remove leading + if present (Infobip expects digits only)
    if (normalized.startsWith('+')) {
        normalized = normalized.slice(1);
    }

    return normalized;
}
