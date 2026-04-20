import type { ApprovalStatus, RtoOffering } from '@/types/database';

export interface QualificationOfferingFormRow {
    clientId: string;
    id?: string;
    tuition_fee_onshore: string;
    tuition_fee_miscellaneous: string;
    material_fee: string;
    application_fee: string;
    assessor_fee: string;
    provider_fee: string;
    agent_fee: string;
    student_fee: string;
    enrollment_fee: string;
    misc_fee: string;
    effective_date: string;
    approval_status?: ApprovalStatus;
    version?: number;
}

export interface QualificationOfferingSavePayload {
    tuition_fee_onshore: number | null;
    tuition_fee_miscellaneous: number | null;
    material_fee: number | null;
    application_fee: number | null;
    assessor_fee: number | null;
    provider_fee: number | null;
    agent_fee: number | null;
    student_fee: number | null;
    enrollment_fee: number | null;
    misc_fee: number | null;
    effective_date: string;
}

export type QualificationOfferingWithRto = Pick<
    RtoOffering,
    | 'id'
    | 'tuition_fee_onshore'
    | 'tuition_fee_miscellaneous'
    | 'material_fee'
    | 'application_fee'
    | 'assessor_fee'
    | 'provider_fee'
    | 'agent_fee'
    | 'student_fee'
    | 'enrollment_fee'
    | 'misc_fee'
    | 'effective_date'
    | 'version'
    | 'approval_status'
>;

export const PRICE_LIST_FEE_FIELDS = [
    'assessor_fee',
    'provider_fee',
    'agent_fee',
    'student_fee',
    'enrollment_fee',
    'material_fee',
    'application_fee',
    'misc_fee',
    'tuition_fee_onshore',
    'tuition_fee_miscellaneous',
] as const;

export type PriceListFeeField = (typeof PRICE_LIST_FEE_FIELDS)[number];

function createClientId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `offering-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatNumberInput(value: number | null | undefined): string {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value);
}

function parseNumberInput(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const parsed = Number.parseFloat(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
}

export function createEmptyQualificationOfferingRow(): QualificationOfferingFormRow {
    return {
        clientId: createClientId(),
        tuition_fee_onshore: '',
        tuition_fee_miscellaneous: '',
        material_fee: '',
        application_fee: '',
        assessor_fee: '',
        provider_fee: '',
        agent_fee: '',
        student_fee: '',
        enrollment_fee: '',
        misc_fee: '',
        effective_date: new Date().toISOString().split('T')[0],
    };
}

export function mapOfferingToFormRow(offering: QualificationOfferingWithRto): QualificationOfferingFormRow {
    return {
        clientId: offering.id,
        id: offering.id,
        tuition_fee_onshore: formatNumberInput(offering.tuition_fee_onshore),
        tuition_fee_miscellaneous: formatNumberInput(offering.tuition_fee_miscellaneous),
        material_fee: formatNumberInput(offering.material_fee),
        application_fee: formatNumberInput(offering.application_fee),
        assessor_fee: formatNumberInput(offering.assessor_fee),
        provider_fee: formatNumberInput(offering.provider_fee),
        agent_fee: formatNumberInput(offering.agent_fee),
        student_fee: formatNumberInput(offering.student_fee),
        enrollment_fee: formatNumberInput(offering.enrollment_fee),
        misc_fee: formatNumberInput(offering.misc_fee),
        effective_date: offering.effective_date || new Date().toISOString().split('T')[0],
        approval_status: offering.approval_status,
        version: offering.version,
    };
}

export function isOfferingRowEmpty(row: QualificationOfferingFormRow): boolean {
    return PRICE_LIST_FEE_FIELDS.every((field) => row[field].trim() === '');
}

export function validateOfferingRows(rows: QualificationOfferingFormRow[]): string | null {
    const nonEmptyRows = rows.filter((row) => !isOfferingRowEmpty(row));
    if (nonEmptyRows.length > 1) {
        return 'Each qualification can only have one active price list.';
    }

    return null;
}

export function buildOfferingSavePayload(row: QualificationOfferingFormRow): QualificationOfferingSavePayload {
    return {
        tuition_fee_onshore: parseNumberInput(row.tuition_fee_onshore),
        tuition_fee_miscellaneous: parseNumberInput(row.tuition_fee_miscellaneous),
        material_fee: parseNumberInput(row.material_fee),
        application_fee: parseNumberInput(row.application_fee),
        assessor_fee: parseNumberInput(row.assessor_fee),
        provider_fee: parseNumberInput(row.provider_fee),
        agent_fee: parseNumberInput(row.agent_fee),
        student_fee: parseNumberInput(row.student_fee),
        enrollment_fee: parseNumberInput(row.enrollment_fee),
        misc_fee: parseNumberInput(row.misc_fee),
        effective_date: row.effective_date || new Date().toISOString().split('T')[0],
    };
}

export function calculateOfferingTotals(row: QualificationOfferingFormRow): {
    onshore: number;
    miscellaneous: number;
} {
    const applicationFee = parseNumberInput(row.application_fee) || 0;
    const sharedTotal = (
        (parseNumberInput(row.assessor_fee) || 0)
        + (parseNumberInput(row.provider_fee) || 0)
        + (parseNumberInput(row.agent_fee) || 0)
        + (parseNumberInput(row.student_fee) || 0)
        + (parseNumberInput(row.enrollment_fee) || 0)
        + (parseNumberInput(row.material_fee) || 0)
        + applicationFee
        + (parseNumberInput(row.misc_fee) || 0)
    );

    return {
        onshore: sharedTotal + (parseNumberInput(row.tuition_fee_onshore) || 0),
        miscellaneous: sharedTotal + (parseNumberInput(row.tuition_fee_miscellaneous) || 0),
    };
}

export function hasOfferingPricingChanges(
    current: QualificationOfferingWithRto,
    nextRow: QualificationOfferingFormRow
): boolean {
    const nextPayload = buildOfferingSavePayload(nextRow);

    return current.tuition_fee_onshore !== nextPayload.tuition_fee_onshore
        || current.tuition_fee_miscellaneous !== nextPayload.tuition_fee_miscellaneous
        || current.material_fee !== nextPayload.material_fee
        || current.application_fee !== nextPayload.application_fee
        || current.assessor_fee !== nextPayload.assessor_fee
        || current.provider_fee !== nextPayload.provider_fee
        || current.agent_fee !== nextPayload.agent_fee
        || current.student_fee !== nextPayload.student_fee
        || current.enrollment_fee !== nextPayload.enrollment_fee
        || current.misc_fee !== nextPayload.misc_fee
        || current.effective_date !== nextPayload.effective_date;
}
