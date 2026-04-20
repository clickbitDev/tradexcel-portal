import 'dotenv/config';
import { S3Client } from '@aws-sdk/client-s3';

function readRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getBackblazeEnv() {
  return {
    accessKeyId: readRequiredEnv('BACKBLAZE_ACCESS_KEY_ID'),
    secretAccessKey: readRequiredEnv('BACKBLAZE_SECRET_ACCESS_KEY'),
    bucketName: readRequiredEnv('BACKBLAZE_APPLICATION_BUCKETNAME'),
    endpoint: readRequiredEnv('BACKBLAZE_BUCKET_ENDPOINT').replace(/\/+$/, ''),
    region: readRequiredEnv('BACKBLAZE_BUCKET_REGION'),
  };
}

export function createBackblazeS3Client() {
  const env = getBackblazeEnv();

  return new S3Client({
    endpoint: env.endpoint,
    region: env.region,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
    forcePathStyle: true,
  });
}
