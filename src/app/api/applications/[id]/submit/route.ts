import { NextRequest, NextResponse } from 'next/server';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
    await params;
    void request;

    return NextResponse.json(
        {
            error: 'Application submission is no longer required. New applications now enter Docs Review directly.',
        },
        { status: 410 }
    );
}
