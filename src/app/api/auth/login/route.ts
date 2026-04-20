import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export async function POST(request: NextRequest) {
    const parsedBody = LoginSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
        return NextResponse.json({ error: 'Invalid login credentials.' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { error } = await supabase.auth.signInWithPassword({
        email: parsedBody.data.email,
        password: parsedBody.data.password,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ data: { ok: true } });
}
