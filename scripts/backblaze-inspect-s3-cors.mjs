import { GetBucketCorsCommand } from '@aws-sdk/client-s3';
import { createBackblazeS3Client, getBackblazeEnv } from './backblaze-s3-utils.mjs';

const client = createBackblazeS3Client();
const env = getBackblazeEnv();

try {
  const result = await client.send(new GetBucketCorsCommand({
    Bucket: env.bucketName,
  }));

  console.log(JSON.stringify({
    bucketName: env.bucketName,
    endpoint: env.endpoint,
    region: env.region,
    corsRules: result.CORSRules || [],
  }, null, 2));
} catch (error) {
  if (error?.name === 'NoSuchCORSConfiguration') {
    console.log(JSON.stringify({
      bucketName: env.bucketName,
      endpoint: env.endpoint,
      region: env.region,
      corsRules: [],
      message: 'No S3 CORS configuration is currently set on the bucket.',
    }, null, 2));
    process.exit(0);
  }

  console.error(error?.name || 'BackblazeS3CorsInspectError');
  console.error(error?.message || String(error));
  process.exit(1);
}
