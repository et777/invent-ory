import './testUtils';
import { FakeDynamo } from './fakeDynamo';
import { makeEvent } from './testUtils';
import { getSession } from '../src/handlers/sessions';
import { batchEvents } from '../src/handlers/events';
import { orgKey, sessionKey } from '../src/lib/keys';

const fake = new FakeDynamo();

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

test('org B cannot read org A session by id', async () => {
  const asOwner = await getSession(makeEvent({ orgId: 'org-a', pathParameters: { id: 'sess-1' } }));
  expect((asOwner as { statusCode: number }).statusCode).toBe(200);

  const asOther = await getSession(makeEvent({ orgId: 'org-b', pathParameters: { id: 'sess-1' } }));
  expect((asOther as { statusCode: number }).statusCode).toBe(404);
});

test('org B cannot write events into org A session', async () => {
  const body = { items: [{ clientRequestId: 'c1', eventId: 'evt-1', objectId: 'obj-1', type: 'CONFIRM', sku: 'sku-1', quantityDelta: 1 }] };
  const resp = await batchEvents(makeEvent({ orgId: 'org-b', pathParameters: { id: 'sess-1' }, body }));
  expect((resp as { statusCode: number }).statusCode).toBe(404);
});
