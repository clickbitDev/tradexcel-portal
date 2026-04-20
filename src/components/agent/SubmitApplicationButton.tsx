'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
    getWorkflowErrorFromPayload,
    getWorkflowErrorFromUnknown,
} from '@/lib/workflow/error-messages';

interface SubmitApplicationResult {
    toStage: 'docs_review';
    updatedAt: string;
}

interface SubmitApplicationButtonProps {
    applicationId: string;
    onSubmitted?: (result: SubmitApplicationResult) => Promise<void> | void;
}

export function SubmitApplicationButton({ applicationId, onSubmitted }: SubmitApplicationButtonProps) {
    const router = useRouter();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleConfirmSubmit = async () => {
        if (submitting) {
            return;
        }

        setSubmitting(true);

        try {
            const response = await fetch(`/api/applications/${applicationId}/submit`, {
                method: 'POST',
            });

            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                toast.error('Unable to submit application', {
                    description: getWorkflowErrorFromPayload(
                        payload,
                        'Unable to submit this application right now. Please try again.'
                    ),
                });
                return;
            }

            const updatedAt = typeof payload?.data?.updatedAt === 'string'
                ? payload.data.updatedAt
                : new Date().toISOString();

            toast.success('Application is already in docs review');
            setConfirmOpen(false);

            if (onSubmitted) {
                await onSubmitted({
                    toStage: 'docs_review',
                    updatedAt,
                });
            } else {
                router.refresh();
            }
        } catch (error) {
            toast.error('Unable to submit application', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to submit this application right now. Please try again.'
                ),
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AlertDialog open={confirmOpen} onOpenChange={(open) => {
            if (!submitting) {
                setConfirmOpen(open);
            }
        }}>
            <AlertDialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                    <Send className="h-4 w-4 mr-2" />
                    Submit Application
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Application already routed to Docs Review</AlertDialogTitle>
                    <AlertDialogDescription>
                        New applications now enter Docs Review directly, so manual submission is no longer required.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={submitting}
                        onClick={(event) => {
                            event.preventDefault();
                            void handleConfirmSubmit();
                        }}
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            'Confirm'
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
