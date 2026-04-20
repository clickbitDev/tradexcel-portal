/**
 * Qualifications Import Page
 * 
 * CSV import interface for bulk adding/updating qualifications
 * Supports both file selection and drag-and-drop
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    ArrowLeft,
    Upload,
    FileSpreadsheet,
    CheckCircle,
    AlertCircle,
    Download,
    Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { parseCSVImport, commitCSVImport } from '@/lib/services/csv-import';
import type { ImportPreview } from '@/lib/types/qualifications';
import { useRouter } from 'next/navigation';

export default function ImportQualificationsPage() {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<{ inserted: number; updated: number; errors: number } | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const processFile = useCallback(async (selectedFile: File) => {
        setFile(selectedFile);
        setLoading(true);
        setPreview(null);
        setResult(null);

        try {
            const content = await selectedFile.text();
            const importPreview = await parseCSVImport(content);
            setPreview(importPreview);
        } catch (error) {
            console.error('Parse error:', error);
            alert(error instanceof Error ? error.message : 'Failed to parse CSV file');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (!selectedFile) return;
        await processFile(selectedFile);
    };

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            // Validate file type
            if (!droppedFile.name.endsWith('.csv') && droppedFile.type !== 'text/csv') {
                alert('Please drop a CSV file');
                return;
            }
            await processFile(droppedFile);
        }
    }, [processFile]);

    const handleImport = async () => {
        if (!preview) return;

        setImporting(true);
        try {
            const importResult = await commitCSVImport(preview);
            setResult(importResult);

            if (importResult.errors === 0) {
                setTimeout(() => {
                    router.push('/portal/qualifications');
                }, 2000);
            }
        } catch (error) {
            console.error('Import error:', error);
            alert(error instanceof Error ? error.message : 'Failed to import');
        } finally {
            setImporting(false);
        }
    };

    const downloadTemplate = () => {
        const template = `code,name,level,status,release_date,superseded_by,entry_requirements,cricos_code,core_units,elective_units,total_units
BSB50120,"Diploma of Business",Diploma,current,2020-01-01,,Year 12 or equivalent,,,,
BSB40120,"Certificate IV in Business",Certificate IV,current,2020-01-01,,,,,,`;

        const blob = new Blob([template], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'qualifications-template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const totalChanges = preview ?
        preview.qualifications.toInsert.length +
        preview.qualifications.toUpdate.length +
        preview.units.toInsert.length +
        preview.units.toUpdate.length : 0;

    const totalErrors = preview ?
        preview.qualifications.errors.length +
        preview.units.errors.length : 0;

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link href="/portal/qualifications">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-semibold text-foreground">Import Qualifications</h1>
                        <p className="text-sm text-muted-foreground">
                            Upload a CSV file to bulk import qualifications
                        </p>
                    </div>
                </div>
            </header>

            <div className="p-6 max-w-4xl mx-auto space-y-6">
                {/* Drop Zone & Instructions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5" />
                            CSV Import
                        </CardTitle>
                        <CardDescription>
                            Upload a CSV file with qualification data. Columns: code, name, level, status,
                            release_date, superseded_by, entry_requirements, cricos_code, core_units,
                            elective_units, total_units (multiline quoted fields are supported).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Drag and Drop Zone */}
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`
                                relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                                transition-all duration-200 ease-in-out
                                ${dragActive
                                    ? 'border-primary bg-primary/5 scale-[1.02]'
                                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                                }
                                ${loading ? 'pointer-events-none opacity-60' : ''}
                            `}
                        >
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileSelect}
                                ref={fileInputRef}
                                className="hidden"
                            />
                            <div className="flex flex-col items-center gap-3">
                                <div className={`
                                    w-14 h-14 rounded-full flex items-center justify-center
                                    ${dragActive ? 'bg-primary/10' : 'bg-muted'}
                                `}>
                                    <Upload className={`h-6 w-6 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                                </div>
                                {file ? (
                                    <div>
                                        <p className="font-medium text-foreground">{file.name}</p>
                                        <p className="text-sm text-muted-foreground">Click or drop a new file to replace</p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="font-medium text-foreground">
                                            {dragActive ? 'Drop your CSV file here' : 'Drag and drop your CSV file here'}
                                        </p>
                                        <p className="text-sm text-muted-foreground">or click to browse</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-center">
                            <Button variant="ghost" onClick={downloadTemplate}>
                                <Download className="h-4 w-4 mr-2" />
                                Download Template
                            </Button>
                        </div>

                        {loading && (
                            <div className="flex items-center justify-center gap-2 text-muted-foreground py-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Parsing file...
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Preview */}
                {preview && (
                    <>
                        {/* Summary */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Import Preview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="text-center p-4 bg-green-50 rounded-lg">
                                        <p className="text-2xl font-bold text-green-700">
                                            {preview.qualifications.toInsert.length}
                                        </p>
                                        <p className="text-sm text-green-600">New Qualifications</p>
                                    </div>
                                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                                        <p className="text-2xl font-bold text-blue-700">
                                            {preview.qualifications.toUpdate.length}
                                        </p>
                                        <p className="text-sm text-blue-600">Updates</p>
                                    </div>
                                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                                        <p className="text-2xl font-bold text-purple-700">
                                            {preview.units.toInsert.length + preview.units.toUpdate.length}
                                        </p>
                                        <p className="text-sm text-purple-600">Units</p>
                                    </div>
                                    <div className="text-center p-4 bg-red-50 rounded-lg">
                                        <p className="text-2xl font-bold text-red-700">{totalErrors}</p>
                                        <p className="text-sm text-red-600">Errors</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Errors */}
                        {totalErrors > 0 && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    <p className="font-medium mb-2">{totalErrors} error(s) found:</p>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                        {preview.qualifications.errors.map((err, i) => (
                                            <li key={`q-${i}`}>Row {err.row}: {err.message}</li>
                                        ))}
                                        {preview.units.errors.map((err, i) => (
                                            <li key={`u-${i}`}>Row {err.row}: {err.message}</li>
                                        ))}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* New Qualifications Table */}
                        {preview.qualifications.toInsert.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Badge className="bg-green-100 text-green-700">NEW</Badge>
                                        Qualifications to Insert
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Code</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Level</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {preview.qualifications.toInsert.map((q, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="font-mono">{q.code}</TableCell>
                                                    <TableCell>{q.name}</TableCell>
                                                    <TableCell>{q.level || '-'}</TableCell>
                                                    <TableCell>{q.status || 'current'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )}

                        {/* Updates Table */}
                        {preview.qualifications.toUpdate.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Badge className="bg-blue-100 text-blue-700">UPDATE</Badge>
                                        Qualifications to Update
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Code</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Level</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {preview.qualifications.toUpdate.map((q, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="font-mono">{q.code}</TableCell>
                                                    <TableCell>{q.name}</TableCell>
                                                    <TableCell>{q.level || '-'}</TableCell>
                                                    <TableCell>{q.status || 'current'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )}

                        {/* Import Button */}
                        {totalChanges > 0 && (
                            <div className="flex justify-end">
                                <Button onClick={handleImport} disabled={importing} size="lg">
                                    {importing ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Import {totalChanges} Record(s)
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </>
                )}

                {/* Result */}
                {result && (
                    <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-700">
                            Import complete! {result.inserted} inserted, {result.updated} updated, {result.errors} errors.
                            {result.errors === 0 && ' Redirecting...'}
                        </AlertDescription>
                    </Alert>
                )}
            </div>
        </main>
    );
}
