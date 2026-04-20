'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Eye, Loader2, Mail, Paperclip, Send, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { WorkflowStage } from '@/types/database';
import { getWorkflowErrorFromPayload, getWorkflowErrorFromUnknown } from '@/lib/workflow/error-messages';
import { BRAND_ADMISSIONS_TEAM } from '@/lib/brand';

interface AdminDocsReviewTasksPanelProps {
    applicationId: string;
    workflowStage: WorkflowStage;
    canEdit: boolean;
    studentEmail: string | null;
    studentName: string;
    additionalEmails: string[] | null;
    applicantTaskCompleted: boolean;
    referencesTaskCompleted: boolean;
    onTaskStateUpdate: (nextState: {
        admin_applicant_pdf_email_completed: boolean;
        admin_applicant_pdf_email_completed_at: string | null;
        admin_references_email_completed: boolean;
        admin_references_email_completed_at: string | null;
    }) => void;
}

type AttachmentKind = 'pdf' | 'image' | 'other';

interface EmailAttachment {
    id: string;
    file: File;
    previewUrl: string | null;
    kind: AttachmentKind;
}

const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function formatDefaultApplicantEmailBody(studentName: string): string {
    return [
        `Hi ${studentName || 'Student'},`,
        '',
        'Please find your PDF attachment for this application.',
        '',
        'Kind regards,',
        BRAND_ADMISSIONS_TEAM,
    ].join('\n');
}

function formatDefaultReferencesEmailBody(studentName: string): string {
    return [
        'Hello,',
        '',
        `This is a custom update regarding ${studentName || 'the applicant'}.`,
        '',
        'Kind regards,',
        BRAND_ADMISSIONS_TEAM,
    ].join('\n');
}

function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getAttachmentKind(file: File): AttachmentKind {
    const name = file.name.toLowerCase();
    const type = (file.type || '').toLowerCase();

    if (type === 'application/pdf' || name.endsWith('.pdf')) {
        return 'pdf';
    }

    if (type.startsWith('image/')) {
        return 'image';
    }

    return 'other';
}

function createEmailAttachment(file: File): EmailAttachment {
    const kind = getAttachmentKind(file);
    const canPreview = kind === 'pdf' || kind === 'image';

    return {
        id: crypto.randomUUID(),
        file,
        previewUrl: canPreview ? URL.createObjectURL(file) : null,
        kind,
    };
}

function revokeAttachment(attachment: EmailAttachment) {
    if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
    }
}

