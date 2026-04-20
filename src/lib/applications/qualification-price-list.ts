import { createAdminServerClient } from '@/lib/supabase/server';

type AdminSupabaseClient = ReturnType<typeof createAdminServerClient>;

export type QualificationPriceListAssignment = {
    id: string;
    qualification_id: string;
    rto_id: string | null;
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
    is_active: boolean;
    is_deleted?: boolean | null;
    is_archived?: boolean | null;
};

const QUALIFICATION_PRICE_LIST_SELECT = `
    id,
    qualification_id,
    rto_id,
    tuition_fee_onshore,
    tuition_fee_miscellaneous,
    material_fee,
    application_fee,
    assessor_fee,
    provider_fee,
    agent_fee,
    student_fee,
    enrollment_fee,
    misc_fee,
    is_active,
    is_deleted,
    is_archived
`;

export async function ensureQualificationPriceListForQualification(
    supabase: AdminSupabaseClient,
    qualificationId: string
): Promise<QualificationPriceListAssignment> {
    const { data: existingOffering, error: existingError } = await supabase
        .from('rto_offerings')
        .select(QUALIFICATION_PRICE_LIST_SELECT)
        .eq('qualification_id', qualificationId)
        .order('is_active', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle<QualificationPriceListAssignment>();

    if (existingError) {
        throw new Error(existingError.message || 'Unable to load the qualification price list.');
    }

    if (existingOffering) {
        if (existingOffering.is_active && !existingOffering.is_deleted && !existingOffering.is_archived) {
            return existingOffering;
        }

        const { data: restoredOffering, error: restoreError } = await supabase
            .from('rto_offerings')
            .update({
                rto_id: null,
                is_active: true,
                is_deleted: false,
                deleted_at: null,
                deleted_by: null,
                is_archived: false,
                archived_at: null,
                archived_by: null,
            })
            .eq('id', existingOffering.id)
            .select(QUALIFICATION_PRICE_LIST_SELECT)
            .single<QualificationPriceListAssignment>();

        if (restoreError || !restoredOffering) {
            throw new Error(restoreError?.message || 'Unable to restore the qualification price list.');
        }

        return restoredOffering;
    }

    const { data: createdOffering, error: createError } = await supabase
        .from('rto_offerings')
        .insert({
            qualification_id: qualificationId,
            rto_id: null,
            is_active: true,
            approval_status: 'published',
            effective_date: new Date().toISOString().split('T')[0],
        })
        .select(QUALIFICATION_PRICE_LIST_SELECT)
        .single<QualificationPriceListAssignment>();

    if (createError || !createdOffering) {
        throw new Error(createError?.message || 'Unable to create the qualification price list.');
    }

    return createdOffering;
}
