/**
 * Bill Service
 * Handles bill management for payments TO sources/RTOs
 */

import { createClient } from '@/lib/supabase/client';
import { ACTIVE_RECORD_FILTER } from '@/lib/soft-delete';
import type { Bill, BillStatus, BillLineItem, BulkOperation } from '@/types/database';

export interface BillData {
    rtoId: string;
    applicationId?: string;
    rtoInvoiceNumber?: string;
    description?: string;
    tuitionCost: number;
    materialCost: number;
    otherCosts?: number;
    dueDate?: string;
    notes?: string;
    autoSyncXero?: boolean;
}

export interface BulkBillData {
    applicationIds: string[];
    rtoId: string;
    autoSyncXero?: boolean;
}

async function isXeroConnected(): Promise<boolean> {
    try {
        const response = await fetch('/api/xero/status');
        if (!response.ok) return false;
        const data = await response.json();
        return Boolean(data?.connected);
    } catch {
        return false;
    }
}

async function trySyncBillToXero(billId: string): Promise<void> {
    try {
        await fetch('/api/xero/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync_bill', billId }),
        });
    } catch (error) {
        console.warn('Auto-sync bill to Xero failed:', error);
    }
}

/**
 * Create a single bill
 */
export async function createBill(data: BillData): Promise<Bill | null> {
    const supabase = createClient();

    const totalAmount =
        (data.tuitionCost || 0) +
        (data.materialCost || 0) +
        (data.otherCosts || 0);

    const { data: bill, error } = await supabase
        .from('bills')
        .insert({
            rto_id: data.rtoId,
            application_id: data.applicationId || null,
            rto_invoice_number: data.rtoInvoiceNumber || null,
            description: data.description || null,
            tuition_cost: data.tuitionCost || 0,
            material_cost: data.materialCost || 0,
            other_costs: data.otherCosts || 0,
            total_amount: totalAmount,
            due_date: data.dueDate || null,
            notes: data.notes || null,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating bill:', error);
        return null;
    }

    if (data.autoSyncXero) {
        const connected = await isXeroConnected();
        if (connected && bill?.id) {
            await trySyncBillToXero(bill.id);
        }
    }

    return bill;
}

/**
 * Create bulk bills for multiple applications
 */
export async function createBulkBills(
    data: BulkBillData
): Promise<{ success: boolean; operation?: BulkOperation; error?: string }> {
    const supabase = createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { success: false, error: 'Not authenticated' };
    }

    // Create bulk operation record
    const { data: operation, error: opError } = await supabase
        .from('bulk_operations')
        .insert({
            type: 'bill',
            status: 'processing',
            total_items: data.applicationIds.length,
            created_by: user.id,
        })
        .select()
        .single();

    if (opError) {
        return { success: false, error: 'Failed to create bulk operation' };
    }

    // Fetch applications with their offerings
    const { data: applications, error: appError } = await supabase
        .from('applications')
        .select(`
            id,
            student_first_name,
            student_last_name,
            quoted_tuition,
            quoted_materials,
            offering:rto_offerings(
                tuition_fee_onshore,
                material_fee,
                rto:rtos(id, name)
            )
        `)
        .or(ACTIVE_RECORD_FILTER)
        .in('id', data.applicationIds);

    if (appError || !applications) {
        await supabase
            .from('bulk_operations')
            .update({ status: 'failed' })
            .eq('id', operation.id);
        return { success: false, error: 'Failed to fetch applications' };
    }

    let processed = 0;
    let failed = 0;
    const errorLog: Array<{ item_id: string; error: string }> = [];
    const createdBillIds: string[] = [];

    // Create bills for each application
    for (const app of applications) {
        try {
            // Handle Supabase nested relation (returns array for one-to-one)
            const offeringData = app.offering as unknown;
            const offering = Array.isArray(offeringData) ? offeringData[0] : offeringData;
            const rtoData = offering?.rto as unknown;
            const rto = Array.isArray(rtoData) ? rtoData[0] : rtoData;
            const rtoId = data.rtoId || rto?.id;

            if (!rtoId) {
                failed++;
                errorLog.push({ item_id: app.id, error: 'No RTO found' });
                continue;
            }

            const tuitionCost = app.quoted_tuition || (offering as { tuition_fee_onshore?: number })?.tuition_fee_onshore || 0;
            const materialCost = app.quoted_materials || (offering as { material_fee?: number })?.material_fee || 0;

            const { data: createdBill, error } = await supabase
                .from('bills')
                .insert({
                    rto_id: rtoId,
                    application_id: app.id,
                    description: `Bill for ${app.student_first_name} ${app.student_last_name}`,
                    tuition_cost: tuitionCost,
                    material_cost: materialCost,
                    other_costs: 0,
                    total_amount: tuitionCost + materialCost,
                })
                .select('id')
                .single();

            if (error) {
                failed++;
                errorLog.push({ item_id: app.id, error: error.message });
            } else {
                processed++;
                if (createdBill?.id) createdBillIds.push(createdBill.id);
            }
        } catch (err) {
            failed++;
            errorLog.push({ item_id: app.id, error: 'Unknown error' });
        }
    }

    if (data.autoSyncXero) {
        const connected = await isXeroConnected();
        if (connected) {
            for (const billId of createdBillIds) {
                await trySyncBillToXero(billId);
            }
        }
    }

    // Update operation status
    await supabase
        .from('bulk_operations')
        .update({
            status: failed === data.applicationIds.length ? 'failed' : 'completed',
            processed_items: processed,
            failed_items: failed,
            error_log: errorLog,
            completed_at: new Date().toISOString(),
        })
        .eq('id', operation.id);

    return {
        success: true,
        operation: {
            ...operation,
            processed_items: processed,
            failed_items: failed,
            status: failed === data.applicationIds.length ? 'failed' : 'completed',
        } as BulkOperation,
    };
}

