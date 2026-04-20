import { forbidden, redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import SettingsLayoutShell from './SettingsLayoutShell';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createServerClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const { data: profileWithStatus, error: profileWithStatusError } = await supabase
        .from('profiles')
        .select('role, account_status')
        .eq('id', user.id)
        .single();

    const profileResult = profileWithStatusError && profileWithStatusError.message?.includes('account_status')
        ? await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
        : { data: profileWithStatus, error: profileWithStatusError };

    const role = profileResult.data?.role;
    const accountStatus = profileWithStatusError && profileWithStatusError.message?.includes('account_status')
        ? 'active'
        : (profileWithStatus?.account_status || 'active');

    if (accountStatus === 'disabled') {
        redirect('/login?reason=disabled');
    }

    if (role !== 'ceo' && role !== 'developer') {
        forbidden();
    }

    return <SettingsLayoutShell>{children}</SettingsLayoutShell>;
}
