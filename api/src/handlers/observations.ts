import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { sessionKey, objectKey } from '../lib/keys';
import { requireOrgId, TenantAuthError } from '../lib/tenant';
import { loadOwnedSession } from '../lib/sessionGuard';
import { conditionalReplaceAtRevision } from '../lib/idempotency';
import { badRequest, notFound, ok, parseBody } from '../lib/http';
import { tableNames } from '../lib/ddb';
import type { BatchItemResult, Observation } from '../lib/types';

interface ObservationBatchItem {
  clientRequestId: string;
  objectId: string;
  revision: number;
  trackIds?: string[];
  shelfPosition?: { x: number; y: number; z?: number };
  candidateSkus?: Array<{ sku: string; score: number }>;
  evidenceKeys?: string[];
  state?: Observation['state'];
}

interface ObservationBatchRequest {
  items: ObservationBatchItem[];
}

const OBJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;

function looksLikeOpaqueId(objectId: string): boolean {
  // Reject obviously non-opaque identifiers such as raw filenames or bare frame numbers;
  // this is a shallow format check, not a guarantee of true object-identity stability.
  if (!OBJECT_ID_PATTERN.test(objectId)) return false;
  if (/\.(jpe?g|png|mp4|mov)$/i.test(objectId)) return false;
  if (/^\d+$/.test(objectId)) return false;
  return true;
}

export async function batchObservations(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
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

  const body = parseBody<ObservationBatchRequest>(event);
  if (!body?.items?.length) return badRequest('items array is required');

  const results: BatchItemResult[] = [];

  for (const item of body.items) {
    if (!item.objectId || !looksLikeOpaqueId(item.objectId)) {
      results.push({
        clientRequestId: item.clientRequestId,
        id: item.objectId ?? '(missing objectId)',
        status: 'rejected',
        reason: 'objectId must be an opaque client-generated identifier, not a filename or frame number',
      });
      continue;
    }
    if (typeof item.revision !== 'number') {
      results.push({ clientRequestId: item.clientRequestId, id: item.objectId, status: 'rejected', reason: 'revision is required' });
      continue;
    }

    const observation: Observation = {
      sessionId: sessionKey(sessionId),
      objectId: objectKey(item.objectId),
      orgId,
      trackIds: item.trackIds ?? [],
      shelfPosition: item.shelfPosition,
      candidateSkus: item.candidateSkus ?? [],
      evidenceKeys: item.evidenceKeys ?? [],
      state: item.state ?? 'PROVISIONAL',
      revision: item.revision,
      updatedAt: new Date().toISOString(),
    };

    // Optimistic concurrency: accepted only if this is the first write for this
    // objectId, or the previous revision matches. A stale write (someone else
    // already advanced the revision) is rejected rather than silently overwritten,
    // which is what keeps concurrent review edits from clobbering each other.
    const outcome = await conditionalReplaceAtRevision(
      { TableName: tableNames.observations(), Item: observation },
      'objectId',
      item.revision - 1
    );

    if (outcome === 'stale') {
      results.push({
        clientRequestId: item.clientRequestId,
        id: item.objectId,
        status: 'rejected',
        reason: 'stale revision: observation was updated concurrently',
      });
    } else {
      results.push({ clientRequestId: item.clientRequestId, id: item.objectId, status: 'accepted' });
    }
  }

  return ok({ results });
}
