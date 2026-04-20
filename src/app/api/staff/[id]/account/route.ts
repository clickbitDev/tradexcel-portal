import { NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { authorizeApiRequest } from '@/lib/access-control/server';
import type { AccountStatus, UserRole } from '@/types/database';

const VALID_ACCOUNT_STATUSES = new Set<AccountStatus>(['active', 'disabled']);
const DISABLE_BAN_DURATION = '876000h';

type StaffAccountPayload = {
    password?: string;
    confirmPassword?: string;
    account_status?: AccountStatus;
};

function validatePassword(password: string): string | null {
    if (password.length < 8) {
        return 'Password must be at least 8 characters long';
    }

    if (!/[A-Z]/.test(password)) {
        return 'Password must include at least one uppercase letter';
    }

    if (!/[a-z]/.test(password)) {
        return 'Password must include at least one lowercase letter';
    }

    if (!/[0-9]/.test(password)) {
        return 'Password must include at least one number';
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        return 'Password must include at least one special character';
    }

    return null;
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authz = await authorizeApiRequest({
            request,
            resource: 'staff_account',
            action: 'manage_users',
            compatibilityPermissionKey: 'staff.manage',
        });
        if (!authz.ok) {
            return authz.response;
        }

        const { id: staffId } = await params;
        const body = (await request.json()) as StaffAccountPayload;
        const accountStatus = body.account_status;
        const password = body.password?.trim() || '';
        const confirmPassword = body.confirmPassword?.trim() || '';

        const wantsPasswordChange = password.length > 0 || confirmPassword.length > 0;
        const wantsStatusChange = typeof accountStatus === 'string';

        if (!wantsPasswordChange && !wantsStatusChange) {
            return NextResponse.json(
                { error: 'No account updates were provided' },
                { status: 400 }
            );
        }

        if (wantsStatusChange && !VALID_ACCOUNT_STATUSES.has(accountStatus as AccountStatus)) {
            return NextResponse.json({ error: 'Invalid account status' }, { status: 400 });
        }

        if (wantsPasswordChange) {
            if (!password || !confirmPassword) {
                return NextResponse.json(
                    { error: 'Password and confirm password are required together' },
                    { status: 400 }
                );
            }

            if (password !== confirmPassword) {
                return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
            }

            const passwordError = validatePassword(password);
            if (passwordError) {
                return NextResponse.json({ error: passwordError }, { status: 400 });
            }
        }

        if (staffId === authz.context.userId && accountStatus === 'disabled') {
            return NextResponse.json(
                { error: 'You cannot disable your own account' },
                { status: 400 }
            );
        }

        const supabaseAdmin = createAdminServerClient();

        const { data: targetProfileWithStatus, error: targetProfileWithStatusError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, full_name, role, account_status')
            .eq('id', staffId)
            .single();

        let targetProfileSummary: {
            id: string;
            email?: string | null;
            full_name?: string | null;
            role?: UserRole | null;
            account_status?: AccountStatus | null;
        } | null = null;

        let previousStatus: AccountStatus = 'active';
        let statusColumnMissing = false;

        if (targetProfileWithStatusError && targetProfileWithStatusError.message?.includes('account_status')) {
            statusColumnMissing = true;
            const { data: targetProfileFallback, error: targetProfileFallbackError } = await supabaseAdmin
                .from('profiles')
                .select('id, email, full_name, role')
                .eq('id', staffId)
                .single();

            if (targetProfileFallbackError || !targetProfileFallback) {
                return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
            }

            targetProfileSummary = {
                id: targetProfileFallback.id,
                email: targetProfileFallback.email,
                full_name: targetProfileFallback.full_name,
                role: (targetProfileFallback.role as UserRole | null) || null,
                account_status: null,
            };
        } else {
            if (targetProfileWithStatusError || !targetProfileWithStatus) {
                return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
            }

            targetProfileSummary = {
                id: targetProfileWithStatus.id,
                email: targetProfileWithStatus.email,
                full_name: targetProfileWithStatus.full_name,
                role: (targetProfileWithStatus.role as UserRole | null) || null,
                account_status: (targetProfileWithStatus.account_status as AccountStatus | null) || null,
            };

            previousStatus = (targetProfileWithStatus.account_status as AccountStatus | null) || 'active';
        }

        if (wantsStatusChange && statusColumnMissing) {
            return NextResponse.json(
                { error: 'Database schema is missing account status support. Run pending migrations.' },
                { status: 500 }
            );
        }

        const nextStatus = accountStatus as AccountStatus | undefined;

        if (nextStatus) {
            const { error: profileStatusError } = await supabaseAdmin
                .from('profiles')
                .update({ account_status: nextStatus })
                .eq('id', staffId);

            if (profileStatusError) {
                return NextResponse.json({ error: 'Failed to update account status' }, { status: 500 });
            }
        }

        const authUpdates: { password?: string; ban_duration?: string | 'none' } = {};

        if (wantsPasswordChange) {
            authUpdates.password = password;
        }

        if (nextStatus) {
            authUpdates.ban_duration = nextStatus === 'disabled' ? DISABLE_BAN_DURATION : 'none';
        }

        if (Object.keys(authUpdates).length > 0) {
            const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(staffId, authUpdates);

            if (authUpdateError) {
                const authMessage = authUpdateError.message?.toLowerCase() || '';
                const missingAuthUser = authMessage.includes('user not found') || authMessage.includes('not found');

                if (missingAuthUser) {
                    if (!wantsPasswordChange) {
                        if (nextStatus) {
                            await supabaseAdmin
                                .from('profiles')
                                .update({ account_status: previousStatus })
                                .eq('id', staffId);
                        }

                        return NextResponse.json(
                            { error: 'No login account exists for this profile yet. Set a password to create one.' },
                            { status: 400 }
                        );
                    }

                    const targetEmail = targetProfileSummary?.email?.trim().toLowerCase();
                    if (!targetEmail) {
                        if (nextStatus) {
                            await supabaseAdmin
                                .from('profiles')
                                .update({ account_status: previousStatus })
                                .eq('id', staffId);
                        }

                        return NextResponse.json(
                            { error: 'Profile email is required to create a login account' },
                            { status: 400 }
                        );
                    }

                    const desiredStatus = nextStatus || previousStatus;
                    const { error: createMissingAuthUserError } = await supabaseAdmin.auth.admin.createUser({
                        id: staffId,
                        email: targetEmail,
                        password,
                        email_confirm: true,
                        ban_duration: desiredStatus === 'disabled' ? DISABLE_BAN_DURATION : undefined,
                        user_metadata: {
                            full_name: targetProfileSummary?.full_name || undefined,
                            role: targetProfileSummary?.role || undefined,
                        },
                    });

                    if (!createMissingAuthUserError) {
                        return NextResponse.json({
                            message: 'Account updated successfully',
                            data: {
                                id: staffId,
                                account_status: desiredStatus,
                                password_changed: true,
                                login_account_created: true,
                            },
                        });
                    }

                    if (nextStatus) {
                        await supabaseAdmin
                            .from('profiles')
                            .update({ account_status: previousStatus })
                            .eq('id', staffId);
                    }

                    return NextResponse.json(
                        { error: createMissingAuthUserError.message || 'Failed to create login account' },
                        { status: 500 }
                    );
                }

                if (nextStatus) {
                    await supabaseAdmin
                        .from('profiles')
                        .update({ account_status: previousStatus })
                        .eq('id', staffId);
                }

                return NextResponse.json(
                    { error: authUpdateError.message || 'Failed to update account' },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({
            message: 'Account updated successfully',
            data: {
                id: staffId,
                account_status: nextStatus || previousStatus,
                password_changed: wantsPasswordChange,
            },
        });
    } catch {
        return NextResponse.json(
            { error: 'Failed to update account' },
            { status: 500 }
        );
    }
}
