'use client';

import { VersionHistory, ActivityFeed, ArchiveActions, DeleteActions } from '@/components/common';
import { Card } from '@/components/ui/card';

interface PartnerVersionControlProps {
    partnerId: string;
    isArchived: boolean;
    isDeleted: boolean;
}

export function PartnerVersionControl({ partnerId, isArchived, isDeleted }: PartnerVersionControlProps) {
    return (
        <div className="space-y-6">
            {/* Record Management */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Record Management</h3>
                <div className="flex gap-3">
                    <ArchiveActions
                        tableName="partners"
                        recordId={partnerId}
                        isArchived={isArchived}
                        onSuccess={() => window.location.reload()}
                    />
                    <DeleteActions
                        tableName="partners"
                        recordId={partnerId}
                        isDeleted={isDeleted}
                        onSuccess={() => window.location.href = '/portal/partners'}
                    />
                </div>
            </Card>

            {/* Version History */}
            <VersionHistory
                tableName="partners"
                recordId={partnerId}
                maxHeight="400px"
                onVersionRestored={() => window.location.reload()}
            />

            {/* Activity Feed */}
            <ActivityFeed
                tableName="partners"
                recordId={partnerId}
                maxHeight="300px"
            />
        </div>
    );
}
