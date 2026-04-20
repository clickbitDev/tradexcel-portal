export const ACTIVE_RECORD_FILTER = 'is_deleted.is.null,is_deleted.eq.false';

type SoftDeleteRecord = {
    is_deleted?: boolean | null;
};

export function isActiveRecord<T extends SoftDeleteRecord>(record: T): boolean {
    return record.is_deleted !== true;
}
