import { cookies } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import { hasSupabaseAuthCookies } from '@/lib/supabase/auth-cookies';
import { createServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigurationError } from '@/lib/supabase/config-error';

// Force dynamic rendering to prevent build-time prerendering
export const dynamic = 'force-dynamic';

export default async function Home() {
  try {
    const cookieStore = await cookies();

    if (!hasSupabaseAuthCookies(cookieStore.getAll())) {
      redirect('/login');
    }

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

    if (role === 'agent') {
      redirect('/portal/agent');
    }

    if (role === 'assessor') {
      redirect('/portal/assessor');
    }

    if (role === 'accounts_manager') {
      redirect('/portal/accounts_manager');
    }

    if (role === 'frontdesk') {
      redirect('/frontdesk');
    }

    if (role === 'admin') {
      redirect('/portal/admin');
    }

    if (role === 'executive_manager') {
      redirect('/portal/executive_manager');
    }

    redirect('/portal');
  } catch (error) {
    unstable_rethrow(error);

    if (isSupabaseConfigurationError(error)) {
      redirect('/login?error=service_configuration_error');
    }

    throw error;
  }
}
