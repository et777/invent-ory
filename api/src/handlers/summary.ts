import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, tableNames } from '../lib/ddb';
import { sessionKey } from '../lib/keys';
import { requireOrgId, TenantAuthError } from '../lib/tenant';
import { loadOwnedSession } from '../lib/sessionGuard';
import { badRequest, notFound, ok, text } from '../lib/http';
import { projectSummary } from '../lib/projection';
import type { CountEvent } from '../lib/types';

async function loadSummary(orgId: string, sessionId: string) {
  const session = await loadOwnedSession(orgId, sessionId);
  if (!session) return undefined;

  const result = await ddb.send(
    new QueryCommand({
      TableName: tableNames.countEvents(),
      KeyConditionExpression: 'sessionId = :sessionId',
      ExpressionAttributeValues: { ':sessionId': sessionKey(sessionId) },
    })
  );
  const events = (result.Items ?? []) as CountEvent[];
  return { session, summary: projectSummary(sessionId, events) };
}

export async function getSummary(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  let orgId: string;
  try {
    orgId = requireOrgId(event);
  } catch (err) {
    if (err instanceof TenantAuthError) return badRequest(err.message);
    throw err;
  }

  const sessionId = event.pathParameters?.id;
  if (!sessionId) return badRequest('Missing session id');

  const loaded = await loadSummary(orgId, sessionId);
  if (!loaded) return notFound('Session not found');

  return ok(loaded.summary);
}

export async function getExport(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  let orgId: string;
  try {
    orgId = requireOrgId(event);
  } catch (err) {
    if (err instanceof TenantAuthError) return badRequest(err.message);
    throw err;
  }

  const sessionId = event.pathParameters?.id;
  if (!sessionId) return badRequest('Missing session id');

  const loaded = await loadSummary(orgId, sessionId);
  if (!loaded) return notFound('Session not found');

  const format = event.queryStringParameters?.format ?? 'csv';
  const { session, summary } = loaded;
  const coverageStatus = session.state === 'FINAL' ? 'COMPLETE' : 'PARTIAL';

  if (format === 'json') {
    return ok({ ...summary, coverageStatus });
  }

  const header = 'sku,visibleCount,unknownCount,coverageStatus,generatedAt';
  const rows = summary.visibleCounts.map(
    (line) => `${line.sku},${line.visibleCount},${summary.unknownCount},${coverageStatus},${summary.generatedAt}`
  );
  if (rows.length === 0) {
    rows.push(`,0,${summary.unknownCount},${coverageStatus},${summary.generatedAt}`);
  }
  return text([header, ...rows].join('\n'));
}
