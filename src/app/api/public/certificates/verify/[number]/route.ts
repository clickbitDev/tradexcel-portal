import { NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/supabase/server';
import { fetchCertificateVerificationPayload } from '@/lib/certificates/server';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ number: string }> }
) {
    const { number } = await params;

    try {
        const payload = await fetchCertificateVerificationPayload(number, createAdminServerClient());
        if (!payload) {
            return NextResponse.json({ error: 'Certificate not found.' }, { status: 404 });
        }

        return NextResponse.json({ data: payload });
    } catch (error) {
        console.error('Certificate verification lookup failed:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unable to verify this certificate right now.' },
            { status: 500 }
        );
    }
}
