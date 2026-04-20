/**
 * Qualification schema readiness check
 *
 * Usage:
 *   npx tsx scripts/test-qualification-schema.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env', quiet: true });

type CheckResult = {
    name: string;
    passed: boolean;
    detail: string;
};

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    const results: CheckResult[] = [];

    const { error: baseError } = await supabase
        .from('qualifications')
        .select('id, code, name')
        .limit(1);

    results.push({
        name: 'Base qualifications query',
        passed: !baseError,
        detail: baseError
            ? `${baseError.code || 'NO_CODE'}: ${baseError.message}`
            : 'OK',
    });

    const { error: extendedError } = await supabase
        .from('qualifications')
        .select('id, prerequisites, certificate_preview_path')
        .limit(1);

    const missingColumns = extendedError?.code === '42703' || extendedError?.code === 'PGRST204';
    results.push({
        name: 'Extended qualification fields',
        passed: !extendedError,
        detail: extendedError
            ? `${extendedError.code || 'NO_CODE'}: ${extendedError.message}`
            : 'OK',
    });

    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    const hasApplicationsBucket = Boolean(buckets?.some((bucket) => bucket.name === 'applications'));

    results.push({
        name: 'Storage bucket: applications',
        passed: !bucketError && hasApplicationsBucket,
        detail: bucketError
            ? `${bucketError.message}`
            : hasApplicationsBucket
                ? 'OK'
                : 'Bucket not found',
    });

    console.log('Qualification Schema Readiness');
    console.log('================================');

    for (const result of results) {
        console.log(`${result.passed ? 'PASS' : 'FAIL'} - ${result.name}: ${result.detail}`);
    }

    if (missingColumns) {
        console.log('');
        console.log('Required fix: apply migration file');
        console.log('  supabase/migrations/047_qualification_prerequisites_certificate_preview.sql');
    }

    const failed = results.filter((result) => !result.passed).length;
    process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
    console.error('Fatal error running qualification schema test:', error);
    process.exit(1);
});
