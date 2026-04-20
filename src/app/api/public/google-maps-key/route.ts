import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const apiKey =
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY ||
        '';

    if (!apiKey) {
        return NextResponse.json({ apiKey: null }, { status: 404 });
    }

    return NextResponse.json(
        { apiKey },
        {
            headers: {
                'Cache-Control': 'no-store',
            },
        }
    );
}
