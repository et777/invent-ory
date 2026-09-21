import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { sessionKey, eventKey } from '../lib/keys';
import { requireOrgId, requireActor, TenantAuthError } from '../lib/tenant';
import { loadOwnedSession } from '../lib/sessionGuard';
import { conditionalCreate } from '../lib/idempotency';
import { badRequest, notFound, ok, parseBody } from '../lib/http';
import { tableNames } from '../lib/ddb';
import type { BatchItemResult, CountEvent, EventType } from '../lib/types';

interface EventBatchItem {
  clientRequestId: string;
  eventId: string;
  objectId: string;
  type: EventType;
  sku?: string;
  fromSku?: string;
  quantityDelta: number;
  reason?: string;
  evidence?: string[];
  timestamp?: string;
}

interface EventBatchRequest {
  items: EventBatchItem[];
}

const REASON_REQUIRED_TYPES: EventType[] = ['REVERSE', 'REASSIGN', 'MANUAL_ADJUST'];

export async function batchEvents(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
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

  const body = parseBody<EventBatchRequest>(event);
  if (!body?.items?.length) return badRequest('items array is required');

  const results: BatchItemResult[] = [];

  for (const item of body.items) {
    if (!item.eventId || !item.objectId || !item.type || typeof item.quantityDelta !== 'number') {
      results.push({
        clientRequestId: item.clientRequestId,
        id: item.eventId ?? '(missing eventId)',
        status: 'rejected',
        reason: 'eventId, objectId, type and quantityDelta are required',
      });
      continue;
    }
    if (REASON_REQUIRED_TYPES.includes(item.type) && !item.reason) {
      results.push({
        clientRequestId: item.clientRequestId,
        id: item.eventId,
        status: 'rejected',
        reason: `reason is required for event type ${item.type}`,
      });
      continue;
    }
    if (item.type === 'REASSIGN' && (!item.sku || !item.fromSku)) {
      results.push({
        clientRequestId: item.clientRequestId,
        id: item.eventId,
        status: 'rejected',
        reason: 'REASSIGN requires both sku (target) and fromSku (source)',
      });
      continue;
    }

    const countEvent: CountEvent = {
      sessionId: sessionKey(sessionId),
      eventId: eventKey(item.eventId),
      orgId,
      objectId: item.objectId,
      type: item.type,
      sku: item.sku,
      fromSku: item.fromSku,
      quantityDelta: item.quantityDelta,
      actor,
      reason: item.reason,
      evidence: item.evidence,
      timestamp: item.timestamp ?? new Date().toISOString(),
    };

    // This conditional put on attribute_not_exists(eventId) is the single
    // correctness-critical line in this handler: it is what makes retried
    // batches safe. A network retry that resends an eventId already applied
    // will fail this condition, be reported as `duplicate` below, and will
    // NOT be re-applied to the ledger. Do not replace this with a plain Put.
    const outcome = await conditionalCreate({ TableName: tableNames.countEvents(), Item: countEvent }, 'eventId');

    results.push({
      clientRequestId: item.clientRequestId,
      id: item.eventId,
      status: outcome === 'accepted' ? 'accepted' : 'duplicate',
    });
  }

  return ok({ results });
}
