'use server';

import { createServerClient } from '@/lib/supabase/server';

// Types
export interface StudentMaster {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    passport_number: string | null;
    nationality: string | null;
    dob: string | null;
    address: string | null;
    usi: string | null;
    visa_number: string | null;
    visa_expiry: string | null;
    gender: string | null;
    country_of_birth: string | null;
    street_no: string | null;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
    is_deleted: boolean;
    created_at: string;
    updated_at: string;
    application_count?: number;
}

export interface DuplicateGroup {
    key: string;
    reason: string;
    students: StudentMaster[];
}

// Get all students with application counts
export async function getStudents(search?: string, limit: number = 100): Promise<{ data: StudentMaster[] | null; error: string | null }> {
    const supabase = await createServerClient();

    let query = supabase
        .from('student_master')
        .select('*')
        .eq('is_deleted', false)
        .order('last_name')
        .order('first_name')
        .limit(limit);

    if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,passport_number.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching students:', error);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Get single student with applications
export async function getStudent(id: string): Promise<{ data: StudentMaster | null; error: string | null }> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from('student_master')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Find potential duplicates
export async function findDuplicates(): Promise<{ data: DuplicateGroup[] | null; error: string | null }> {
    const supabase = await createServerClient();

    const { data: students, error } = await supabase
        .from('student_master')
        .select('*')
        .eq('is_deleted', false);

    if (error) {
        return { data: null, error: error.message };
    }

    if (!students || students.length === 0) {
        return { data: [], error: null };
    }

    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    // Group by email
    const byEmail: Record<string, StudentMaster[]> = {};
    for (const student of students) {
        if (student.email) {
            const key = student.email.toLowerCase();
            if (!byEmail[key]) byEmail[key] = [];
            byEmail[key].push(student);
        }
    }

    for (const [email, group] of Object.entries(byEmail)) {
        if (group.length > 1) {
            groups.push({
                key: `email:${email}`,
                reason: `Same email: ${email}`,
                students: group,
            });
            group.forEach(s => processed.add(s.id));
        }
    }

    // Group by passport number
    const byPassport: Record<string, StudentMaster[]> = {};
    for (const student of students) {
        if (student.passport_number && !processed.has(student.id)) {
            const key = student.passport_number.toUpperCase().replace(/\s/g, '');
            if (!byPassport[key]) byPassport[key] = [];
            byPassport[key].push(student);
        }
    }

    for (const [passport, group] of Object.entries(byPassport)) {
        if (group.length > 1) {
            groups.push({
                key: `passport:${passport}`,
                reason: `Same passport: ${passport}`,
                students: group,
            });
            group.forEach(s => processed.add(s.id));
        }
    }

    // Group by name + DOB
    const byNameDob: Record<string, StudentMaster[]> = {};
    for (const student of students) {
        if (!processed.has(student.id) && student.dob) {
            const key = `${student.first_name.toLowerCase()}_${student.last_name.toLowerCase()}_${student.dob}`;
            if (!byNameDob[key]) byNameDob[key] = [];
            byNameDob[key].push(student);
        }
    }

    for (const [key, group] of Object.entries(byNameDob)) {
        if (group.length > 1) {
            groups.push({
                key: `namedob:${key}`,
                reason: `Same name and DOB`,
                students: group,
            });
        }
    }

    return { data: groups, error: null };
}

// Merge students - keep one, update applications to point to it, soft-delete others
export async function mergeStudents(keepId: string, mergeIds: string[]): Promise<{ error: string | null }> {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Update applications to point to keep record
    for (const mergeId of mergeIds) {
        const { error: updateError } = await supabase
            .from('applications')
            .update({ student_master_id: keepId })
            .eq('student_master_id', mergeId);

        if (updateError) {
            return { error: `Failed to update applications: ${updateError.message}` };
        }

        // Soft delete the merged record
        const { error: deleteError } = await supabase
            .from('student_master')
            .update({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                deleted_by: user?.id || null,
            })
            .eq('id', mergeId);

        if (deleteError) {
            return { error: `Failed to delete merged student: ${deleteError.message}` };
        }
    }

    return { error: null };
}

// Get applications for a student
export async function getStudentApplications(studentId: string): Promise<{
    data: { id: string; workflow_stage: string; created_at: string; qualification_name: string | null }[] | null;
    error: string | null
}> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from('applications')
        .select('id, workflow_stage, created_at, qualification_name')
        .eq('student_master_id', studentId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

// Update student master record
export async function updateStudent(id: string, updates: Partial<StudentMaster>): Promise<{ data: StudentMaster | null; error: string | null }> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
        .from('student_master')
        .update({
            ...updates,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
}
