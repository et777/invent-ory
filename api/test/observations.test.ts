import './testUtils';
import { FakeDynamo } from './fakeDynamo';
import { makeEvent } from './testUtils';
import { batchObservations } from '../src/handlers/observations';
import { orgKey, sessionKey } from '../src/lib/keys';

const fake = new FakeDynamo();

function parse(resp: unknown): any {
  return JSON.parse((resp as { body?: string }).body ?? '{}');
}

beforeEach(() => {
  fake.reset();
  fake.install();
  fake.seed('Sessions', {
    orgId: orgKey('org-a'),
    sessionId: sessionKey('sess-1'),
    siteId: 'site1',
    zone: 'zoneA',
    deviceId: 'dev1',
    operatorId: 'op1',
    catalogVersion: 1,
    modelVersion: 'v1',
    state: 'ACTIVE',
    startedAt: new Date().toISOString(),
  });
});

test('optimistic revision check rejects a stale write and accepts a correctly-sequenced one', async () => {
  const create = makeEvent({
    orgId: 'org-a',
    pathParameters: { id: 'sess-1' },
    body: { items: [{ clientRequestId: 'c1', objectId: 'obj-abc123', revision: 1, state: 'PROVISIONAL' }] },
  });
  const createResult = parse(await batchObservations(create));
  expect(createResult.results[0].status).toBe('accepted');

  // stale: someone else already wrote revision 1; resubmitting revision 1 again is stale
  const stale = makeEvent({
    orgId: 'org-a',
    pathParameters: { id: 'sess-1' },
    body: { items: [{ clientRequestId: 'c2', objectId: 'obj-abc123', revision: 1, state: 'CONFIRMED' }] },
  });
  const staleResult = parse(await batchObservations(stale));
  expect(staleResult.results[0].status).toBe('rejected');

  // correctly sequenced: revision 2 follows the currently stored revision 1
  const next = makeEvent({
    orgId: 'org-a',
    pathParameters: { id: 'sess-1' },
    body: { items: [{ clientRequestId: 'c3', objectId: 'obj-abc123', revision: 2, state: 'CONFIRMED' }] },
  });
  const nextResult = parse(await batchObservations(next));
  expect(nextResult.results[0].status).toBe('accepted');
});

test('a filename-shaped objectId is rejected as not opaque', async () => {
  const event = makeEvent({
    orgId: 'org-a',
    pathParameters: { id: 'sess-1' },
    body: { items: [{ clientRequestId: 'c1', objectId: 'frame_00042.jpg', revision: 1 }] },
  });
  const result = parse(await batchObservations(event));
  expect(result.results[0].status).toBe('rejected');
});
