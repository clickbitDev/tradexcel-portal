import {
    ACCOUNTS_MANAGER_PORTAL_ALIAS_BASE,
    ACCOUNTS_MANAGER_PORTAL_BASE,
    ADMIN_PORTAL_BASE,
    AGENT_BASE,
    ASSESSOR_BASE,
    ASSESSOR_PORTAL_BASE,
    DISPATCH_COORDINATOR_PORTAL_BASE,
    EXECUTIVE_MANAGER_PORTAL_BASE,
    mapAccountsManagerPathToPortal,
    mapAdminPathToPortal,
    mapAgentPathToPortal,
    mapAssessorPathToPortal,
    mapDispatchCoordinatorPathToPortal,
    mapExecutivePathToPortal,
} from '@/lib/routes/portal';

export interface UserGuideContent {
    title: string;
    overview: string;
    pageContains: string[];
    actions: string[];
    steps: string[];
    tips?: string[];
    roleNote?: string;
}

interface UserGuideEntry {
    pattern: string;
    guide: UserGuideContent;
}

function guide(pattern: string, guideContent: UserGuideContent): UserGuideEntry {
    return {
        pattern,
        guide: guideContent,
    };
}

function fallbackTitleFromPath(pathname: string): string {
    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments.at(-1) || 'page';

    if (lastSegment.startsWith('[') && lastSegment.endsWith(']')) {
        return 'Page guide';
    }

    return `${lastSegment.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())} guide`;
}

function normalizeGuidePath(pathname: string): string {
    const trimmedPath = pathname.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';

    if (trimmedPath === AGENT_BASE || trimmedPath.startsWith(`${AGENT_BASE}/`)) {
        return mapAgentPathToPortal(trimmedPath);
    }

    if (trimmedPath === ADMIN_PORTAL_BASE || trimmedPath.startsWith(`${ADMIN_PORTAL_BASE}/`)) {
        return mapAdminPathToPortal(trimmedPath);
    }

    if (trimmedPath === EXECUTIVE_MANAGER_PORTAL_BASE || trimmedPath.startsWith(`${EXECUTIVE_MANAGER_PORTAL_BASE}/`)) {
        return mapExecutivePathToPortal(trimmedPath);
    }

    if (
        trimmedPath === ACCOUNTS_MANAGER_PORTAL_BASE
        || trimmedPath.startsWith(`${ACCOUNTS_MANAGER_PORTAL_BASE}/`)
        || trimmedPath === ACCOUNTS_MANAGER_PORTAL_ALIAS_BASE
        || trimmedPath.startsWith(`${ACCOUNTS_MANAGER_PORTAL_ALIAS_BASE}/`)
    ) {
        return mapAccountsManagerPathToPortal(trimmedPath);
    }

    if (trimmedPath === DISPATCH_COORDINATOR_PORTAL_BASE || trimmedPath.startsWith(`${DISPATCH_COORDINATOR_PORTAL_BASE}/`)) {
        return mapDispatchCoordinatorPathToPortal(trimmedPath);
    }

    if (
        trimmedPath === ASSESSOR_PORTAL_BASE
        || trimmedPath.startsWith(`${ASSESSOR_PORTAL_BASE}/`)
        || trimmedPath === ASSESSOR_BASE
        || trimmedPath.startsWith(`${ASSESSOR_BASE}/`)
    ) {
        return mapAssessorPathToPortal(trimmedPath);
    }

    return trimmedPath;
}

function matchesGuidePattern(pathname: string, pattern: string): boolean {
    const pathSegments = pathname.split('/').filter(Boolean);
    const patternSegments = pattern.split('/').filter(Boolean);

    if (pathSegments.length !== patternSegments.length) {
        return false;
    }

    return patternSegments.every((segment, index) => {
        if (segment.startsWith('[') && segment.endsWith(']')) {
            return pathSegments[index].length > 0;
        }

        return segment === pathSegments[index];
    });
}

function guideScore(pattern: string): number {
    return pattern
        .split('/').filter(Boolean)
        .reduce((score, segment) => score + (segment.startsWith('[') ? 1 : 3), 0);
}

