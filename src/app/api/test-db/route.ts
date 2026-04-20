import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const hasUrl = !!process.env.DATABASE_URL;
    const hasDirectUrl = !!process.env.DIRECT_URL;
    
    const urlMasked = process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 15) + '...' : 'missing';
    
    // Attempt a basic Prisma connection
    // We use a query that exists in the schema, e.g. getting the first RTO or just a basic raw query
    let connected = false;
    let queryError = null;
    
    try {
        await prisma.$queryRaw`SELECT 1`;
        connected = true;
    } catch (e: any) {
        queryError = {
            message: e.message,
            name: e.name,
            code: e.code
        };
    }

    return NextResponse.json({
      status: 'diagnostic_complete',
      env: {
          hasDatabaseUrl: hasUrl,
          hasDirectUrl: hasDirectUrl,
          maskedUrl: urlMasked,
      },
      db: {
          connected,
          queryError
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'fatal_error',
      message: error.message,
      name: error.name,
      stack: error.stack,
      hasUrl: !!process.env.DATABASE_URL
    }, { status: 500 });
  }
}
