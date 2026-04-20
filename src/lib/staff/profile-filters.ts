export const NON_DELETED_PROFILE_FILTER = 'is_deleted.is.null,is_deleted.eq.false';

type ProfileDeleteState = {
    is_deleted?: boolean | null;
};

export function isActiveProfile<T extends ProfileDeleteState>(profile: T): boolean {
    return profile.is_deleted !== true;
}
