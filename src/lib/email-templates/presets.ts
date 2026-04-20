import { BRAND_ADMISSIONS_TEAM, BRAND_NAME } from '@/lib/brand';

export interface EmailTemplateVariableDefinition {
    key: string;
    desc: string;
}

export interface EmailTemplatePreset {
    key: string;
    name: string;
    description: string;
    usageLabel: string;
    subject: string;
    body: string;
}

export const WELCOME_EMAIL_TO_APPLICATION_TEMPLATE_NAME = 'Welcome Email to Application';
export const EMAIL_AGENT_FOR_MISSING_DOCUMENT_TEMPLATE_NAME = 'Email agent for missing document';

export const EMAIL_TEMPLATE_VARIABLES: EmailTemplateVariableDefinition[] = [
    { key: '{{student_name}}', desc: 'Student full name' },
    { key: '{{student_email}}', desc: 'Student email' },
    { key: '{{application_id}}', desc: 'Application ID (APP-<serial>)' },
    { key: '{{qualification}}', desc: 'Qualification name' },
    { key: '{{rto}}', desc: 'RTO name' },
    { key: '{{appointment_date}}', desc: 'Appointment date and time' },
    { key: '{{intake_date}}', desc: 'Legacy alias for appointment date and time' },
    { key: '{{status}}', desc: 'Current workflow status' },
    { key: '{{agent_name}}', desc: 'Partner/Agent name' },
    { key: '{{portal_link}}', desc: 'Link to the application in the portal' },
    { key: '{{missing_documents}}', desc: 'Bullet list of requested documents' },
    { key: '{{requested_by}}', desc: 'Staff member who requested the email' },
    { key: '{{note_block}}', desc: 'Optional additional note block' },
];

export const EMAIL_TEMPLATE_PRESETS: EmailTemplatePreset[] = [
    {
        key: 'welcome-email-to-application',
        name: WELCOME_EMAIL_TO_APPLICATION_TEMPLATE_NAME,
        description: 'Reusable student-facing welcome/update email for the application details page.',
        usageLabel: 'Manual student email',
        subject: `Welcome to your application {{application_id}}`,
        body: [
            'Dear {{student_name}},',
            '',
            `Welcome to your application with ${BRAND_NAME}.`,
            '',
            'Application ID: {{application_id}}',
            'Qualification: {{qualification}}',
            'RTO: {{rto}}',
            'Current Stage: {{status}}',
            '',
            'You can review your application here:',
            '{{portal_link}}',
            '',
            'Please reply to this email if you need any help.',
            '',
            'Kind regards,',
            BRAND_NAME,
        ].join('\n'),
    },
    {
        key: 'email-agent-for-missing-document',
        name: EMAIL_AGENT_FOR_MISSING_DOCUMENT_TEMPLATE_NAME,
        description: 'Used by the frontdesk missing-documents workflow when notifying the linked agent/provider.',
        usageLabel: 'System reminder',
        subject: `Missing documents required - {{student_name}} ({{application_id}})`,
        body: [
            'Hello {{agent_name}},',
            '',
            'Additional documents are required for {{student_name}} ({{application_id}}).',
            '',
            'Missing documents:',
            '{{missing_documents}}',
            '',
            '{{note_block}}Open the application here:',
            '{{portal_link}}',
            '',
            'Requested by: {{requested_by}}',
            '',
            'Regards,',
            BRAND_ADMISSIONS_TEAM,
        ].join('\n'),
    },
];

export function renderEmailTemplate(template: string, variables: Record<string, string>): string {
    let rendered = template;

    for (const [token, value] of Object.entries(variables)) {
        rendered = rendered.split(token).join(value);
    }

    return rendered.replace(/\n{3,}/g, '\n\n').trim();
}
