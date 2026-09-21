import { projectSummary } from '../src/lib/projection';
import type { CountEvent } from '../src/lib/types';

function ev(partial: Partial<CountEvent> & Pick<CountEvent, 'eventId' | 'type' | 'quantityDelta'>): CountEvent {
  return {
    sessionId: 'SESSION#s1',
    orgId: 'org-a',
    objectId: 'obj-1',
    actor: 'user-1',
    timestamp: new Date().toISOString(),
    ...partial,
  };
}

test('CONFIRM followed by REVERSE nets to zero and is dropped from visibleCounts', () => {
  const events: CountEvent[] = [
    ev({ eventId: 'e1', type: 'CONFIRM', sku: 'sku-1', quantityDelta: 1, timestamp: '2026-01-01T00:00:00.000Z' }),
    ev({ eventId: 'e2', type: 'REVERSE', sku: 'sku-1', quantityDelta: 1, reason: 'wrong id', timestamp: '2026-01-01T00:00:01.000Z' }),
  ];
  const summary = projectSummary('s1', events);
  expect(summary.visibleCounts).toEqual([]);
});

test('REASSIGN moves count from source sku to target sku', () => {
  const events: CountEvent[] = [
    ev({ eventId: 'e1', type: 'CONFIRM', sku: 'sku-1', quantityDelta: 2, timestamp: '2026-01-01T00:00:00.000Z' }),
    ev({
      eventId: 'e2',
      type: 'REASSIGN',
      fromSku: 'sku-1',
      sku: 'sku-2',
      quantityDelta: 1,
      reason: 'reclassified',
      timestamp: '2026-01-01T00:00:01.000Z',
    }),
  ];
  const summary = projectSummary('s1', events);
  expect(summary.visibleCounts).toEqual([
    { sku: 'sku-1', visibleCount: 1 },
    { sku: 'sku-2', visibleCount: 1 },
  ]);
});

test('summary note never claims stock-on-hand', () => {
  const summary = projectSummary('s1', []);
  expect(summary.note.toLowerCase()).not.toContain('stock on hand');
  expect(summary.note.toLowerCase()).toContain('visible-shelf');
});
