import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, tableNames } from './ddb';
import { orgKey, sessionKey } from './keys';
import type { Session } from './types';

/**
 * Observations/CountEvents/ReviewTasks are keyed only by sessionId (per the
 * spec's data contracts), not by orgId. Ownership of the sessionId itself is
 * therefore the sole tenant-isolation gate for every nested resource: load
 * the session scoped to the caller's orgId first, and treat "belongs to a
 * different org" identically to "does not exist" so tenants cannot
 * distinguish the two cases.
 */
export async function loadOwnedSession(orgId: string, sessionId: string): Promise<Session | undefined> {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableNames.sessions(),
      Key: { orgId: orgKey(orgId), sessionId: sessionKey(sessionId) },
    })
  );
  return result.Item as Session | undefined;
}
