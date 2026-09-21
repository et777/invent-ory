import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { PutCommand, PutCommandInput } from '@aws-sdk/lib-dynamodb';
import { ddb } from './ddb';

export type PutOutcome = 'accepted' | 'duplicate';

/**
 * Conditional put keyed on attribute_not_exists(<sortKeyAttr>). This is the
 * single mechanism that makes retried event/observation batches safe: a
 * network retry that resends an already-applied write hits this condition,
 * is reported as `duplicate` here, and is never re-applied by the caller.
 * Do not remove or weaken this condition — every idempotency guarantee in
 * the ledger depends on it.
 */
export async function conditionalCreate(
  input: Omit<PutCommandInput, 'ConditionExpression'>,
  sortKeyAttr: string
): Promise<PutOutcome> {
  try {
    await ddb.send(
      new PutCommand({
        ...input,
        ConditionExpression: `attribute_not_exists(${sortKeyAttr})`,
      })
    );
    return 'accepted';
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return 'duplicate';
    }
    throw err;
  }
}

export type RevisionPutOutcome = 'accepted' | 'stale';

/**
 * Optimistic-concurrency put: succeeds only if the item does not yet exist,
 * or its stored `revision` equals `expectedRevision`. Prevents concurrent
 * review edits from silently clobbering each other.
 */
export async function conditionalReplaceAtRevision(
  input: Omit<PutCommandInput, 'ConditionExpression' | 'ExpressionAttributeValues'>,
  sortKeyAttr: string,
  expectedRevision: number
): Promise<RevisionPutOutcome> {
  try {
    await ddb.send(
      new PutCommand({
        ...input,
        ConditionExpression: `attribute_not_exists(${sortKeyAttr}) OR revision = :expectedRevision`,
        ExpressionAttributeValues: { ':expectedRevision': expectedRevision },
      })
    );
    return 'accepted';
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return 'stale';
    }
    throw err;
  }
}
