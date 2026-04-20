'use server';

import { createServerClient } from '@/lib/supabase/server';

// Types
export interface AssessorQualification {
    id: string;
    assessor_id: string;
    qualification_id: string;
    created_at: string;
    qualification?: {
        id: string;
        code: string;
        name: string;
        level: string | null;
    } | null;
    assessor?: {
        id: string;
        full_name: string;
        email: string;
    } | null;
}

// Get qualifications for an assessor
export async function getAssessorQualifications(assessorId: string): Promise<{ data: AssessorQualification[] | null; error: string | null }> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from('assessor_qualifications')
        .select(`
            *,
            qualification:qualifications(id, code, name, level)
        `)
        .eq('assessor_id', assessorId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching assessor qualifications:', error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Get all assessors for a qualification
export async function getQualificationAssessors(qualificationId: string): Promise<{ data: AssessorQualification[] | null; error: string | null }> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from('assessor_qualifications')
        .select(`
            *,
            assessor:profiles(id, full_name, email)
        `)
        .eq('qualification_id', qualificationId);

    if (error) {
        console.error('Error fetching qualification assessors:', error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Add qualification to assessor
export async function addAssessorQualification(assessorId: string, qualificationId: string): Promise<{ data: AssessorQualification | null; error: string | null }> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from('assessor_qualifications')
        .insert({
            assessor_id: assessorId,
            qualification_id: qualificationId,
        })
        .select(`
            *,
            qualification:qualifications(id, code, name, level)
        `)
        .single();

    if (error) {
        // Handle unique constraint violation
        if (error.code === '23505') {
            return { data: null, error: 'This qualification is already assigned to the assessor' };
        }
        console.error('Error adding assessor qualification:', error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Remove qualification from assessor
export async function removeAssessorQualification(assessorId: string, qualificationId: string): Promise<{ error: string | null }> {
    const supabase = await createServerClient();

    const { error } = await supabase
        .from('assessor_qualifications')
        .delete()
        .eq('assessor_id', assessorId)
        .eq('qualification_id', qualificationId);

    if (error) {
        console.error('Error removing assessor qualification:', error);
        return { error: error.message };
    }

    return { error: null };
}

// Get available qualifications (not yet assigned to assessor)
export async function getAvailableQualifications(assessorId: string): Promise<{ data: { id: string; code: string; name: string }[] | null; error: string | null }> {
    const supabase = await createServerClient();

    // Get currently assigned qualification IDs
    const { data: assigned, error: assignedError } = await supabase
        .from('assessor_qualifications')
        .select('qualification_id')
        .eq('assessor_id', assessorId);

    if (assignedError) {
        return { data: null, error: assignedError.message };
    }

    const assignedIds = assigned?.map(a => a.qualification_id) || [];

    // Get all qualifications not in assigned
    let query = supabase
        .from('qualifications')
        .select('id, code, name')
        .order('code');

    if (assignedIds.length > 0) {
        query = query.not('id', 'in', `(${assignedIds.join(',')})`);
    }

    const { data, error } = await query;

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Bulk assign qualifications to assessor
export async function bulkAssignQualifications(assessorId: string, qualificationIds: string[]): Promise<{ added: number; errors: string[] }> {
    const result = { added: 0, errors: [] as string[] };

    for (const qualificationId of qualificationIds) {
        const { error } = await addAssessorQualification(assessorId, qualificationId);
        if (error) {
            result.errors.push(error);
        } else {
            result.added++;
        }
    }

    return result;
}
