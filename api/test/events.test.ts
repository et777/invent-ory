import './testUtils';
import { FakeDynamo } from './fakeDynamo';
import { makeEvent } from './testUtils';
import { batchEvents } from '../src/handlers/events';
import { getSummary } from '../src/handlers/summary';
import { orgKey, sessionKey } from '../src/lib/keys';

const fake = new FakeDynamo();

function seedSession(orgId: string, sessionId: string): void {
  fake.seed('Sessions', {
    orgId: orgKey(orgId),
    sessionId: sessionKey(sessionId),
    siteId: 'site1',
    zone: 'zoneA',
    deviceId: 'dev1',
    operatorId: 'op1',
    catalogVersion: 1,
    modelVersion: 'v1',
    state: 'ACTIVE',
    startedAt: new Date().toISOString(),
  });
}

beforeEach(() => {
  fake.reset();
  fake.install();
  seedSession('org-a', 'sess-1');
});

function parse(resp: unknown): any {
  return JSON.parse((resp as { body?: string }).body ?? '{}');
}

test('duplicate eventId in a retried batch is reported as duplicate and not double-applied', async () => {
  const batchBody = {
    items: [{ clientRequestId: 'c1', eventId: 'evt-1', objectId: 'obj-1', type: 'CONFIRM', sku: 'sku-1', quantityDelta: 1 }],
  };
  const requestEvent = makeEvent({ orgId: 'org-a', pathParameters: { id: 'sess-1' }, body: batchBody });

  const first = parse(await batchEvents(requestEvent));
  expect(first.results[0].status).toBe('accepted');

  const second = parse(await batchEvents(requestEvent));
  expect(second.results[0].status).toBe('duplicate');

  const summary = parse(await getSummary(makeEvent({ orgId: 'org-a', pathParameters: { id: 'sess-1' } })));
  expect(summary.visibleCounts).toEqual([{ sku: 'sku-1', visibleCount: 1 }]);
});

test('REASSIGN and REVERSE reach the ledger only through reason-carrying events', async () => {
  const missingReason = makeEvent({
    orgId: 'org-a',
    pathParameters: { id: 'sess-1' },
    body: { items: [{ clientRequestId: 'c1', eventId: 'evt-2', objectId: 'obj-1', type: 'REVERSE', sku: 'sku-1', quantityDelta: 1 }] },
  });
  const result = parse(await batchEvents(missingReason));
  expect(result.results[0].status).toBe('rejected');
});