export const USER_GUIDE_ENTRIES: UserGuideEntry[] = [
    guide('/portal', {
        title: 'Dashboard guide',
        overview: 'Use the dashboard to monitor workload, jump into active queues, and spot operational issues quickly.',
        pageContains: [
            'role-aware summary cards, queue counts, recent activity, and key operational shortcuts',
            'financial and workflow widgets that change based on your staff role',
        ],
        actions: [
            'review the biggest queues first and open the matching worklist',
            'use recent activity and cards to jump straight into items that need attention',
        ],
        steps: [
            'Scan the top cards to understand the current workload.',
            'Open the queue, report, or application area linked to the metric you want to act on.',
            'Return to the dashboard after updates to confirm counts have changed as expected.',
        ],
        tips: [
            'The exact cards and actions vary by role, so the dashboard is your fastest starting point each day.',
        ],
    }),
    guide('/portal/applications', {
        title: 'Applications list guide',
        overview: 'This page is the main application worklist for staff. Use it to search, filter, and open records for the next workflow action.',
        pageContains: [
            'search, date, stage, payment, partner, RTO, and qualification filters',
            'role-aware application tables and queue counts that hide trashed records',
        ],
        actions: [
            'filter applications down to the exact queue you need to work on',
            'open any application to review documents, workflow history, assignments, and next actions',
        ],
        steps: [
            'Use filters at the top to narrow the list by stage, date range, partner, RTO, or payment status.',
            'Review the results table and open the application that needs attention.',
            'Complete the next action from the detail page, then come back to this list to continue the queue.',
        ],
        tips: [
            'Visible rows and actions change by role, so two staff members may see different queues on the same page.',
        ],
    }),
    guide('/portal/applications/new', {
        title: 'New application guide',
        overview: 'Use this page to create a new application record and capture the initial student, course, and partner details.',
        pageContains: [
            'application intake fields, student details, source details, and course selection inputs',
            'validation messages that help you catch missing or duplicate information before saving',
        ],
        actions: [
            'create a new application with the correct student, partner, and offering information',
            'save the record so it can continue through docs review, assess, finance, and dispatch workflows',
        ],
        steps: [
            'Enter the student and course details carefully, especially names, email, and the selected offering.',
            'Review the validation messages and fix any duplicate or required-field warnings.',
            'Save the application and confirm the new record opens in the correct workflow state.',
        ],
        tips: [
            'Accurate intake data reduces later rework in documents, finance, and reporting.',
        ],
    }),
    guide('/portal/applications/[id]', {
        title: 'Application detail guide',
        overview: 'This is the main operations page for one application. Use it to review the record, manage workflow tasks, upload documents, and complete role-specific actions.',
        pageContains: [
            'summary cards, workflow status, assignments, financial details, document tabs, timeline, and role-specific task panels',
            'quick actions such as workflow transitions, Xero actions, notifications, trash/restore, and supporting document tools',
        ],
        actions: [
            'review the full application history and current workflow position',
            'complete role-based tasks such as assessment updates, docs review actions, finance requests, dispatch, and communications',
        ],
        steps: [
            'Start with the status and summary cards to understand the current stage, owner, and blockers.',
            'Use the tabs to inspect documents, notes, communications, payments, or history before making changes.',
            'Run the next approved action from the visible task panels or quick-action buttons, then confirm the timeline updates.',
        ],
        tips: [
            'Actions shown on this page change by role and workflow stage.',
            'Acquire the record lock when you need to edit or run protected actions.',
        ],
        roleNote: 'Admins, Accounts Managers, Executive Managers, Frontdesk, Dispatch Coordinators, and Assessors can all land on this page, but each role sees different actions and responsibilities.',
    }),
    guide('/portal/applications/[id]/edit', {
        title: 'Edit application guide',
        overview: 'Use this page to correct application information after the record has already been created.',
        pageContains: [
            'editable form sections for student, partner, course, and workflow-related fields',
            'save controls and validation feedback for changed application data',
        ],
        actions: [
            'correct data-entry mistakes or update missing application information',
            'save changes that affect later workflow, reporting, or communications',
        ],
        steps: [
            'Review the current details before editing so you only change the fields that need correction.',
            'Update the required fields and check for validation warnings.',
            'Save the record and reopen the detail page to confirm the updated values and downstream actions still make sense.',
        ],
        tips: [
            'Be careful when changing course, partner, or payment-related fields because they affect later workflow steps.',
        ],
    }),
    guide('/portal/partners', {
        title: 'Partners guide',
        overview: 'Use this page to browse, review, and manage partner organisations linked to applications.',
        pageContains: [
            'a searchable partner list with status, type, and summary information',
            'links into partner records, application relationships, and setup actions',
        ],
        actions: [
            'review partner records and open one to inspect application volume or contact details',
            'start partner creation, import, or maintenance tasks from a single place',
        ],
        steps: [
            'Search or scan the list to find the partner you need.',
            'Open the partner record to inspect linked applications, status, and relationship details.',
            'Use the page actions to create, edit, or import partner data as needed.',
        ],
        tips: [
            'Keeping partner records clean improves agent reporting, ownership, and communications.',
        ],
    }),
    guide('/portal/partners/new', {
        title: 'New partner guide',
        overview: 'Use this page to add a new partner organisation before it starts sending applications.',
        pageContains: [
            'partner profile fields, company details, type selection, and relationship settings',
            'validation and save controls for creating a clean partner record',
        ],
        actions: [
            'create a new partner profile with the right type and contact information',
            'prepare the partner so applications and staff assignments link correctly later',
        ],
        steps: [
            'Enter the partner company name, partner type, and the key business details.',
            'Review linked settings such as parent partner relationships if they apply.',
            'Save the partner and confirm it appears in the partner list and application forms.',
        ],
    }),
    guide('/portal/partners/import', {
        title: 'Partner import guide',
        overview: 'Use this page to bulk-load partner records from a prepared import file instead of adding them one by one.',
        pageContains: [
            'file upload controls, import instructions, and validation feedback',
            'error reporting that helps you fix rows before or after import',
        ],
        actions: [
            'upload a structured partner file for bulk creation',
            'review import errors and clean the source data before retrying',
        ],
        steps: [
            'Prepare your source file in the expected format.',
            'Upload the file and review any field-mapping or validation warnings.',
            'Run the import, then confirm the new partners appear in the partner list.',
        ],
        tips: [
            'Small test imports are safer than loading a large unknown file first.',
        ],
    }),
    guide('/portal/partners/[id]', {
        title: 'Partner detail guide',
        overview: 'Use this page to inspect one partner, review related applications, and understand performance or relationship details.',
        pageContains: [
            'partner summary information, linked applications, and relationship context',
            'actions for editing the partner record and reviewing connected work',
        ],
        actions: [
            'review current applications, financial context, and contact details for one partner',
            'jump from the partner record into the linked applications that need attention',
        ],
        steps: [
            'Read the partner summary to confirm you are on the correct organisation.',
            'Review linked applications and related metrics to understand current activity.',
            'Open an application or edit the partner record when an update is needed.',
        ],
    }),
    guide('/portal/partners/[id]/edit', {
        title: 'Edit partner guide',
        overview: 'Use this page to update an existing partner record without recreating it.',
        pageContains: [
            'editable partner profile fields and relationship settings',
            'save controls for company, type, and contact updates',
        ],
        actions: [
            'correct stale partner details such as company info or relationship data',
            'keep downstream application, reporting, and ownership data aligned with the current partner setup',
        ],
        steps: [
            'Review the current partner record before editing.',
            'Change only the fields that need updating and check for validation feedback.',
            'Save the record and confirm the partner detail page reflects the new information.',
        ],
    }),
    guide('/portal/qualifications', {
        title: 'Qualifications guide',
        overview: 'Use this page to browse and maintain the qualifications and their qualification-level price lists used by applications.',
        pageContains: [
            'qualification list views, search, status indicators, and linked metadata',
            'navigation into qualification detail, edit, import, and creation flows',
        ],
        actions: [
            'review available qualifications and open one for more detail',
            'add, edit, or bulk-import qualifications when your course catalogue changes',
        ],
        steps: [
            'Search or filter the list to locate the qualification you need.',
            'Open the detail page for a deeper review, or create/import a new qualification if it is missing.',
            'Keep status and compliance details accurate so application workflows stay valid.',
        ],
    }),
    guide('/portal/qualifications/new', {
        title: 'New qualification guide',
        overview: 'Use this form to add a qualification manually when it is not already in the system.',
        pageContains: [
            'qualification identity, compliance, preview, and supporting configuration fields',
            'save controls and validation for manual qualification setup',
        ],
        actions: [
            'create a new qualification record with its own price list',
            'upload or configure supporting preview and compliance information',
        ],
        steps: [
            'Enter the code, name, and compliance details carefully.',
            'Attach any preview or related assets required for downstream workflows.',
            'Save the qualification and verify it can be selected in the relevant offering or application flows.',
        ],
    }),
    guide('/portal/qualifications/import', {
        title: 'Qualification import guide',
        overview: 'Use this page to bulk-load qualifications from a prepared source file.',
        pageContains: [
            'upload controls, import instructions, and qualification validation feedback',
            'error handling so you can fix invalid rows before retrying',
        ],
        actions: [
            'import multiple qualifications at once instead of entering them manually',
            'check the import result and correct any rows that failed validation',
        ],
        steps: [
            'Prepare the source file in the expected format.',
            'Upload it and review validation output carefully.',
            'Run the import and confirm the new qualifications appear in the qualifications list.',
        ],
    }),
    guide('/portal/qualifications/[id]', {
        title: 'Qualification detail guide',
        overview: 'Use this page to review one qualification, its status, and the information needed for staff and application workflows.',
        pageContains: [
            'qualification summary details, compliance information, and related metadata',
            'links to edit the qualification and inspect its current setup',
        ],
        actions: [
            'check whether a qualification is active, complete, and ready for use',
            'review the qualification before editing or linking it to offerings',
        ],
        steps: [
            'Read the main qualification fields to confirm you have the correct record.',
            'Review compliance or preview-related details for accuracy.',
            'Use edit when a qualification detail or status needs correction.',
        ],
    }),
    guide('/portal/qualifications/[id]/edit', {
        title: 'Edit qualification guide',
        overview: 'Use this page to maintain qualification details after the record already exists.',
        pageContains: [
            'editable qualification fields, status controls, and related setup inputs',
            'save actions for keeping qualification data current',
        ],
        actions: [
            'update qualification details, status, or related configuration',
            'fix inaccuracies that would otherwise affect offerings or application processing',
        ],
        steps: [
            'Review the existing qualification details before making changes.',
            'Update the required fields and check for validation warnings.',
            'Save the record and verify the detail page now reflects the corrected information.',
        ],
    }),
    guide('/portal/settings/rto', {
        title: 'Portal RTO guide',
        overview: 'Use this page to configure the single RTO record used by this portal for transferred applications, qualification pricing, and portal-wide provider details.',
        pageContains: [
            'one editable portal RTO form with code, name, status, and contact details',
            'save controls that make the configured RTO the portal default',
        ],
        actions: [
            'set or update the only RTO this portal should use',
            'confirm transferred applications resolve against the correct local RTO',
        ],
        steps: [
            'Review the current portal RTO details and confirm they match the provider for this portal.',
            'Update the required fields such as code, name, and contact information.',
            'Save the record so transferred applications and pricing use the configured portal RTO.',
        ],
    }),
    guide('/portal/reports', {
        title: 'Reports guide',
        overview: 'Use this page to review operational and business reporting across the portal.',
        pageContains: [
            'report filters, summaries, exports, and reporting tables',
            'cross-functional reporting views for applications and related operational data',
        ],
        actions: [
            'review trends, performance, and operational volume over a chosen period',
            'export report output for finance, leadership, or compliance use',
        ],
        steps: [
            'Set the date range or other report filters first.',
            'Review the summary numbers and tables that update from those filters.',
            'Export or share the result if you need to hand the data to another team.',
        ],
    }),
    guide('/portal/reports/invoices', {
        title: 'Invoice reports guide',
        overview: 'Use this page to review invoicing-focused reporting and track finance activity tied to applications.',
        pageContains: [
            'invoice-oriented filters, finance tables, and reporting summaries',
            'application-linked invoice reporting for finance follow-up',
        ],
        actions: [
            'review invoice progress and finance activity by application or period',
            'identify records that still need invoicing follow-up',
        ],
        steps: [
            'Apply the invoice or date filters that match your reporting period.',
            'Review the table and summary numbers for outstanding or completed activity.',
            'Open related application or finance pages if a record needs action.',
        ],
    }),
    guide('/portal/tickets', {
        title: 'Tickets guide',
        overview: 'Use this page to review support or operational tickets raised inside the portal.',
        pageContains: [
            'ticket listings, statuses, and ticket-related workflow controls',
            'links into specific ticket conversations or related records',
        ],
        actions: [
            'review open tickets and prioritise urgent issues',
            'open a ticket and continue the conversation or resolution work',
        ],
        steps: [
            'Sort or scan the ticket list for the highest-priority issue.',
            'Open the ticket to review the latest notes and history.',
            'Update the ticket or act on the linked record as required.',
        ],
    }),
    guide('/portal/settings', {
        title: 'Settings hub guide',
        overview: 'Use the settings hub to reach the system configuration pages used by operations, finance, staff management, and communications.',
        pageContains: [
            'shortcuts into account, staff, workflow, Xero, notification, and configuration pages',
            'the central navigation point for most system-level maintenance tasks',
        ],
        actions: [
            'open the settings area that matches the process you need to maintain',
            'review high-level system configuration responsibilities in one place',
        ],
        steps: [
            'Choose the settings category that matches your task.',
            'Open the related configuration page and make the required update.',
            'Return to the settings hub when you need to move to another admin area.',
        ],
    }),
    guide('/portal/settings/account', {
        title: 'Account settings guide',
        overview: 'Use this page to review and manage account-level settings for the current portal account.',
        pageContains: [
            'account profile fields and account-level configuration controls',
            'save actions for maintaining the current account information',
        ],
        actions: [
            'update account-level information and keep profile details current',
            'review the current account setup before changing related settings',
        ],
        steps: [
            'Review the existing account values on the page.',
            'Change the fields that need updating.',
            'Save the page and confirm the new account settings persist.',
        ],
    }),
    guide('/portal/settings/agents', {
        title: 'Agent settings guide',
        overview: 'Use this page to manage settings and operational controls that affect the agent channel.',
        pageContains: [
            'agent-related settings, supporting configuration, and maintenance tools',
            'controls that shape how agent-side activity is handled in the portal',
        ],
        actions: [
            'adjust agent-facing configuration and operational defaults',
            'review current setup before changing partner or channel behaviour',
        ],
        steps: [
            'Review the current agent configuration on the page.',
            'Update the settings that match the business change you need.',
            'Save and re-check the affected agent workflows afterward.',
        ],
    }),
    guide('/portal/settings/api', {
        title: 'API settings guide',
        overview: 'Use this page to review integrations and settings related to API access or platform connectivity.',
        pageContains: [
            'API-related configuration values and integration controls',
            'status or maintenance tools for technical platform settings',
        ],
        actions: [
            'review how the portal is configured for API access',
            'update technical settings when integration requirements change',
        ],
        steps: [
            'Inspect the current API-related settings first.',
            'Change only the fields required for the integration update.',
            'Save and validate the integration after the change.',
        ],
        tips: [
            'Technical settings can affect multiple workflows, so verify downstream integrations after edits.',
        ],
    }),
    guide('/portal/settings/audit', {
        title: 'Audit guide',
        overview: 'Use this page to review system audit information and track who changed what inside the portal.',
        pageContains: [
            'audit tables, filters, and history records for system actions',
            'searchable operational logs that help with traceability',
        ],
        actions: [
            'investigate recent changes and who performed them',
            'review activity when troubleshooting an operational or security issue',
        ],
        steps: [
            'Apply the filters or date range needed for the investigation.',
            'Review the audit rows and identify the relevant user, action, and timestamp.',
            'Use the result to support troubleshooting, follow-up, or compliance checks.',
        ],
    }),
    guide('/portal/settings/billing', {
        title: 'Billing settings guide',
        overview: 'Use this page to review and maintain billing-related configuration for the portal.',
        pageContains: [
            'billing settings, finance-related defaults, and operational billing controls',
            'configuration fields that affect financial workflows or subscriptions',
        ],
        actions: [
            'review billing configuration before changing finance-related behaviour',
            'update billing settings that support operational or account-level changes',
        ],
        steps: [
            'Review the current billing settings on the page.',
            'Update the fields that need adjustment.',
            'Save and confirm downstream billing workflows still behave correctly.',
        ],
    }),
    guide('/portal/settings/communications', {
        title: 'Communications settings guide',
        overview: 'Use this page to configure communication defaults and templates that support portal messages.',
        pageContains: [
            'message-related configuration, template controls, and communication defaults',
            'settings that affect how outbound communication is prepared or managed',
        ],
        actions: [
            'review current communication settings and update them when business wording changes',
            'keep outbound communication behaviour aligned with the current process',
        ],
        steps: [
            'Inspect the current communication settings.',
            'Update the template, wording, or behaviour that needs to change.',
            'Save the page and test the related communication flow if possible.',
        ],
    }),
    guide('/portal/settings/communications/history', {
        title: 'Communication history guide',
        overview: 'Use this page to review previously sent communications and track delivery-related activity.',
        pageContains: [
            'communication history tables, filters, and message records',
            'logs that help you confirm what was sent and when',
        ],
        actions: [
            'audit sent communications and investigate delivery questions',
            'look up message history for a student, application, or workflow step',
        ],
        steps: [
            'Apply filters or search to find the communication you need.',
            'Open the relevant history row and review the content, channel, or status details.',
            'Use the result to confirm delivery or decide whether a follow-up is needed.',
        ],
    }),
    guide('/portal/settings/compliance', {
        title: 'Compliance settings guide',
        overview: 'Use this page to monitor and manage compliance-related settings and checks across the portal.',
        pageContains: [
            'compliance shortcuts, monitoring panels, and review tools',
            'navigation into deeper compliance pages such as expired qualification checks',
        ],
        actions: [
            'review compliance status and open the relevant follow-up page',
            'monitor items that may affect course validity or operational risk',
        ],
        steps: [
            'Start with the compliance summary or alerts on this page.',
            'Open the detailed compliance page for the issue you need to review.',
            'Resolve the underlying record or configuration problem and recheck the result.',
        ],
    }),
    guide('/portal/settings/compliance/expired-qualifications', {
        title: 'Expired qualifications guide',
        overview: 'Use this page to identify active applications linked to qualifications that have expired or need review.',
        pageContains: [
            'a focused compliance table for expired or risky qualification links',
            'context about the affected application, qualification, and provider',
        ],
        actions: [
            'find applications that need qualification compliance review',
            'open affected records and coordinate the next corrective action',
        ],
        steps: [
            'Review the list of expired qualification records.',
            'Open the linked application or qualification to confirm the issue.',
            'Coordinate the correction and return to this page to verify the item clears.',
        ],
    }),
    guide('/portal/settings/invoicing', {
        title: 'Invoicing settings guide',
        overview: 'Use this page to review settings that affect invoice generation and invoicing workflows.',
        pageContains: [
            'invoice-related defaults, finance controls, and related settings',
            'configuration that supports how invoices are created or processed',
        ],
        actions: [
            'adjust invoice-related settings when finance processes change',
            'review current invoicing configuration before finance troubleshooting',
        ],
        steps: [
            'Inspect the current invoicing defaults and related controls.',
            'Update the setting that matches the finance change you need.',
            'Save the page and test the related invoice workflow if required.',
        ],
    }),
    guide('/portal/settings/notifications', {
        title: 'Notification settings guide',
        overview: 'Use this page to manage how users receive operational notifications across the portal.',
        pageContains: [
            'notification preferences, delivery settings, and related controls',
            'configuration that shapes alerts, reminders, or internal notices',
        ],
        actions: [
            'review and update how notifications are generated or delivered',
            'fine-tune operational alerts for staff workflows',
        ],
        steps: [
            'Review the current notification settings.',
            'Change the preferences or rules that match your operational goal.',
            'Save and confirm the next alert behaves as expected.',
        ],
    }),
    guide('/portal/settings/pricing', {
        title: 'Pricing settings guide',
        overview: 'Use this page to review or maintain pricing-related values used by the portal.',
        pageContains: [
            'pricing tables, fee-related configuration, and save controls',
            'values that influence calculations used in application or finance workflows',
        ],
        actions: [
            'update pricing information when fees or rates change',
            'review current values before finance or partner adjustments are made',
        ],
        steps: [
            'Review the current pricing entries carefully.',
            'Update the values that need to change.',
            'Save and confirm the dependent workflows use the expected pricing.',
        ],
    }),
    guide('/portal/settings/reminders', {
        title: 'Reminders guide',
        overview: 'Use this page to manage reminder rules and operational follow-up messages.',
        pageContains: [
            'reminder lists, schedules, and reminder configuration controls',
            'tools for reviewing or updating automated follow-up behaviour',
        ],
        actions: [
            'review reminder timing and make operational follow-ups more consistent',
            'update reminder rules when business communication timing changes',
        ],
        steps: [
            'Review the reminder records or schedule settings on the page.',
            'Update the rule or timing that needs to change.',
            'Save the settings and monitor the next reminder cycle.',
        ],
    }),
    guide('/portal/settings/roles', {
        title: 'Roles guide',
        overview: 'Use this page to review how staff roles and capabilities are configured inside the portal.',
        pageContains: [
            'role definitions, capability groupings, and permission-oriented settings',
            'controls that influence what each staff role can access or do',
        ],
        actions: [
            'review current role behaviour before changing staff access',
            'update role configuration to support process or security changes',
        ],
        steps: [
            'Review the current role setup and compare it with the required access model.',
            'Update the relevant role settings or mappings.',
            'Save and then test the affected workflow using an appropriate staff account.',
        ],
    }),
    guide('/portal/settings/sources', {
        title: 'Sources guide',
        overview: 'Use this page to manage lead or application source configuration.',
        pageContains: [
            'source records, source settings, and maintenance controls',
            'configuration that affects how origin or acquisition data is tracked',
        ],
        actions: [
            'review and maintain source options used in application intake',
            'keep reporting and attribution data consistent',
        ],
        steps: [
            'Review the current list of sources.',
            'Add, edit, or retire the source that needs attention.',
            'Save and confirm the updated source appears in intake workflows.',
        ],
    }),
    guide('/portal/settings/staff', {
        title: 'Staff guide',
        overview: 'Use this page to review active staff accounts, roles, and operational access.',
        pageContains: [
            'staff listings, roles, statuses, and links into each staff profile',
            'entry points for creating new staff or editing an existing user account',
        ],
        actions: [
            'find a staff member and review their current account or access setup',
            'open create or detail pages when you need to onboard or maintain staff',
        ],
        steps: [
            'Search or scan the staff list to locate the account you need.',
            'Open the staff detail page to review the record or create a new staff account.',
            'Return here to confirm the list reflects your changes.',
        ],
    }),
    guide('/portal/settings/staff/new', {
        title: 'New staff guide',
        overview: 'Use this page to create a new staff account and assign the correct role.',
        pageContains: [
            'staff identity fields, role selection, account controls, and save actions',
            'setup inputs needed for onboarding a new staff member',
        ],
        actions: [
            'create a staff profile with the correct role and operational access',
            'prepare the new user so they can log in and work in the right part of the portal',
        ],
        steps: [
            'Enter the new staff member name, email, and the correct role.',
            'Review any access, account, or status settings on the page.',
            'Save the account and confirm the new staff member appears in the staff list.',
        ],
    }),
    guide('/portal/settings/staff/[id]', {
        title: 'Staff detail guide',
        overview: 'Use this page to review and maintain an existing staff account.',
        pageContains: [
            'staff profile details, role, account state, and activity-related information',
            'controls for editing the staff record or managing its current status',
        ],
        actions: [
            'change role, status, or account details for an existing staff user',
            'review the user record before operational or access changes are applied',
        ],
        steps: [
            'Review the current staff profile and role information.',
            'Update the fields or status that need to change.',
            'Save the record and verify the staff list reflects the update.',
        ],
    }),
    guide('/portal/settings/staff-activity', {
        title: 'Staff activity guide',
        overview: 'Use this page to review operational activity performed by staff inside the portal.',
        pageContains: [
            'activity history, searchable staff activity records, and audit-style views',
            'filters that help narrow the activity to a user, date, or type of work',
        ],
        actions: [
            'monitor staff activity for oversight or troubleshooting',
            'find out when a user completed a certain type of operational action',
        ],
        steps: [
            'Apply staff or date filters to narrow the activity set.',
            'Review the activity timeline or table for the actions you need.',
            'Use the result to support reporting, coaching, or incident review.',
        ],
    }),
    guide('/portal/settings/students', {
        title: 'Student settings guide',
        overview: 'Use this page for configuration or maintenance related to student management settings.',
        pageContains: [
            'student-related configuration controls and supporting maintenance tools',
            'settings that affect how student information is handled across the portal',
        ],
        actions: [
            'review and update student-related configuration',
            'support operational consistency in student handling workflows',
        ],
        steps: [
            'Review the current settings and identify the change you need.',
            'Update the relevant student-related control or preference.',
            'Save the page and confirm the affected workflow still behaves correctly.',
        ],
    }),
    guide('/portal/settings/templates', {
        title: 'Templates guide',
        overview: 'Use this page to manage reusable templates used across communications or documents.',
        pageContains: [
            'template lists, template editors, and template management actions',
            'settings for maintaining standard wording or output structures',
        ],
        actions: [
            'review existing templates and update wording when needed',
            'keep common communications or document outputs consistent',
        ],
        steps: [
            'Locate the template you want to review or edit.',
            'Update the content or structure carefully.',
            'Save and test the template in the workflow that uses it.',
        ],
    }),
    guide('/portal/settings/trash', {
        title: 'Trash guide',
        overview: 'Use this page to review soft-deleted records and restore them when deletion was a mistake.',
        pageContains: [
            'lists of trashed records grouped by type and restore actions',
            'visibility into who deleted a record and when it was moved to trash',
        ],
        actions: [
            'find deleted records such as applications, partners, or related items',
            'restore a record back into the active workflow when appropriate',
        ],
        steps: [
            'Find the deleted record in the trash list.',
            'Review the delete timestamp and record type to confirm it is the correct item.',
            'Restore the record and then reopen the normal list page to confirm it is active again.',
        ],
        tips: [
            'Trash is for soft-deleted records, so restoration is safer than recreating data manually.',
        ],
    }),
    guide('/portal/settings/workflows', {
        title: 'Workflow settings guide',
        overview: 'Use this page to review or maintain workflow rules and transitions used by application operations.',
        pageContains: [
            'workflow-related controls, stage rules, and process configuration',
            'settings that shape how applications move between stages',
        ],
        actions: [
            'review current workflow setup before process changes are introduced',
            'update workflow configuration that supports a new operational rule',
        ],
        steps: [
            'Inspect the current workflow settings carefully.',
            'Update the rule or stage configuration that needs to change.',
            'Save and then test the affected workflow path with a sample record.',
        ],
    }),
    guide('/portal/settings/xero', {
        title: 'Xero settings guide',
        overview: 'Use this page to manage the shared Xero connection and related finance integration status.',
        pageContains: [
            'Xero connection status, connect or disconnect controls, and finance integration information',
            'visibility into whether the portal can create invoices, bills, or sync payment information',
        ],
        actions: [
            'check whether the portal is connected to Xero',
            'connect, reconnect, or troubleshoot the shared Xero integration if your role allows it',
        ],
        steps: [
            'Start by checking the current Xero connection status card.',
            'If action is required, run the connect or reconnect flow and complete the external authorization step.',
            'Return to an application detail page and verify invoice or bill actions are available again.',
        ],
        tips: [
            'Connection management is more restricted than day-to-day finance actions on application detail pages.',
        ],
    }),
    guide('/portal/profile', {
        title: 'Profile guide',
        overview: 'Use this page to review your own staff profile and personal account information.',
        pageContains: [
            'your core profile information and navigation into related profile sections',
            'self-service account details that apply only to the current signed-in user',
        ],
        actions: [
            'review your current profile information',
            'jump into email, password, or profile-related maintenance pages',
        ],
        steps: [
            'Review the summary profile information on the page.',
            'Open the profile subpage that matches the update you need.',
            'Save your changes and recheck your profile when you finish.',
        ],
    }),
    guide('/portal/profile/emails', {
        title: 'Profile emails guide',
        overview: 'Use this page to review and manage email addresses linked to your own account.',
        pageContains: [
            'email-related account controls and verification or management actions',
            'self-service tools for keeping your contact email current',
        ],
        actions: [
            'review or update the email address tied to your account',
            'confirm the account email setup used for notifications and access',
        ],
        steps: [
            'Review the current email details on the page.',
            'Add or update the email information as required.',
            'Complete any verification step and confirm the new email is active.',
        ],
    }),
    guide('/portal/profile/security', {
        title: 'Profile security guide',
        overview: 'Use this page to manage your own security settings such as password-related actions.',
        pageContains: [
            'password and account security controls for the signed-in user',
            'self-service security actions that help keep the account protected',
        ],
        actions: [
            'update your password or related security settings',
            'review your own account security posture',
        ],
        steps: [
            'Open the security form and review the fields or requirements.',
            'Enter the new security information, such as a password change.',
            'Save the update and confirm you can still access the portal normally.',
        ],
    }),
    guide('/portal/profile/social', {
        title: 'Profile social guide',
        overview: 'Use this page to manage the social or external profile details linked to your own account.',
        pageContains: [
            'self-service profile fields for external or social identity details',
            'save controls for personal profile maintenance',
        ],
        actions: [
            'update optional external or social profile information',
            'keep your own profile details complete and current',
        ],
        steps: [
            'Review the current social profile details.',
            'Update the information that needs to change.',
            'Save the record and confirm the page reflects your latest details.',
        ],
    }),
    guide('/portal/agent', {
        title: 'Agent dashboard guide',
        overview: 'Use the agent dashboard to review your own application activity and jump into the next task quickly.',
        pageContains: [
            'agent summary cards, quick links, and shortcuts into your application work',
            'high-level visibility into the records you have created or need to follow up',
        ],
        actions: [
            'start new applications or review existing ones from a single entry point',
            'monitor your current workload without opening the full application list first',
        ],
        steps: [
            'Use the top-level cards or shortcuts to understand your current activity.',
            'Open the relevant application list or record from the dashboard.',
            'Return here when you want a quick overview of progress again.',
        ],
    }),
    guide('/portal/agent/applications', {
        title: 'Agent applications guide',
        overview: 'Use this page to manage the applications created by you or your organisation.',
        pageContains: [
            'an agent-focused list of your applications with search and filtering tools',
            'links into each application for status review, updates, and document follow-up',
        ],
        actions: [
            'review where each application currently sits in the process',
            'open a record to add updates, track progress, or respond to missing document needs',
        ],
        steps: [
            'Search or filter the list to find the application you want.',
            'Open the application detail page to review status and next actions.',
            'Use the visible edit or support actions if the record needs changes or help.',
        ],
    }),
    guide('/portal/agent/applications/new', {
        title: 'Agent new application guide',
        overview: 'Use this page to submit a new application from the agent side.',
        pageContains: [
            'student intake fields, course information, and application submission controls',
            'validation that helps you catch missing information before saving',
        ],
        actions: [
            'create a new application for a student from the agent workflow',
            'submit the record into the staff review pipeline with the right information',
        ],
        steps: [
            'Enter the student and course details carefully.',
            'Review validation messages and fix missing or duplicate data.',
            'Save the application and confirm it appears in your application list.',
        ],
    }),
    guide('/portal/agent/applications/[id]', {
        title: 'Agent application detail guide',
        overview: 'Use this page to review one of your applications, track its progress, and respond to follow-up needs.',
        pageContains: [
            'application summary details, progress indicators, and supporting information for the selected record',
            'links or actions for editing, support, and document-related follow-up where allowed',
        ],
        actions: [
            'check whether the application is moving through the workflow as expected',
            'open edit or support actions when more information is needed',
        ],
        steps: [
            'Review the application summary and current status.',
            'Check any notes, requests, or document prompts shown on the page.',
            'Use the available next action, such as edit or support, when follow-up is needed.',
        ],
        tips: [
            'Agent-side actions are narrower than staff-side application detail pages.',
        ],
    }),
    guide('/portal/agent/applications/[id]/edit', {
        title: 'Agent edit application guide',
        overview: 'Use this page to correct or complete an application you submitted as an agent.',
        pageContains: [
            'editable application form sections available to the agent workflow',
            'save controls and validation for the agent-side update path',
        ],
        actions: [
            'fix student details, intake data, or other fields that require correction',
            'resubmit a cleaner application record into the staff workflow',
        ],
        steps: [
            'Review the current record before changing it.',
            'Update the necessary fields and check validation warnings.',
            'Save the application and confirm the detail page shows the corrected information.',
        ],
    }),
    guide('/portal/agent/profile', {
        title: 'Agent profile guide',
        overview: 'Use this page to manage your own agent profile details.',
        pageContains: [
            'your own profile information and access to profile maintenance areas',
            'agent-focused self-service account information',
        ],
        actions: [
            'review your own profile information',
            'open related profile or security settings from the agent side',
        ],
        steps: [
            'Review the profile details shown on the page.',
            'Open the related profile section you need to update.',
            'Save any changes and return here to confirm them.',
        ],
    }),
    guide('/portal/agent/profile/security', {
        title: 'Agent security guide',
        overview: 'Use this page to manage your own account security from the agent area.',
        pageContains: [
            'password or security-related controls for your own account',
            'self-service settings that keep your agent login secure',
        ],
        actions: [
            'change your password or review your own security configuration',
            'keep your agent account safe without staff assistance',
        ],
        steps: [
            'Review the security form and requirements.',
            'Enter the updated security information.',
            'Save and confirm you can still access the agent portal as expected.',
        ],
    }),
    guide('/portal/agent/support', {
        title: 'Agent support guide',
        overview: 'Use this page to find help or request support for agent-side work.',
        pageContains: [
            'support-focused content, help guidance, or entry points for requesting assistance',
            'information that helps agents resolve issues with applications or access',
        ],
        actions: [
            'review available help content before raising a support request',
            'follow the support path when you need help with an application or portal issue',
        ],
        steps: [
            'Review the help information on the page first.',
            'Follow the recommended support action for the issue you are facing.',
            'Provide enough context in any request so the support team can respond quickly.',
        ],
    }),
    guide('/frontdesk', {
        title: 'Frontdesk dashboard guide',
        overview: 'Use the frontdesk dashboard to review intake and frontdesk-specific queues quickly.',
        pageContains: [
            'frontdesk summary cards, recent applications, and quick operational shortcuts',
            'a high-level view of intake volume and records that need first-line handling',
        ],
        actions: [
            'review submitted or incoming work before opening the full frontdesk list',
            'jump directly into an application that needs first-line attention',
        ],
        steps: [
            'Start with the dashboard cards to understand what needs attention now.',
            'Open the relevant application list or detail page from a card or recent item.',
            'Return to the dashboard to confirm work has moved forward.',
        ],
    }),
    guide('/frontdesk/applications', {
        title: 'Frontdesk applications guide',
        overview: 'Use this page to manage frontdesk application intake and early-stage follow-up.',
        pageContains: [
            'frontdesk-focused application list views and navigation into each record',
            'tools for reviewing submitted items and moving them into the next operational step',
        ],
        actions: [
            'review intake-stage applications that need frontdesk attention',
            'open an application to complete the next intake or routing task',
        ],
        steps: [
            'Scan the frontdesk queue for the next application to handle.',
            'Open the detail page and review the student and document information.',
            'Complete the next intake action, then move on to the next record in the list.',
        ],
    }),
    guide('/frontdesk/applications/new', {
        title: 'Frontdesk new application guide',
        overview: 'Use this page to create a new application from the frontdesk workflow.',
        pageContains: [
            'intake form fields for student, course, and source details',
            'validation and save controls for frontdesk-led application creation',
        ],
        actions: [
            'create a clean intake record for a new student application',
            'capture the details needed for later staff stages',
        ],
        steps: [
            'Enter the student and intake information carefully.',
            'Review validation messages and correct anything missing.',
            'Save the application and confirm it appears in the frontdesk application list.',
        ],
    }),
    guide('/frontdesk/applications/[id]', {
        title: 'Frontdesk application detail guide',
        overview: 'Use this page to review a single application from the frontdesk perspective and complete intake follow-up actions.',
        pageContains: [
            'application details, intake context, and role-appropriate actions for frontdesk work',
            'document and status information needed before the record moves deeper into the workflow',
        ],
        actions: [
            'confirm the record is complete enough for the next workflow step',
            'review missing information and take the next frontdesk action',
        ],
        steps: [
            'Review the summary and current workflow position.',
            'Check the documents, student details, and any intake warnings.',
            'Complete the next frontdesk task or escalate the record to the next team.',
        ],
    }),
    guide('/frontdesk/applications/[id]/edit', {
        title: 'Frontdesk edit application guide',
        overview: 'Use this page to correct application information from the frontdesk side.',
        pageContains: [
            'editable intake fields and save controls for a frontdesk-managed application',
            'validation that helps avoid incomplete or incorrect updates',
        ],
        actions: [
            'correct intake data before the application moves further into the workflow',
            'make sure downstream staff receive a clean record',
        ],
        steps: [
            'Review the current application values first.',
            'Update the fields that need correction and check validation messages.',
            'Save the record and confirm the frontdesk detail page reflects the change.',
        ],
    }),
];