export function AdminDocsReviewTasksPanel({
    applicationId,
    workflowStage,
    canEdit,
    studentEmail,
    studentName,
    additionalEmails,
    applicantTaskCompleted,
    referencesTaskCompleted,
    onTaskStateUpdate,
}: AdminDocsReviewTasksPanelProps) {
    const [applicantDialogOpen, setApplicantDialogOpen] = useState(false);
    const [referencesDialogOpen, setReferencesDialogOpen] = useState(false);

    const [applicantSubject, setApplicantSubject] = useState('Application PDF Document');
    const [applicantBody, setApplicantBody] = useState(formatDefaultApplicantEmailBody(studentName));

    const [referencesRecipients, setReferencesRecipients] = useState((additionalEmails || []).join('\n'));
    const [referencesSubject, setReferencesSubject] = useState('Application Reference Email');
    const [referencesBody, setReferencesBody] = useState(formatDefaultReferencesEmailBody(studentName));

    const [applicantAttachments, setApplicantAttachments] = useState<EmailAttachment[]>([]);
    const [referencesAttachments, setReferencesAttachments] = useState<EmailAttachment[]>([]);
    const [selectedApplicantAttachmentId, setSelectedApplicantAttachmentId] = useState<string | null>(null);
    const [selectedReferencesAttachmentId, setSelectedReferencesAttachmentId] = useState<string | null>(null);

    const [sendingApplicantEmail, setSendingApplicantEmail] = useState(false);
    const [sendingReferencesEmail, setSendingReferencesEmail] = useState(false);

    const applicantFileInputRef = useRef<HTMLInputElement | null>(null);
    const referencesFileInputRef = useRef<HTMLInputElement | null>(null);
    const applicantAttachmentsRef = useRef<EmailAttachment[]>([]);
    const referencesAttachmentsRef = useRef<EmailAttachment[]>([]);

    const isDocsReview = workflowStage === 'docs_review';
    const canSendApplicantTask = isDocsReview && canEdit && Boolean(studentEmail);
    const canSendReferencesTask = isDocsReview && canEdit;

    useEffect(() => {
        applicantAttachmentsRef.current = applicantAttachments;
    }, [applicantAttachments]);

    useEffect(() => {
        referencesAttachmentsRef.current = referencesAttachments;
    }, [referencesAttachments]);

    useEffect(() => {
        return () => {
            applicantAttachmentsRef.current.forEach(revokeAttachment);
            referencesAttachmentsRef.current.forEach(revokeAttachment);
        };
    }, []);

    useEffect(() => {
        if (!applicantAttachments.some((attachment) => attachment.id === selectedApplicantAttachmentId)) {
            setSelectedApplicantAttachmentId(applicantAttachments[0]?.id || null);
        }
    }, [applicantAttachments, selectedApplicantAttachmentId]);

    useEffect(() => {
        if (!referencesAttachments.some((attachment) => attachment.id === selectedReferencesAttachmentId)) {
            setSelectedReferencesAttachmentId(referencesAttachments[0]?.id || null);
        }
    }, [referencesAttachments, selectedReferencesAttachmentId]);

    const selectedApplicantAttachment = useMemo(
        () => applicantAttachments.find((attachment) => attachment.id === selectedApplicantAttachmentId) || null,
        [applicantAttachments, selectedApplicantAttachmentId]
    );

    const selectedReferencesAttachment = useMemo(
        () => referencesAttachments.find((attachment) => attachment.id === selectedReferencesAttachmentId) || null,
        [referencesAttachments, selectedReferencesAttachmentId]
    );

    const resetApplicantComposer = () => {
        applicantAttachments.forEach(revokeAttachment);
        setApplicantAttachments([]);
        setSelectedApplicantAttachmentId(null);
        setApplicantSubject('Application PDF Document');
        setApplicantBody(formatDefaultApplicantEmailBody(studentName));
    };

    const resetReferencesComposer = () => {
        referencesAttachments.forEach(revokeAttachment);
        setReferencesAttachments([]);
        setSelectedReferencesAttachmentId(null);
        setReferencesRecipients((additionalEmails || []).join('\n'));
        setReferencesSubject('Application Reference Email');
        setReferencesBody(formatDefaultReferencesEmailBody(studentName));
    };

    const appendAttachments = (
        files: FileList,
        current: EmailAttachment[],
        setAttachments: Dispatch<SetStateAction<EmailAttachment[]>>
    ) => {
        if (files.length === 0) {
            return;
        }

        const allowedSlots = Math.max(0, MAX_ATTACHMENTS - current.length);
        if (allowedSlots <= 0) {
            toast.error(`Maximum ${MAX_ATTACHMENTS} attachments allowed.`);
            return;
        }

        const nextItems: EmailAttachment[] = [];
        Array.from(files).forEach((file) => {
            if (nextItems.length >= allowedSlots) {
                return;
            }

            if (file.size > MAX_ATTACHMENT_BYTES) {
                toast.error(`${file.name} is too large`, {
                    description: 'Each attachment must be 10MB or less.',
                });
                return;
            }

            nextItems.push(createEmailAttachment(file));
        });

        if (nextItems.length > 0) {
            setAttachments((prev) => [...prev, ...nextItems]);
        }
    };

    const removeApplicantAttachment = (attachmentId: string) => {
        setApplicantAttachments((prev) => {
            const target = prev.find((item) => item.id === attachmentId);
            if (target) {
                revokeAttachment(target);
            }

            return prev.filter((item) => item.id !== attachmentId);
        });
    };

    const removeReferencesAttachment = (attachmentId: string) => {
        setReferencesAttachments((prev) => {
            const target = prev.find((item) => item.id === attachmentId);
            if (target) {
                revokeAttachment(target);
            }

            return prev.filter((item) => item.id !== attachmentId);
        });
    };

    const parseReferenceRecipients = (value: string): string[] => {
        const entries = value
            .split(/[\n,;]+/)
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean);

        return [...new Set(entries)];
    };

    const handleSendApplicantEmail = async () => {
        if (!studentEmail) {
            toast.error('Student email is required.');
            return;
        }

        if (applicantAttachments.length === 0) {
            toast.error('Please attach at least one PDF file.');
            return;
        }

        const hasPdf = applicantAttachments.some((attachment) => attachment.kind === 'pdf');
        if (!hasPdf) {
            toast.error('Applicant email requires at least one PDF attachment.');
            return;
        }

        const formData = new FormData();
        formData.append('action', 'send_applicant_pdf_email');
        formData.append('subject', applicantSubject);
        formData.append('body', applicantBody);
        applicantAttachments.forEach((attachment) => {
            formData.append('attachments', attachment.file, attachment.file.name);
        });

        setSendingApplicantEmail(true);
        try {
            const response = await fetch(`/api/applications/${applicationId}/admin-tasks`, {
                method: 'POST',
                body: formData,
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                toast.error('Unable to send applicant email', {
                    description: getWorkflowErrorFromPayload(
                        payload,
                        'Unable to send applicant email with PDF right now. Please try again.'
                    ),
                });
                return;
            }

            onTaskStateUpdate(payload.data.application);
            toast.success('Applicant email sent with attachment(s).');
            setApplicantDialogOpen(false);
            resetApplicantComposer();
        } catch (error) {
            toast.error('Unable to send applicant email', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to send applicant email with attachment(s) right now. Please try again.'
                ),
            });
        } finally {
            setSendingApplicantEmail(false);
        }
    };

    const handleSendReferencesEmail = async () => {
        const recipients = parseReferenceRecipients(referencesRecipients);

        if (recipients.length === 0) {
            toast.error('Enter at least one reference email address.');
            return;
        }

        const formData = new FormData();
        formData.append('action', 'send_reference_email');
        formData.append('subject', referencesSubject);
        formData.append('body', referencesBody);
        formData.append('recipients', recipients.join('\n'));
        referencesAttachments.forEach((attachment) => {
            formData.append('attachments', attachment.file, attachment.file.name);
        });

        setSendingReferencesEmail(true);
        try {
            const response = await fetch(`/api/applications/${applicationId}/admin-tasks`, {
                method: 'POST',
                body: formData,
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                toast.error('Unable to send reference emails', {
                    description: getWorkflowErrorFromPayload(
                        payload,
                        'Unable to send reference emails right now. Please try again.'
                    ),
                });
                return;
            }

            onTaskStateUpdate(payload.data.application);
            toast.success(`Reference emails sent to ${payload.data.recipientCount || recipients.length} recipient(s).`);
            setReferencesDialogOpen(false);
            resetReferencesComposer();
        } catch (error) {
            toast.error('Unable to send reference emails', {
                description: getWorkflowErrorFromUnknown(
                    error,
                    'Unable to send reference emails right now. Please try again.'
                ),
            });
        } finally {
            setSendingReferencesEmail(false);
        }
    };

    const renderAttachmentList = (
        attachments: EmailAttachment[],
        selectedId: string | null,
        onSelect: (id: string) => void,
        onRemove: (id: string) => void
    ) => (
        <div className="space-y-2">
            {attachments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No attachments selected.</p>
            ) : (
                attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{attachment.file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatBytes(attachment.file.size)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                type="button"
                                size="icon"
                                variant={selectedId === attachment.id ? 'secondary' : 'outline'}
                                onClick={() => onSelect(attachment.id)}
                                title="Preview"
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => onRemove(attachment.id)}
                                title="Remove attachment"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    const renderAttachmentPreview = (attachment: EmailAttachment | null) => {
        if (!attachment) {
            return (
                <div className="flex h-full min-h-[320px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                    Select an attachment to preview.
                </div>
            );
        }

        if (attachment.kind === 'pdf' && attachment.previewUrl) {
            return (
                <iframe
                    src={`${attachment.previewUrl}#toolbar=1&navpanes=0`}
                    title={attachment.file.name}
                    className="h-full min-h-[520px] w-full rounded-md border bg-background"
                />
            );
        }

        if (attachment.kind === 'image' && attachment.previewUrl) {
            return (
                <div className="flex h-full min-h-[520px] items-center justify-center rounded-md border bg-background p-2">
                    <object
                        data={attachment.previewUrl}
                        type={attachment.file.type || 'image/*'}
                        className="max-h-full max-w-full"
                        aria-label={attachment.file.name}
                    >
                        <p className="text-sm text-muted-foreground">Preview is not available for this image.</p>
                    </object>
                </div>
            );
        }

        return (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 rounded-md border text-sm text-muted-foreground">
                <p>No inline preview for this file type.</p>
                <p>{attachment.file.name}</p>
            </div>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    Admin Docs Review Tasks
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-md border p-2">
                    <div className="space-y-0.5">
                        <p className="text-sm font-medium">1. Applicant email with PDF</p>
                        <p className="text-xs text-muted-foreground">Required before transition to Enrolled.</p>
                    </div>
                    <Badge variant="outline" className={applicantTaskCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}>
                        {applicantTaskCompleted ? (
                            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Completed</span>
                        ) : 'Pending'}
                    </Badge>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    disabled={!canSendApplicantTask || sendingApplicantEmail}
                    onClick={() => {
                        resetApplicantComposer();
                        setApplicantDialogOpen(true);
                    }}
                    title={!isDocsReview ? 'Task is only available in Docs Review' : undefined}
                >
                    <Mail className="mr-2 h-4 w-4" />
                    Send Applicant Email with PDF
                </Button>

                <div className="flex items-center justify-between rounded-md border p-2">
                    <div className="space-y-0.5">
                        <p className="text-sm font-medium">2. Custom references email</p>
                        <p className="text-xs text-muted-foreground">Optional task.</p>
                    </div>
                    <Badge variant="outline" className={referencesTaskCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
                        {referencesTaskCompleted ? (
                            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Completed</span>
                        ) : 'Optional'}
                    </Badge>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    disabled={!canSendReferencesTask || sendingReferencesEmail}
                    onClick={() => {
                        resetReferencesComposer();
                        setReferencesDialogOpen(true);
                    }}
                    title={!isDocsReview ? 'Task is only available in Docs Review' : undefined}
                >
                    <Send className="mr-2 h-4 w-4" />
                    Send Custom References Email
                </Button>

                {!isDocsReview ? (
                    <p className="text-xs text-muted-foreground">
                        This checklist is actionable only when the application is in Docs Review.
                    </p>
                ) : null}
            </CardContent>

            <Dialog
                open={applicantDialogOpen}
                onOpenChange={(open) => {
                    if (sendingApplicantEmail) {
                        return;
                    }

                    setApplicantDialogOpen(open);
                    if (!open) {
                        resetApplicantComposer();
                    }
                }}
            >
                <DialogContent className="left-0 top-0 h-screen w-screen max-h-none max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 p-0 sm:max-w-none">
                    <div className="flex h-full flex-col">
                        <DialogHeader className="border-b px-6 py-4 text-left">
                            <DialogTitle>Send Applicant Email with PDF</DialogTitle>
                            <DialogDescription>
                                Recipient: {studentEmail || '-'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
                            <ScrollArea className="h-full border-r">
                                <div className="space-y-4 p-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="admin-applicant-subject">Subject</Label>
                                        <Input
                                            id="admin-applicant-subject"
                                            value={applicantSubject}
                                            onChange={(event) => setApplicantSubject(event.target.value)}
                                            maxLength={255}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="admin-applicant-body">Message</Label>
                                        <Textarea
                                            id="admin-applicant-body"
                                            value={applicantBody}
                                            onChange={(event) => setApplicantBody(event.target.value)}
                                            rows={12}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Attachments</Label>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => applicantFileInputRef.current?.click()}
                                            >
                                                <Upload className="mr-2 h-4 w-4" />
                                                Attach Files
                                            </Button>
                                        </div>
                                        <input
                                            ref={applicantFileInputRef}
                                            type="file"
                                            className="hidden"
                                            multiple
                                            onChange={(event) => {
                                                if (event.target.files) {
                                                    appendAttachments(event.target.files, applicantAttachments, setApplicantAttachments);
                                                }
                                                event.target.value = '';
                                            }}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Up to {MAX_ATTACHMENTS} files, 10MB each. At least one PDF is required.
                                        </p>
                                        {renderAttachmentList(
                                            applicantAttachments,
                                            selectedApplicantAttachmentId,
                                            setSelectedApplicantAttachmentId,
                                            removeApplicantAttachment
                                        )}
                                    </div>
                                </div>
                            </ScrollArea>

                            <div className="min-h-0 p-6">
                                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                                    <Paperclip className="h-4 w-4" />
                                    Attachment Preview
                                </div>
                                {renderAttachmentPreview(selectedApplicantAttachment)}
                            </div>
                        </div>

                        <DialogFooter className="border-t px-6 py-4 sm:justify-end">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setApplicantDialogOpen(false);
                                    resetApplicantComposer();
                                }}
                                disabled={sendingApplicantEmail}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleSendApplicantEmail} disabled={sendingApplicantEmail}>
                                {sendingApplicantEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                Send Email
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={referencesDialogOpen}
                onOpenChange={(open) => {
                    if (sendingReferencesEmail) {
                        return;
                    }

                    setReferencesDialogOpen(open);
                    if (!open) {
                        resetReferencesComposer();
                    }
                }}
            >
                <DialogContent className="left-0 top-0 h-screen w-screen max-h-none max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 p-0 sm:max-w-none">
                    <div className="flex h-full flex-col">
                        <DialogHeader className="border-b px-6 py-4 text-left">
                            <DialogTitle>Send Custom References Email</DialogTitle>
                            <DialogDescription>
                                This task is optional. Use one email per line, or separate with commas.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
                            <ScrollArea className="h-full border-r">
                                <div className="space-y-4 p-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="admin-reference-recipients">Recipients</Label>
                                        <Textarea
                                            id="admin-reference-recipients"
                                            value={referencesRecipients}
                                            onChange={(event) => setReferencesRecipients(event.target.value)}
                                            rows={5}
                                            placeholder="reference1@example.com\nreference2@example.com"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="admin-reference-subject">Subject</Label>
                                        <Input
                                            id="admin-reference-subject"
                                            value={referencesSubject}
                                            onChange={(event) => setReferencesSubject(event.target.value)}
                                            maxLength={255}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="admin-reference-body">Message</Label>
                                        <Textarea
                                            id="admin-reference-body"
                                            value={referencesBody}
                                            onChange={(event) => setReferencesBody(event.target.value)}
                                            rows={12}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>Attachments (optional)</Label>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => referencesFileInputRef.current?.click()}
                                            >
                                                <Upload className="mr-2 h-4 w-4" />
                                                Attach Files
                                            </Button>
                                        </div>
                                        <input
                                            ref={referencesFileInputRef}
                                            type="file"
                                            className="hidden"
                                            multiple
                                            onChange={(event) => {
                                                if (event.target.files) {
                                                    appendAttachments(event.target.files, referencesAttachments, setReferencesAttachments);
                                                }
                                                event.target.value = '';
                                            }}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Up to {MAX_ATTACHMENTS} files, 10MB each.
                                        </p>
                                        {renderAttachmentList(
                                            referencesAttachments,
                                            selectedReferencesAttachmentId,
                                            setSelectedReferencesAttachmentId,
                                            removeReferencesAttachment
                                        )}
                                    </div>
                                </div>
                            </ScrollArea>

                            <div className="min-h-0 p-6">
                                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                                    <Paperclip className="h-4 w-4" />
                                    Attachment Preview
                                </div>
                                {renderAttachmentPreview(selectedReferencesAttachment)}
                            </div>
                        </div>

                        <DialogFooter className="border-t px-6 py-4 sm:justify-end">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setReferencesDialogOpen(false);
                                    resetReferencesComposer();
                                }}
                                disabled={sendingReferencesEmail}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleSendReferencesEmail} disabled={sendingReferencesEmail}>
                                {sendingReferencesEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Send Email
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
