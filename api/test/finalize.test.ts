import './testUtils';
import { FakeDynamo } from './fakeDynamo';
import { makeEvent } from './testUtils';
import { finalizeSession } from '../src/handlers/sessions';
import { orgKey, sessionKey, taskKey } from '../src/lib/keys';

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

test('finalize is rejected while an open review task exists', async () => {
  fake.seed('ReviewTasks', {
    sessionId: sessionKey('sess-1'),
    taskId: taskKey('task-1'),
    orgId: 'org-a',
    objectId: 'obj-1',
    reason: 'low confidence',
    status: 'OPEN',
  });

  const resp = await finalizeSession(makeEvent({ orgId: 'org-a', pathParameters: { id: 'sess-1' } }));
  expect((resp as { statusCode: number }).statusCode).toBe(409);
});

test('finalize succeeds once no open review tasks remain', async () => {
  fake.seed('ReviewTasks', {
    sessionId: sessionKey('sess-1'),
    taskId: taskKey('task-1'),
    orgId: 'org-a',
    objectId: 'obj-1',
    reason: 'low confidence',
    status: 'RESOLVED',
  });

  const resp = await finalizeSession(makeEvent({ orgId: 'org-a', pathParameters: { id: 'sess-1' } }));
  expect((resp as { statusCode: number }).statusCode).toBe(200);
  expect(parse(resp).state).toBe('FINAL');
});
