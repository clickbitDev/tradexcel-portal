'use client';

import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface WorkflowConflictBannerProps {
    message: string | null;
}

export function WorkflowConflictBanner({ message }: WorkflowConflictBannerProps) {
    if (!message) {
        return null;
    }

    return (
        <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Workflow update blocked</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
        </Alert>
    );
}
