import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    ArrowLeft,
    GraduationCap,
    ExternalLink,
    FileText,
    BookOpen,
    ImageIcon,
} from 'lucide-react';
import Link from 'next/link';
import { CertificatePreviewDialog } from '@/components/qualifications/CertificatePreviewDialog';
import { getQualificationPreviewAccessUrl } from '@/lib/storage/applications-server';

export default async function QualificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createServerClient();

    // Fetch qualification with editor info
    const [qualificationResult, unitsResult, priceListResult] = await Promise.all([
        supabase
            .from('qualifications')
            .select('*')
            .eq('id', id)
            .single(),
        supabase
            .from('qualification_units')
            .select('*')
            .eq('qualification_id', id)
            .eq('is_current', true)
            .order('unit_type')
            .order('unit_code'),
        supabase
            .from('rto_offerings')
            .select('*')
            .eq('qualification_id', id)
            .eq('is_active', true)
            .eq('is_deleted', false)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    const qualification = qualificationResult.data;
    const units = unitsResult.data || [];
    const priceList = priceListResult.data;

    // Fetch last editor's name if available
    let lastEditorName: string | null = null;
    if (qualification?.last_edited_by) {
        const { data: editor } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', qualification.last_edited_by)
            .single();
        lastEditorName = editor?.full_name || null;
    }

    if (!qualification) {
        return (
            <main className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-2">Qualification not found</h2>
                    <Link href="/portal/qualifications">
                        <Button variant="outline">Back to Qualifications</Button>
                    </Link>
                </div>
            </main>
        );
    }

    const rawPrerequisites: unknown[] = Array.isArray(qualification.prerequisites)
        ? qualification.prerequisites
        : [];

    const prerequisites = rawPrerequisites.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0
    );

    const certificatePreviewUrl = await getQualificationPreviewAccessUrl(qualification, supabase);

    const STATUS_COLORS: Record<string, string> = {
        current: 'bg-green-100 text-green-700',
        superseded: 'bg-yellow-100 text-yellow-700',
        deleted: 'bg-red-100 text-red-700',
    };

    const formatCurrency = (amount: number | null) => {
        if (amount === null) return '-';
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
        }).format(amount);
    };

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/portal/qualifications">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                                <GraduationCap className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-xl font-semibold text-foreground">{qualification.code}</h1>
                                    <Badge className={STATUS_COLORS[qualification.status]}>{qualification.status}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{qualification.name}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href={`/portal/qualifications/${qualification.id}/edit`}>
                            <Button variant="outline" size="sm">
                                Edit
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Details Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Qualification Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Code</p>
                                        <p className="font-medium font-mono">{qualification.code}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Level</p>
                                        <p className="font-medium">{qualification.level || '-'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-sm text-muted-foreground">Name</p>
                                        <p className="font-medium">{qualification.name}</p>
                                    </div>
                                    {qualification.cricos_code && (
                                        <div>
                                            <p className="text-sm text-muted-foreground">CRICOS Code</p>
                                            <p className="font-medium">{qualification.cricos_code}</p>
                                        </div>
                                    )}
                                    {qualification.release_date && (
                                        <div>
                                            <p className="text-sm text-muted-foreground">Release Date</p>
                                            <p className="font-medium">{new Date(qualification.release_date).toLocaleDateString()}</p>
                                        </div>
                                    )}
                                    {qualification.superseded_by && (
                                        <div className="col-span-2">
                                            <p className="text-sm text-muted-foreground">Superseded By</p>
                                            <p className="font-medium text-yellow-700">{qualification.superseded_by}</p>
                                        </div>
                                    )}
                                    {qualification.entry_requirements && (
                                        <div className="col-span-2">
                                            <p className="text-sm text-muted-foreground">Entry Requirements</p>
                                            <p className="font-medium">{qualification.entry_requirements}</p>
                                        </div>
                                    )}
                                    {qualification.delivery_mode && qualification.delivery_mode.length > 0 && (
                                        <div className="col-span-2">
                                            <p className="text-sm text-muted-foreground mb-2">Delivery Mode</p>
                                            <div className="flex flex-wrap gap-2">
                                                {qualification.delivery_mode.map((mode: string) => (
                                                    <Badge key={mode} variant="secondary" className="capitalize">
                                                        {mode.replace(/_/g, ' ')}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Entry Requirements & TGA Link */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        Entry Requirements
                                    </CardTitle>
                                    <a
                                        href={`https://training.gov.au/Training/Details/${qualification.code}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Button variant="outline" size="sm">
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            View on TGA
                                        </Button>
                                    </a>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {qualification.entry_requirements ? (
                                    <div className="prose prose-sm max-w-none">
                                        <p className="text-sm text-foreground whitespace-pre-wrap">
                                            {qualification.entry_requirements}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-muted-foreground">
                                        <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                        <p>No entry requirements defined</p>
                                        <p className="text-xs mt-1">Check TGA for detailed requirements</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Prerequisites */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BookOpen className="h-5 w-5" />
                                    Prerequisites
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {prerequisites.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-2">
                                        {prerequisites.map((item, index) => (
                                            <li key={`${item}-${index}`} className="text-sm text-foreground">
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-center py-6 text-muted-foreground">
                                        <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                        <p>No prerequisites defined</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Certificate Preview */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ImageIcon className="h-5 w-5" />
                                    Certificate Preview
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {certificatePreviewUrl ? (
                                    <CertificatePreviewDialog
                                        imageUrl={certificatePreviewUrl}
                                        qualificationCode={qualification.code}
                                    />
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                        <p>No certificate preview image uploaded</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Price List */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <GraduationCap className="h-5 w-5" />
                                    Qualification Price List
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {priceList ? (
                                    <div className="overflow-x-auto rounded-md border">
                                        <Table className="min-w-[1900px]">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="text-right">Assessor Fee</TableHead>
                                                    <TableHead className="text-right">Provider Fee</TableHead>
                                                    <TableHead className="text-right">Agent Fee</TableHead>
                                                    <TableHead className="text-right">Student Fee</TableHead>
                                                    <TableHead className="text-right">Enrollment</TableHead>
                                                    <TableHead className="text-right">Material</TableHead>
                                                    <TableHead className="text-right">Application</TableHead>
                                                    <TableHead className="text-right">Misc</TableHead>
                                                    <TableHead className="text-right">Tuition (Onshore)</TableHead>
                                                    <TableHead className="text-right">Tuition (Miscellaneous)</TableHead>
                                                    <TableHead className="text-right font-semibold">Total (Onshore)</TableHead>
                                                    <TableHead className="text-right font-semibold">Total (Miscellaneous)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(() => {
                                                    const sharedFees =
                                                        (priceList.assessor_fee || 0) +
                                                        (priceList.provider_fee || 0) +
                                                        (priceList.agent_fee || 0) +
                                                        (priceList.student_fee || 0) +
                                                        (priceList.enrollment_fee || 0) +
                                                        (priceList.material_fee || 0) +
                                                        (priceList.application_fee || 0) +
                                                        (priceList.misc_fee || 0);
                                                    const hasAnyFee = priceList.tuition_fee_onshore !== null
                                                        || priceList.tuition_fee_miscellaneous !== null
                                                        || priceList.material_fee !== null
                                                        || priceList.application_fee !== null
                                                        || priceList.assessor_fee !== null
                                                        || priceList.provider_fee !== null
                                                        || priceList.agent_fee !== null
                                                        || priceList.student_fee !== null
                                                        || priceList.enrollment_fee !== null
                                                        || priceList.misc_fee !== null;

                                                    return (
                                                        <TableRow>
                                                            <TableCell className="text-right">{formatCurrency(priceList.assessor_fee)}</TableCell>
                                                            <TableCell className="text-right">{formatCurrency(priceList.provider_fee)}</TableCell>
                                                            <TableCell className="text-right">{formatCurrency(priceList.agent_fee)}</TableCell>
                                                            <TableCell className="text-right">{formatCurrency(priceList.student_fee)}</TableCell>
                                                            <TableCell className="text-right">{formatCurrency(priceList.enrollment_fee)}</TableCell>
                                                            <TableCell className="text-right">{formatCurrency(priceList.material_fee)}</TableCell>
                                                            <TableCell className="text-right">{formatCurrency(priceList.application_fee)}</TableCell>
                                                            <TableCell className="text-right">{formatCurrency(priceList.misc_fee)}</TableCell>
                                                            <TableCell className="text-right">{formatCurrency(priceList.tuition_fee_onshore)}</TableCell>
                                                            <TableCell className="text-right">{formatCurrency(priceList.tuition_fee_miscellaneous)}</TableCell>
                                                            <TableCell className="text-right font-semibold">
                                                                {hasAnyFee ? formatCurrency(sharedFees + (priceList.tuition_fee_onshore || 0)) : '-'}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold">
                                                                {hasAnyFee ? formatCurrency(sharedFees + (priceList.tuition_fee_miscellaneous || 0)) : '-'}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })()}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                        <p>No price list defined for this qualification yet</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Units Summary */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-muted-foreground">Units Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Core Units</span>
                                    <span className="font-semibold">
                                        {qualification.core_units ?? units.filter((u: { unit_type: string | null }) => u.unit_type === 'core').length}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Elective Units</span>
                                    <span className="font-semibold">
                                        {qualification.elective_units ?? units.filter((u: { unit_type: string | null }) => u.unit_type === 'elective').length}
                                    </span>
                                </div>
                                <div className="flex justify-between border-t pt-3">
                                    <span className="text-sm text-muted-foreground">Total Units</span>
                                    <span className="font-bold">{qualification.total_units ?? units.length}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Stats */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-muted-foreground">Statistics</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Price List</span>
                                    <span className="font-semibold">{priceList ? 'Configured' : 'Missing'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Created</span>
                                    <span>{new Date(qualification.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Updated</span>
                                    <span>{new Date(qualification.updated_at).toLocaleDateString()}</span>
                                </div>
                                {lastEditorName && (
                                    <div className="flex justify-between border-t pt-3">
                                        <span className="text-muted-foreground">Last Edited By</span>
                                        <span className="font-medium">{lastEditorName}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </main>
    );
}
