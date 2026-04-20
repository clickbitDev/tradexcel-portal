import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    void request;

    return NextResponse.json(
        {
            error: 'Qualification price lists are no longer linked to RTO records. Use the qualification price list editor instead.',
        },
        { status: 410 }
    );
}
