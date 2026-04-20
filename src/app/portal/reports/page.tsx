import { createServerClient } from '@/lib/supabase/server';
import { ACTIVE_RECORD_FILTER } from '@/lib/soft-delete';
import { ReportsClientPage } from './ReportsClient';

async function fetchReportData(from?: string, to?: string) {
    const supabase = await createServerClient();

    // Build date filter
    let query = supabase
        .from('applications')
        .select(`
      id,
      created_at,
      workflow_stage,
      partner_id,
      partner:partners(company_name),
      offering:rto_offerings(
        tuition_fee_onshore,
        qualification:qualifications(name),
        rto:rtos(name)
      )
    `)
        .or(ACTIVE_RECORD_FILTER);

    if (from) {
        query = query.gte('created_at', from);
    }
    if (to) {
        query = query.lte('created_at', to);
    }

    const { data: applications, error } = await query;

    if (error) {
        console.error('Error fetching applications:', error.code, error.message, error.details);
        return [];
    }

    return applications || [];
}

export default async function ReportsPage({
    searchParams,
}: {
    searchParams: Promise<{ from?: string; to?: string }>;
}) {
    const params = await searchParams;
    const applications = await fetchReportData(params.from, params.to);

    return (
        <ReportsClientPage
            applications={applications as any}
            initialFrom={params.from}
            initialTo={params.to}
        />
    );
}
