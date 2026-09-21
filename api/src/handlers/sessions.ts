import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, tableNames } from '../lib/ddb';
import { orgKey, sessionKey } from '../lib/keys';
import { requireOrgId, TenantAuthError } from '../lib/tenant';
import { loadOwnedSession } from '../lib/sessionGuard';
import { badRequest, conflict, notFound, ok, parseBody } from '../lib/http';
import type { ReviewTask, Session } from '../lib/types';

interface CreateSessionRequest {
  siteId: string;
  zone: string;
  shelf?: string;
  deviceId: string;
  operatorId: string;
  catalogVersion: number;
  modelVersion: string;
}

export async function createSession(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  let orgId: string;
  try {
    orgId = requireOrgId(event);
  } catch (err) {
    if (err instanceof TenantAuthError) return badRequest(err.message);
    throw err;
  }

  const body = parseBody<CreateSessionRequest>(event);
  if (!body?.siteId || !body.zone || !body.deviceId || !body.operatorId) {
    return badRequest('siteId, zone, deviceId and operatorId are required');
  }

  const sessionId = randomUUID();
  const now = new Date().toISOString();
  const session: Session = {
    orgId: orgKey(orgId),
    sessionId: sessionKey(sessionId),
    siteId: body.siteId,
    zone: body.zone,
    shelf: body.shelf,
    deviceId: body.deviceId,
    operatorId: body.operatorId,
    catalogVersion: body.catalogVersion,
    modelVersion: body.modelVersion,
    state: 'ACTIVE',
    startedAt: now,
  };
  await ddb.send(new PutCommand({ TableName: tableNames.sessions(), Item: session }));

  return ok({ ...session, orgId, sessionId }, 201);
}

export async function getSession(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  let orgId: string;
  try {
    orgId = requireOrgId(event);
  } catch (err) {
    if (err instanceof TenantAuthError) return badRequest(err.message);
    throw err;
  }

  const sessionId = event.pathParameters?.id;
  if (!sessionId) return badRequest('Missing session id');

  const session = await loadOwnedSession(orgId, sessionId);
  if (!session) return notFound('Session not found');

  return ok({ ...session, orgId, sessionId });
}

export async function finalizeSession(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  let orgId: string;
  try {
    orgId = requireOrgId(event);
  } catch (err) {
    if (err instanceof TenantAuthError) return badRequest(err.message);
    throw err;
  }

  const sessionId = event.pathParameters?.id;
  if (!sessionId) return badRequest('Missing session id');

  const session = await loadOwnedSession(orgId, sessionId);
  if (!session) return notFound('Session not found');

  const openTasks = await ddb.send(
    new QueryCommand({
      TableName: tableNames.reviewTasks(),
      KeyConditionExpression: 'sessionId = :sessionId',
      ExpressionAttributeValues: { ':sessionId': sessionKey(sessionId) },
    })
  );
  const tasks = (openTasks.Items ?? []) as ReviewTask[];
  const stillOpen = tasks.filter((t) => t.status === 'OPEN');
  if (stillOpen.length > 0) {
    return conflict(`Cannot finalize: ${stillOpen.length} open review task(s) remain`);
  }

  const now = new Date().toISOString();
  const updated: Session = { ...session, state: 'FINAL', endedAt: now };
  await ddb.send(new PutCommand({ TableName: tableNames.sessions(), Item: updated }));

  return ok({ ...updated, orgId, sessionId });
}
