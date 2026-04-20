'use client';

import { usePermissions, ActionPermission } from '@/hooks/usePermissions';
import { Button, buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import { ReactNode, ComponentProps } from 'react';
import { VariantProps } from 'class-variance-authority';

type ButtonProps = ComponentProps<typeof Button> & VariantProps<typeof buttonVariants>;

interface PermissionButtonProps extends Omit<ButtonProps, 'children'> {
    permission: ActionPermission;
    children: ReactNode;
    href?: string;
}

/**
 * Button that only renders if the user has the required permission.
 * Can optionally link to a URL.
 */
export function PermissionButton({
    permission,
    children,
    href,
    ...buttonProps
}: PermissionButtonProps) {
    const { can, loading } = usePermissions();

    if (loading) return null;
    if (!can(permission)) return null;

    if (href) {
        return (
            <Link href={href}>
                <Button {...buttonProps}>{children}</Button>
            </Link>
        );
    }

    return <Button {...buttonProps}>{children}</Button>;
}

interface PermissionLinkProps {
    permission: ActionPermission;
    href: string;
    children: ReactNode;
    className?: string;
}

/**
 * Link that only renders if the user has the required permission.
 */
export function PermissionLink({
    permission,
    href,
    children,
    className,
}: PermissionLinkProps) {
    const { can, loading } = usePermissions();

    if (loading) return null;
    if (!can(permission)) return null;

    return (
        <Link href={href} className={className}>
            {children}
        </Link>
    );
}

interface PermissionGateProps {
    permission: ActionPermission;
    children: ReactNode;
    fallback?: ReactNode;
}

/**
 * Renders children only if the user has the required permission.
 */
export function PermissionGate({
    permission,
    children,
    fallback = null,
}: PermissionGateProps) {
    const { can, loading } = usePermissions();

    if (loading) return null;
    if (!can(permission)) return fallback;

    return <>{children}</>;
}
