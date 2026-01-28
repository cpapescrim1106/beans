import "server-only";

import {
  SQSClient,
  SendMessageCommand,
  type SendMessageCommandOutput,
} from "@aws-sdk/client-sqs";
import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REGION = process.env.BLUEPRINT_AWS_REGION ?? "us-east-2";

const credentials =
  process.env.BLUEPRINT_AWS_ACCESS_KEY_ID &&
  process.env.BLUEPRINT_AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.BLUEPRINT_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.BLUEPRINT_AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.BLUEPRINT_AWS_SESSION_TOKEN,
      }
    : undefined;

const sqsClient = new SQSClient({ region: REGION, credentials });
const s3Client = new S3Client({ region: REGION, credentials });

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} environment variable.`);
  }
  return value;
};

export async function sendReportMessage({
  messageBody,
  deduplicationId,
  groupId,
}: {
  messageBody: string;
  deduplicationId: string;
  groupId: string;
}): Promise<SendMessageCommandOutput> {
  const queueUrl = requireEnv("BLUEPRINT_SQS_QUEUE_URL");
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: messageBody,
    MessageDeduplicationId: deduplicationId,
    MessageGroupId: groupId,
  });
  return sqsClient.send(command);
}

export async function waitForReportObject({
  key,
  timeoutMs = 15000,
  intervalMs = 1000,
}: {
  key: string;
  timeoutMs?: number;
  intervalMs?: number;
}) {
  const bucket = process.env.BLUEPRINT_S3_BUCKET ?? "bp-temp-us";
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
      return { found: true, bucket, waitedMs: Date.now() - start };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;
      const name = (error as { name?: string }).name;
      if (status === 404 || name === "NotFound") {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        continue;
      }
      throw error;
    }
  }

  return { found: false, bucket, waitedMs: Date.now() - start };
}

export async function createReportDownloadUrl({
  key,
  expiresInSeconds = 600,
}: {
  key: string;
  expiresInSeconds?: number;
}) {
  const bucket = process.env.BLUEPRINT_S3_BUCKET ?? "bp-temp-us";
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const url = await getSignedUrl(s3Client, command, {
    expiresIn: expiresInSeconds,
  });
  return { url, bucket, expiresInSeconds };
}
