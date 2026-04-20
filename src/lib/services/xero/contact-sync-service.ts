import { createAdminServerClient } from '@/lib/supabase/server';
import { createContact } from '@/lib/services/xero/xero-client';
import { getXeroEntityId, upsertXeroEntityMapping, type XeroEntityType } from '@/lib/services/xero/entity-map-service';

export interface XeroContactSyncInput {
    entityType: Extract<XeroEntityType, 'partner' | 'rto' | 'application_applicant'>;
    lumiereId: string;
    name: string;
    email?: string | null;
    phone?: string | null;
}

export async function getOrCreateXeroContact(input: XeroContactSyncInput): Promise<string | null> {
    const adminSupabase = createAdminServerClient();
    const existingId = await getXeroEntityId(input.entityType, input.lumiereId, adminSupabase);
    if (existingId) {
        return existingId;
    }

    const result = await createContact({
        contact: {
            Name: input.name,
            EmailAddress: input.email || undefined,
            Phones: input.phone ? [{ PhoneType: 'DEFAULT', PhoneNumber: input.phone }] : [],
            IsSupplier: input.entityType === 'rto',
            IsCustomer: input.entityType === 'partner' || input.entityType === 'application_applicant',
        },
        supabase: adminSupabase,
    });

    if (!result.success) {
        return null;
    }

    const contact = result.data.Contacts?.[0] as { ContactID?: string } | undefined;
    const contactId = contact?.ContactID;
    if (!contactId) {
        return null;
    }

    const xeroUrl = `https://go.xero.com/Contacts/View/${contactId}`;

    await upsertXeroEntityMapping({
        entityType: input.entityType,
        lumiereId: input.lumiereId,
        xeroId: contactId,
        xeroUrl,
        supabase: adminSupabase,
    });

    if (input.entityType === 'partner' || input.entityType === 'rto') {
        const table = input.entityType === 'partner' ? 'partners' : 'rtos';
        await adminSupabase
            .from(table)
            .update({
                xero_contact_id: contactId,
                xero_contact_url: xeroUrl,
            })
            .eq('id', input.lumiereId);
    }

    return contactId;
}

export async function syncEntityContactToXero(input: XeroContactSyncInput): Promise<{ success: boolean; contactId?: string; error?: string }> {
    try {
        const contactId = await getOrCreateXeroContact(input);
        if (!contactId) {
            return { success: false, error: 'Failed to sync contact to Xero' };
        }

        return { success: true, contactId };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to sync contact to Xero',
        };
    }
}
