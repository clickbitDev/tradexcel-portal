import { GetBucketCorsCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { createBackblazeS3Client, getBackblazeEnv } from './backblaze-s3-utils.mjs';

const requestedOrigins = process.argv.slice(2).filter(Boolean);
const allowedOrigins = requestedOrigins.length > 0 ? requestedOrigins : ['http://localhost:3000'];

const corsRules = [
  {
    AllowedOrigins: allowedOrigins,
    AllowedMethods: ['GET', 'HEAD', 'PUT'],
    AllowedHeaders: ['*'],
    ExposeHeaders: ['ETag', 'x-amz-request-id', 'x-amz-id-2'],
    MaxAgeSeconds: 3600,
  },
];

const client = createBackblazeS3Client();
const env = getBackblazeEnv();

await client.send(new PutBucketCorsCommand({
  Bucket: env.bucketName,
  CORSConfiguration: {
    CORSRules: corsRules,
  },
}));

const verification = await client.send(new GetBucketCorsCommand({
  Bucket: env.bucketName,
}));

console.log(JSON.stringify({
  bucketName: env.bucketName,
  endpoint: env.endpoint,
  region: env.region,
  corsRules: verification.CORSRules || [],
}, null, 2));
