'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { parseRTOCSV, type ParsedRTO } from '@/lib/rto-utils.client';
import { validateRTOData, type ValidationError } from '@/lib/rto-utils';

interface CSVImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (data: ParsedRTO[]) => Promise<void>;
}

export function CSVImportDialog({ open, onOpenChange, onImport }: CSVImportDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<ParsedRTO[]>([]);
    const [errors, setErrors] = useState<ValidationError[]>([]);
    const [importing, setImporting] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleFile = async (file: File) => {
        if (!file.name.endsWith('.csv')) {
            setErrors([{ row: 0, field: 'file', message: 'Please upload a CSV file' }]);
            return;
        }

        setFile(file);
        setErrors([]);

        try {
            const data = await parseRTOCSV(file);
            const validation = validateRTOData(data);

            if (validation.valid) {
                setParsedData(validation.data);
                setErrors([]);
            } else {
                setParsedData([]);
                setErrors(validation.errors);
            }
        } catch (error) {
            setErrors([{
                row: 0,
                field: 'file',
                message: error instanceof Error ? error.message : 'Failed to parse CSV'
            }]);
        }
    };

    const handleImport = async () => {
        setImporting(true);
        try {
            await onImport(parsedData);
            handleClose();
        } catch (error) {
            setErrors([{
                row: 0,
                field: 'import',
                message: error instanceof Error ? error.message : 'Import failed'
            }]);
        } finally {
            setImporting(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setParsedData([]);
        setErrors([]);
        setImporting(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Import RTOs from CSV</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file to bulk import or update RTO records. The file must include
                        &lsquo;code&rsquo; and &lsquo;name&rsquo; columns at minimum.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* File Upload Zone */}
                    <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <input
                            type="file"
                            id="csv-upload"
                            accept=".csv"
                            onChange={handleChange}
                            className="hidden"
                        />
                        <label htmlFor="csv-upload" className="cursor-pointer">
                            {file ? (
                                <div className="space-y-2">
                                    <FileText className="h-12 w-12 mx-auto text-primary" />
                                    <p className="font-medium">{file.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        Click to change file
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                                    <p className="font-medium">
                                        Drop your CSV file here, or click to browse
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Accepts .csv files only
                                    </p>
                                </div>
                            )}
                        </label>
                    </div>

                    {/* Validation Errors */}
                    {errors.length > 0 && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                <p className="font-semibold mb-2">
                                    Found {errors.length} validation error{errors.length > 1 ? 's' : ''}:
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                    {errors.slice(0, 5).map((error, idx) => (
                                        <li key={idx}>
                                            {error.row > 0 ? `Row ${error.row}, ` : ''}
                                            {error.field}: {error.message}
                                        </li>
                                    ))}
                                    {errors.length > 5 && (
                                        <li className="text-muted-foreground">
                                            ...and {errors.length - 5} more errors
                                        </li>
                                    )}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Preview Data */}
                    {parsedData.length > 0 && errors.length === 0 && (
                        <div className="space-y-2">
                            <Alert>
                                <CheckCircle2 className="h-4 w-4" />
                                <AlertDescription>
                                    Ready to import {parsedData.length} RTO record{parsedData.length > 1 ? 's' : ''}
                                </AlertDescription>
                            </Alert>

                            <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Code</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Location</TableHead>
                                            <TableHead>State</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parsedData.slice(0, 10).map((rto, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-mono text-sm">{rto.code}</TableCell>
                                                <TableCell>{rto.name}</TableCell>
                                                <TableCell>{rto.status || 'active'}</TableCell>
                                                <TableCell>{rto.location || '-'}</TableCell>
                                                <TableCell>{rto.state || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                        {parsedData.length > 10 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                                    ...and {parsedData.length - 10} more records
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={importing}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={parsedData.length === 0 || errors.length > 0 || importing}
                    >
                        {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Import {parsedData.length > 0 && `(${parsedData.length})`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
