'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Upload,
    FileSpreadsheet,
    AlertCircle,
    CheckCircle,
    Download,
    Loader2,
    X,
} from 'lucide-react';
import {
    parseCSVFile,
    normalizeHeaders,
    importApplicationsFromCSV,
    generateCSVTemplate,
    type ParsedCSVData,
    type CSVImportResult,
} from '@/lib/services/csv-import-service';

interface ApplicationImportDialogProps {
    onImportComplete?: (result: CSVImportResult) => void;
    trigger?: React.ReactNode;
}

export function ApplicationImportDialog({ onImportComplete, trigger }: ApplicationImportDialogProps) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<ParsedCSVData | null>(null);
    const [headerMapping, setHeaderMapping] = useState<Record<string, string>>({});
    const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
    const [importing, setImporting] = useState(false);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const csvFile = acceptedFiles[0];
        if (!csvFile) return;

        setFile(csvFile);

        try {
            const data = await parseCSVFile(csvFile);
            const mapping = normalizeHeaders(data.headers);
            setParsedData(data);
            setHeaderMapping(mapping);
            setStep('preview');
        } catch (error) {
            console.error('Failed to parse CSV:', error);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.csv'],
        },
        maxFiles: 1,
    });

    const handleImport = async () => {
        if (!parsedData) return;

        setImporting(true);
        setStep('importing');

        try {
            const result = await importApplicationsFromCSV(parsedData.rows, headerMapping);
            setImportResult(result);
            setStep('complete');
            onImportComplete?.(result);
        } catch (error) {
            console.error('Import failed:', error);
        }

        setImporting(false);
    };

    const handleDownloadTemplate = () => {
        const template = generateCSVTemplate();
        const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'application_import_template.csv';
        link.click();
    };

    const handleReset = () => {
        setStep('upload');
        setFile(null);
        setParsedData(null);
        setHeaderMapping({});
        setImportResult(null);
    };

    const handleClose = () => {
        setOpen(false);
        // Reset state after dialog closes
        setTimeout(handleReset, 300);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="gap-2">
                        <Upload className="h-4 w-4" />
                        Import CSV
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Import Applications from CSV</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file to bulk create student applications
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    {step === 'upload' && (
                        <div className="space-y-4">
                            <div
                                {...getRootProps()}
                                className={`
                                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                                    transition-colors
                                    ${isDragActive
                                        ? 'border-primary bg-primary/5'
                                        : 'border-muted-foreground/25 hover:border-primary/50'
                                    }
                                `}
                            >
                                <input {...getInputProps()} />
                                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                {isDragActive ? (
                                    <p className="text-lg font-medium">Drop the CSV file here</p>
                                ) : (
                                    <>
                                        <p className="text-lg font-medium">
                                            Drag & drop a CSV file here
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            or click to browse your files
                                        </p>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div>
                                    <p className="font-medium text-sm">Need a template?</p>
                                    <p className="text-xs text-muted-foreground">
                                        Download a sample CSV with all supported fields
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download Template
                                </Button>
                            </div>

                            <div className="text-sm text-muted-foreground">
                                <p className="font-medium mb-2">Required fields:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>student_first_name</li>
                                    <li>student_last_name</li>
                                    <li>qualification_code</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && parsedData && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                <FileSpreadsheet className="h-5 w-5 text-primary" />
                                <div className="flex-1">
                                    <p className="font-medium text-sm">{file?.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {parsedData.rows.length} rows found
                                    </p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={handleReset}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {parsedData.errors.length > 0 && (
                                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                                    <div className="flex items-center gap-2 text-destructive mb-2">
                                        <AlertCircle className="h-4 w-4" />
                                        <span className="font-medium text-sm">Parse Errors</span>
                                    </div>
                                    <ul className="text-xs space-y-1">
                                        {parsedData.errors.slice(0, 5).map((err, i) => (
                                            <li key={i}>Row {err.row}: {err.message}</li>
                                        ))}
                                        {parsedData.errors.length > 5 && (
                                            <li>...and {parsedData.errors.length - 5} more</li>
                                        )}
                                    </ul>
                                </div>
                            )}

                            <div>
                                <p className="text-sm font-medium mb-2">Field Mapping:</p>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(headerMapping).map(([original, mapped]) => (
                                        <Badge
                                            key={original}
                                            variant={original === mapped ? 'outline' : 'secondary'}
                                        >
                                            {original} → {mapped}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <ScrollArea className="h-64 border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12">#</TableHead>
                                            {parsedData.headers.slice(0, 5).map((header) => (
                                                <TableHead key={header} className="min-w-[120px]">
                                                    {headerMapping[header] || header}
                                                </TableHead>
                                            ))}
                                            {parsedData.headers.length > 5 && (
                                                <TableHead>+{parsedData.headers.length - 5} more</TableHead>
                                            )}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parsedData.rows.slice(0, 10).map((row, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                                {parsedData.headers.slice(0, 5).map((header) => (
                                                    <TableCell key={header} className="max-w-[150px] truncate">
                                                        {row[header] || '-'}
                                                    </TableCell>
                                                ))}
                                                {parsedData.headers.length > 5 && (
                                                    <TableCell className="text-muted-foreground">...</TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                        {parsedData.rows.length > 10 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center text-muted-foreground">
                                                    ...and {parsedData.rows.length - 10} more rows
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    )}

                    {step === 'importing' && (
                        <div className="text-center py-12">
                            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                            <p className="text-lg font-medium">Importing applications...</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                This may take a few moments
                            </p>
                        </div>
                    )}

                    {step === 'complete' && importResult && (
                        <div className="space-y-4">
                            <div className={`
                                p-4 rounded-lg text-center
                                ${importResult.failedRows === 0
                                    ? 'bg-green-50 dark:bg-green-950/30'
                                    : 'bg-yellow-50 dark:bg-yellow-950/30'
                                }
                            `}>
                                {importResult.failedRows === 0 ? (
                                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-600" />
                                ) : (
                                    <AlertCircle className="h-12 w-12 mx-auto mb-3 text-yellow-600" />
                                )}
                                <p className="text-lg font-medium">
                                    {importResult.failedRows === 0 ? 'Import Complete!' : 'Import Completed with Errors'}
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <p className="text-2xl font-bold">{importResult.totalRows}</p>
                                    <p className="text-xs text-muted-foreground">Total Rows</p>
                                </div>
                                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                                    <p className="text-2xl font-bold text-green-600">{importResult.successfulRows}</p>
                                    <p className="text-xs text-muted-foreground">Successful</p>
                                </div>
                                <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                                    <p className="text-2xl font-bold text-red-600">{importResult.failedRows}</p>
                                    <p className="text-xs text-muted-foreground">Failed</p>
                                </div>
                            </div>

                            {importResult.errors.length > 0 && (
                                <ScrollArea className="h-48 border rounded-lg p-3">
                                    <p className="font-medium text-sm mb-2">Errors:</p>
                                    <ul className="text-xs space-y-1">
                                        {importResult.errors.map((err, i) => (
                                            <li key={i} className="text-destructive">
                                                Row {err.row}, {err.field}: {err.message}
                                            </li>
                                        ))}
                                    </ul>
                                </ScrollArea>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {step === 'upload' && (
                        <Button variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                    )}
                    {step === 'preview' && (
                        <>
                            <Button variant="outline" onClick={handleReset}>
                                Back
                            </Button>
                            <Button onClick={handleImport} disabled={importing}>
                                Import {parsedData?.rows.length} Applications
                            </Button>
                        </>
                    )}
                    {step === 'complete' && (
                        <>
                            <Button variant="outline" onClick={handleReset}>
                                Import Another
                            </Button>
                            <Button onClick={handleClose}>
                                Done
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default ApplicationImportDialog;
