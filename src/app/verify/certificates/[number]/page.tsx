import Link from 'next/link';
import { ShieldCheck, ShieldX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createAdminServerClient } from '@/lib/supabase/server';
import { fetchCertificateVerificationPayload } from '@/lib/certificates/server';

export const dynamic = 'force-dynamic';
function formatDate(value: string): string {
    return new Date(value).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export default async function CertificateVerificationPage({
    params,
}: {
    params: Promise<{ number: string }>;
}) {
    const { number } = await params;
    const certificate = await fetchCertificateVerificationPayload(number, createAdminServerClient());

    if (!certificate) {
        return (
            <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-6">
                <Card className="w-full">
                    <CardContent className="py-16 text-center">
                        <ShieldX className="mx-auto mb-4 h-12 w-12 text-destructive" />
                        <h1 className="text-2xl font-semibold">Certificate not found</h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            We could not verify a certificate with number `{number}`.
                        </p>
                        <div className="mt-6">
                            <Button nativeButton={false} render={<Link href="/" />}>
                                Return home
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </main>
        );
    }

    const isActive = certificate.status === 'active';

    return (
        <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center p-6">
            <Card className="w-full">
                <CardHeader className="space-y-4 text-center">
                    {isActive ? (
                        <ShieldCheck className="mx-auto h-12 w-12 text-emerald-600" />
                    ) : (
                        <ShieldX className="mx-auto h-12 w-12 text-amber-600" />
                    )}
                    <div>
                        <CardTitle className="text-2xl">Edward Business College Certificate Verification</CardTitle>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Certificate number: <span className="font-medium text-foreground">{certificate.certificateNumber}</span>
                        </p>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex justify-center">
                        <Badge variant={isActive ? 'default' : 'secondary'}>
                            {certificate.status === 'active' ? 'Verified Active Certificate' : `Certificate ${certificate.status}`}
                        </Badge>
                    </div>

                    <div className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
                        <div>
                            <p className="text-sm text-muted-foreground">Student</p>
                            <p className="font-medium">{certificate.studentName}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Application ID</p>
                            <p className="font-medium">{certificate.applicationNumber}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Qualification</p>
                            <p className="font-medium">{certificate.qualificationName || certificate.certificateTitle}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Qualification Code</p>
                            <p className="font-medium">{certificate.qualificationCode || '-'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Issue Date</p>
                            <p className="font-medium">{formatDate(certificate.issueDate)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Version</p>
                            <p className="font-medium">v{certificate.version}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Transcript Included</p>
                            <p className="font-medium">{certificate.includesTranscript ? 'Yes' : 'No'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Generated</p>
                            <p className="font-medium">{formatDate(certificate.generatedAt)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
