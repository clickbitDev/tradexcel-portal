/**
 * Extraction Review Component
 * 
 * Displays extracted data from documents with confidence scores.
 * Allows users to accept, edit, or reject extracted values.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import {
    CheckCircle,
    AlertTriangle,
    XCircle,
    Edit2,
    Check,
    X,
    FileSearch,
    Loader2,
} from 'lucide-react';
import type { ExtractionResult, ExtractedField, ApplicationFieldMapping } from '@/lib/extraction/types';
import { getConfidenceLabel, formatConfidence, mapToApplicationFields } from '@/lib/extraction';

// Field labels for display
const FIELD_LABELS: Record<string, string> = {
    first_name: 'First Name',
    last_name: 'Last Name',
    full_name: 'Full Name',
    dob: 'Date of Birth',
    nationality: 'Nationality',
    passport_number: 'Passport Number',
    visa_number: 'Visa Number',
    expiry_date: 'Expiry Date',
    gender: 'Gender',
    issuing_country: 'Issuing Country',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    usi_number: 'USI Number',
    qualification_name: 'Qualification',
    institution_name: 'Institution',
    completion_date: 'Completion Date',
    student_name: 'Student Name',
};

// Map extracted field names to application field names
const FIELD_TO_APP_FIELD: Record<string, keyof ApplicationFieldMapping> = {
    first_name: 'student_first_name',
    last_name: 'student_last_name',
    dob: 'student_dob',
    nationality: 'student_nationality',
    passport_number: 'student_passport_number',
    visa_number: 'student_visa_number',
    expiry_date: 'student_visa_expiry',
    email: 'student_email',
    phone: 'student_phone',
    address: 'student_address',
    usi_number: 'student_usi',
};

interface FieldRowProps {
    fieldName: string;
    field: ExtractedField;
    onAccept: (fieldName: string, value: string) => void;
    onReject: (fieldName: string) => void;
    accepted: boolean;
}

function FieldRow({ fieldName, field, onAccept, onReject, accepted }: FieldRowProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(field.value);
    const confidenceLevel = getConfidenceLabel(field.confidence);

    const handleAccept = () => {
        onAccept(fieldName, editValue);
        setIsEditing(false);
    };

    const handleSaveEdit = () => {
        onAccept(fieldName, editValue);
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditValue(field.value);
        setIsEditing(false);
    };

    return (
        <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${accepted
                ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                : 'bg-muted/30 border-border'
            }`}>
            {/* Confidence indicator */}
            <div className="flex-shrink-0">
                {confidenceLevel === 'high' && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                )}
                {confidenceLevel === 'medium' && (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                )}
                {confidenceLevel === 'low' && (
                    <XCircle className="h-5 w-5 text-red-500" />
                )}
            </div>

            {/* Field name */}
            <div className="w-32 flex-shrink-0">
                <p className="text-sm font-medium">{FIELD_LABELS[fieldName] || fieldName}</p>
            </div>

            {/* Value */}
            <div className="flex-1 min-w-0">
                {isEditing ? (
                    <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-8"
                        autoFocus
                    />
                ) : (
                    <p className="text-sm truncate">{field.value}</p>
                )}
            </div>

            {/* Confidence badge */}
            <Badge
                variant={confidenceLevel === 'high' ? 'default' : confidenceLevel === 'medium' ? 'secondary' : 'destructive'}
                className="flex-shrink-0"
            >
                {formatConfidence(field.confidence)}
            </Badge>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
                {isEditing ? (
                    <>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveEdit}>
                            <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancelEdit}>
                            <X className="h-4 w-4" />
                        </Button>
                    </>
                ) : accepted ? (
                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                        Accepted
                    </Badge>
                ) : (
                    <>
                        <Button size="sm" variant="outline" onClick={handleAccept}>
                            Accept
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditing(true)}>
                            <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onReject(fieldName)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}

interface ExtractionReviewProps {
    result: ExtractionResult;
    onApply: (fields: ApplicationFieldMapping) => void;
    onCancel: () => void;
    isApplying?: boolean;
}

export function ExtractionReview({
    result,
    onApply,
    onCancel,
    isApplying = false
}: ExtractionReviewProps) {
    const [acceptedFields, setAcceptedFields] = useState<Record<string, string>>({});
    const [rejectedFields, setRejectedFields] = useState<Set<string>>(new Set());

    const handleAccept = (fieldName: string, value: string) => {
        setAcceptedFields(prev => ({ ...prev, [fieldName]: value }));
        setRejectedFields(prev => {
            const next = new Set(prev);
            next.delete(fieldName);
            return next;
        });
    };

    const handleReject = (fieldName: string) => {
        setRejectedFields(prev => new Set([...prev, fieldName]));
        setAcceptedFields(prev => {
            const next = { ...prev };
            delete next[fieldName];
            return next;
        });
    };

    const handleAcceptAll = () => {
        const highConfidenceFields: Record<string, string> = {};
        Object.entries(result.fields).forEach(([key, field]) => {
            if (field && field.confidence >= 0.90 && !rejectedFields.has(key)) {
                highConfidenceFields[key] = field.value;
            }
        });
        setAcceptedFields(prev => ({ ...prev, ...highConfidenceFields }));
    };

    const handleApply = () => {
        // Build application field mapping from accepted fields
        const mapping: ApplicationFieldMapping = {};

        Object.entries(acceptedFields).forEach(([key, value]) => {
            const appField = FIELD_TO_APP_FIELD[key];
            if (appField) {
                (mapping as Record<string, string>)[appField] = value;
            }
        });

        onApply(mapping);
    };

    // Filter out rejected fields
    const visibleFields = Object.entries(result.fields).filter(
        ([key]) => !rejectedFields.has(key)
    );

    const acceptedCount = Object.keys(acceptedFields).length;
    const highConfidenceCount = visibleFields.filter(
        ([key, field]) => field && field.confidence >= 0.90 && !acceptedFields[key]
    ).length;

    if (result.status === 'failed' || result.status === 'skipped') {
        return (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle className="h-5 w-5" />
                        Extraction {result.status === 'failed' ? 'Failed' : 'Skipped'}
                    </CardTitle>
                    <CardDescription className="text-amber-600">
                        {result.error || 'No data could be extracted from this document.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button variant="outline" onClick={onCancel}>
                        Close
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileSearch className="h-5 w-5" />
                    Extracted Data - {result.documentType}
                </CardTitle>
                <CardDescription>
                    Review the extracted data below. Accept fields to auto-fill the application form.
                    Overall confidence: {formatConfidence(result.overallConfidence)}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Field list */}
                <div className="space-y-2">
                    {visibleFields.map(([key, field]) => (
                        field && (
                            <FieldRow
                                key={key}
                                fieldName={key}
                                field={field}
                                onAccept={handleAccept}
                                onReject={handleReject}
                                accepted={!!acceptedFields[key]}
                            />
                        )
                    ))}
                </div>

                {visibleFields.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No fields to display. All fields have been rejected.
                    </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                        {acceptedCount} field{acceptedCount !== 1 ? 's' : ''} accepted
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onCancel} disabled={isApplying}>
                            Cancel
                        </Button>
                        {highConfidenceCount > 0 && (
                            <Button variant="outline" onClick={handleAcceptAll} disabled={isApplying}>
                                Accept High Confidence ({highConfidenceCount})
                            </Button>
                        )}
                        <Button
                            onClick={handleApply}
                            disabled={acceptedCount === 0 || isApplying}
                        >
                            {isApplying ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Applying...
                                </>
                            ) : (
                                `Apply ${acceptedCount} Field${acceptedCount !== 1 ? 's' : ''}`
                            )}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
