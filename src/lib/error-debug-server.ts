import 'server-only';

export const DETAILED_PROD_ERROR_ADMIN_ROLES = ['ceo', 'developer', 'admin', 'executive_manager'] as const;

function parseBoolean(value: string | undefined): boolean {
    if (!value) {
        return false;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function isDetailedProdErrorsEnabled(): boolean {
    return parseBoolean(process.env.ENABLE_DETAILED_PROD_ERRORS);
}

export function canRoleViewDetailedProdErrors(role: string | null | undefined): boolean {
    return Boolean(role && DETAILED_PROD_ERROR_ADMIN_ROLES.includes(role as (typeof DETAILED_PROD_ERROR_ADMIN_ROLES)[number]));
}
