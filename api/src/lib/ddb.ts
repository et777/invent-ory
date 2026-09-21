import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});

export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const tableNames = {
  products: () => requireEnv('PRODUCTS_TABLE'),
  sessions: () => requireEnv('SESSIONS_TABLE'),
  observations: () => requireEnv('OBSERVATIONS_TABLE'),
  countEvents: () => requireEnv('COUNT_EVENTS_TABLE'),
  reviewTasks: () => requireEnv('REVIEW_TASKS_TABLE'),
};

export function evidenceBucket(): string {
  return requireEnv('EVIDENCE_BUCKET');
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