const SORTED_USER_GUIDE_ENTRIES = [...USER_GUIDE_ENTRIES].sort(
    (left, right) => guideScore(right.pattern) - guideScore(left.pattern)
);

export function shouldHideUserGuide(pathname: string): boolean {
    if (!pathname) {
        return true;
    }

    const hiddenPaths = new Set([
        '/',
        '/login',
        '/signup',
        '/forgot-password',
        '/reset-password',
        '/magic-link',
    ]);

    if (hiddenPaths.has(pathname)) {
        return true;
    }

    return [
        '/api',
        '/auth',
        '/_next',
        '/assessor',
    ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function resolveUserGuide(pathname: string): {
    normalizedPath: string;
    matchedPattern: string;
    guide: UserGuideContent;
} {
    const normalizedPath = normalizeGuidePath(pathname);
    const matchedEntry = SORTED_USER_GUIDE_ENTRIES.find((entry) => matchesGuidePattern(normalizedPath, entry.pattern));

    if (matchedEntry) {
        return {
            normalizedPath,
            matchedPattern: matchedEntry.pattern,
            guide: matchedEntry.guide,
        };
    }

    return {
        normalizedPath,
        matchedPattern: normalizedPath,
        guide: {
            title: fallbackTitleFromPath(normalizedPath),
            overview: 'This guide gives you a quick orientation for the current page even when a fully tailored tutorial has not been written yet.',
            pageContains: [
                'page-specific information, actions, and navigation relevant to the current workflow',
                'the controls needed to review, create, edit, or monitor records from this screen',
            ],
            actions: [
                'review the page content and identify the next action you need to complete',
                'use the visible forms, tables, buttons, or tabs to continue the workflow safely',
            ],
            steps: [
                'Read the page title, filters, or summary cards to understand what this screen is for.',
                'Review the visible actions, forms, or records before making changes.',
                'Save, update, or open the next linked page once you are confident about the task.',
            ],
            tips: [
                'If this page behaves differently by role, follow the controls visible to your current access level.',
            ],
        },
    };
}

export function getUserGuideCoverageCount(): number {
    return USER_GUIDE_ENTRIES.length;
}
