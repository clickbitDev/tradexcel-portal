import { NextRequest, NextResponse } from 'next/server';
import { authorizeCertificateRequest } from '@/lib/certificates/server';
import { createAdminServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorizeCertificateRequest({
    request,
    permissionKey: 'certificates.manage',
  });

  if (!authResult.ok) {
    return authResult.response;
  }

  const { adminSupabase } = authResult.context;

  // Fetch certificate record
  const { data: certificateRecord, error: certificateError } = await adminSupabase
    .from('certificate_records')
    .select('id, unlocked_document_id, request_payload, certificate_number, document_id')
    .eq('id', params.id)
    .maybeSingle();

  if (certificateError || !certificateRecord) {
    return NextResponse.json(
      { error: 'Certificate not found' },
      { status: 404 }
    );
  }

  // If unlocked document exists, redirect to document download
  if (certificateRecord.unlocked_document_id) {
    return NextResponse.redirect(
      new URL(`/api/storage/documents/${certificateRecord.unlocked_document_id}/content`, request.url)
    );
  }

  // For legacy certificates without unlocked_document_id, regenerate on-demand
  if (!certificateRecord.request_payload) {
    return NextResponse.json(
      { error: 'Cannot regenerate unlocked certificate: missing request payload' },
      { status: 400 }
    );
  }

  try {
    const { generateCertificate } = await import('@/lib/pdf/certificate-generator');
    const requestPayload = certificateRecord.request_payload as any;

    const ownerPassword = process.env.OWNER_PASSWORD;
    if (!ownerPassword) {
      return NextResponse.json(
        { error: 'OWNER_PASSWORD not configured' },
        { status: 500 }
      );
    }

    const certificateResult = await generateCertificate({
      certificateNumber: certificateRecord.certificate_number,
      clientName: requestPayload.application.studentName,
      certificateTitle: requestPayload.certificateTitle,
      qualificationCode: requestPayload.application.qualificationCode || undefined,
      issueDate: requestPayload.issueDate,
      keyDetails: requestPayload.keyDetails,
      verificationUrl: requestPayload.verificationUrl || undefined,
      units: requestPayload.includeTranscript && requestPayload.transcriptRows?.length > 0
        ? requestPayload.transcriptRows.map((row: any) => ({
            unitCode: row.unitCode,
            unitTitle: row.unitTitle,
            result: row.result,
            year: row.year,
          }))
        : undefined,
      ownerPassword,
    });

    const pdfBuffer = Buffer.from(certificateResult.pdf, 'base64');

    // Optionally backfill by storing the unlocked document
    // This is optional - for now, just return the PDF

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${certificateRecord.certificate_number}_Unlocked.pdf"`,
      },
    });
  } catch (error) {
    console.error('Failed to regenerate unlocked certificate:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate unlocked certificate' },
      { status: 500 }
    );
  }
}
