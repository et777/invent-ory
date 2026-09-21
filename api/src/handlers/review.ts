import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, tableNames } from '../lib/ddb';
import { sessionKey, taskKey, eventKey } from '../lib/keys';
import { requireOrgId, requireActor, TenantAuthError } from '../lib/tenant';
import { loadOwnedSession } from '../lib/sessionGuard';
import { conditionalCreate } from '../lib/idempotency';
import { badRequest, notFound, ok, parseBody } from '../lib/http';
import type { CountEvent, ReviewTask } from '../lib/types';

export async function listReviewTasks(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
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

  const result = await ddb.send(
    new QueryCommand({
      TableName: tableNames.reviewTasks(),
      KeyConditionExpression: 'sessionId = :sessionId',
      ExpressionAttributeValues: { ':sessionId': sessionKey(sessionId) },
    })
  );
  const tasks = (result.Items ?? []) as ReviewTask[];
  return ok({ tasks });
}

interface ReviewDecisionRequest {
  taskId: string;
  decision: 'REASSIGN' | 'MANUAL_ADJUST' | 'DISMISS';
  eventId: string;
  objectId: string;
  sku?: string;
  fromSku?: string;
  quantityDelta?: number;
  reason: string;
}

export async function postReviewDecisions(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  let orgId: string;
  let actor: string;
  try {
    orgId = requireOrgId(event);
    actor = requireActor(event);
  } catch (err) {
    if (err instanceof TenantAuthError) return badRequest(err.message);
    throw err;
  }

  const sessionId = event.pathParameters?.id;
  if (!sessionId) return badRequest('Missing session id');

  const session = await loadOwnedSession(orgId, sessionId);
  if (!session) return notFound('Session not found');

  const body = parseBody<ReviewDecisionRequest>(event);
  if (!body?.taskId || !body.decision || !body.reason) {
    return badRequest('taskId, decision and reason are required');
  }

  const existingTask = await ddb.send(
    new QueryCommand({
      TableName: tableNames.reviewTasks(),
      KeyConditionExpression: 'sessionId = :sessionId AND taskId = :taskId',
      ExpressionAttributeValues: {
        ':sessionId': sessionKey(sessionId),
        ':taskId': taskKey(body.taskId),
      },
    })
  );
  const task = (existingTask.Items ?? [])[0] as ReviewTask | undefined;
  if (!task) return notFound('Review task not found');

  const now = new Date().toISOString();
  let resultingEventId: string | undefined;

  if (body.decision !== 'DISMISS') {
    if (!body.eventId || !body.objectId || typeof body.quantityDelta !== 'number') {
      return badRequest('eventId, objectId and quantityDelta are required for REASSIGN/MANUAL_ADJUST decisions');
    }
    // Review decisions must produce a real ledger event through the same
    // idempotent conditional-create path as any other event write, never a
    // side-channel mutation, so review actions remain part of the auditable
    // count history and safe to retry.
    const countEvent: CountEvent = {
      sessionId: sessionKey(sessionId),
      eventId: eventKey(body.eventId),
      orgId,
      objectId: body.objectId,
      type: body.decision,
      sku: body.sku,
      fromSku: body.fromSku,
      quantityDelta: body.quantityDelta,
      actor,
      reason: body.reason,
      timestamp: now,
    };
    await conditionalCreate({ TableName: tableNames.countEvents(), Item: countEvent }, 'eventId');
    resultingEventId = body.eventId;
  }

  const updatedTask: ReviewTask = {
    ...task,
    status: body.decision === 'DISMISS' ? 'DISMISSED' : 'RESOLVED',
    reviewerDecision: { actor, decidedAt: now, reason: body.reason, resultingEventId },
  };
  await ddb.send(new PutCommand({ TableName: tableNames.reviewTasks(), Item: updatedTask }));

  return ok({ task: updatedTask });
}