/**
 * Create bulk bills from application IDs only (auto-detects RTOs)
 */
export async function createBulkBillsFromApps(
    applicationIds: string[],
    options: { autoSyncXero?: boolean } = {}
): Promise<{ success: boolean; operation?: BulkOperation; error?: string }> {
    // Pass empty rtoId - function will auto-detect from each application's offering
    return createBulkBills({ applicationIds, rtoId: '', autoSyncXero: options.autoSyncXero });
}

/**
 * Update bill status
 */
export async function updateBillStatus(
    id: string,
    status: BillStatus,
    paymentInfo?: { reference?: string; method?: string }
): Promise<boolean> {
    const supabase = createClient();

    const updateData: Record<string, unknown> = { status };

    if (status === 'paid') {
        updateData.paid_at = new Date().toISOString();
        if (paymentInfo?.reference) updateData.payment_reference = paymentInfo.reference;
        if (paymentInfo?.method) updateData.payment_method = paymentInfo.method;
    }

    const { error } = await supabase
        .from('bills')
        .update(updateData)
        .eq('id', id);

    return !error;
}

/**
 * Get bills by RTO
 */
export async function getBillsByRto(rtoId: string): Promise<Bill[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('bills')
        .select('*, rto:rtos(*), application:applications(*)')
        .eq('rto_id', rtoId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching bills:', error);
        return [];
    }

    return data || [];
}

/**
 * Get all bills with filters
 */
export async function getBills(filters?: {
    status?: BillStatus;
    rtoId?: string;
    fromDate?: string;
    toDate?: string;
}): Promise<Bill[]> {
    const supabase = createClient();

    let query = supabase
        .from('bills')
        .select('*, rto:rtos(id, name, code), application:applications(id, application_number, student_first_name, student_last_name, student_uid)')
        .eq('is_deleted', false);

    if (filters?.status) {
        query = query.eq('status', filters.status);
    }
    if (filters?.rtoId) {
        query = query.eq('rto_id', filters.rtoId);
    }
    if (filters?.fromDate) {
        query = query.gte('created_at', filters.fromDate);
    }
    if (filters?.toDate) {
        query = query.lte('created_at', filters.toDate);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching bills:', error);
        return [];
    }

    return data || [];
}

/**
 * Get bill by ID
 */
export async function getBillById(id: string): Promise<Bill | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('bills')
        .select('*, rto:rtos(*), application:applications(*)')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching bill:', error);
        return null;
    }

    return data;
}

/**
 * Delete bill (soft delete)
 */
export async function deleteBill(id: string): Promise<boolean> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from('bills')
        .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: user?.id || null,
        })
        .eq('id', id);

    return !error;
}

/**
 * Get bill summary by RTO
 */
export async function getBillSummaryByRto(): Promise<
    Array<{ rto_id: string; rto_name: string; total_pending: number; total_paid: number; count: number }>
> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('bills')
        .select('rto_id, status, total_amount, rto:rtos(name)')
        .eq('is_deleted', false);

    if (error || !data) {
        console.error('Error fetching bill summary:', error);
        return [];
    }

    // Group by RTO
    const summary = new Map<string, { rto_name: string; total_pending: number; total_paid: number; count: number }>();

    for (const bill of data) {
        const rtoId = bill.rto_id || 'unknown';
        // Handle Supabase nested relation (may return array)
        const rtoData = bill.rto as unknown;
        const rto = Array.isArray(rtoData) ? rtoData[0] : rtoData;
        const rtoName = (rto as { name?: string })?.name || 'Unknown RTO';

        if (!summary.has(rtoId)) {
            summary.set(rtoId, { rto_name: rtoName, total_pending: 0, total_paid: 0, count: 0 });
        }

        const entry = summary.get(rtoId)!;
        entry.count++;

        if (bill.status === 'paid') {
            entry.total_paid += bill.total_amount || 0;
        } else if (bill.status !== 'cancelled') {
            entry.total_pending += bill.total_amount || 0;
        }
    }

    return Array.from(summary.entries()).map(([rto_id, data]) => ({
        rto_id,
        ...data,
    }));
}
