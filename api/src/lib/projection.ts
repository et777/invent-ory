import type { CountEvent, SessionSummary, SummaryLine } from './types';

const VISIBLE_SHELF_NOTE =
  'Visible-shelf observation snapshot. Not a full stock-on-hand figure; hidden or rear units are excluded.';

/**
 * The session summary is always derived by replaying CountEvents in order,
 * never read from a separately-mutated counter, so the ledger and its
 * projection cannot drift apart and every count is reproducible from the
 * audit trail.
 */
export function projectSummary(sessionId: string, events: CountEvent[]): SessionSummary {
  const sorted = [...events].sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp) || a.eventId.localeCompare(b.eventId)
  );

  const counts = new Map<string, number>();
  let unknownCount = 0;

  const addToSku = (sku: string | undefined, delta: number): void => {
    if (sku) {
      counts.set(sku, (counts.get(sku) ?? 0) + delta);
    } else {
      unknownCount += delta;
    }
  };

  for (const ev of sorted) {
    switch (ev.type) {
      case 'CONFIRM':
        addToSku(ev.sku, ev.quantityDelta);
        break;
      case 'REVERSE':
        addToSku(ev.sku ?? ev.fromSku, -ev.quantityDelta);
        break;
      case 'REASSIGN':
        addToSku(ev.fromSku, -ev.quantityDelta);
        addToSku(ev.sku, ev.quantityDelta);
        break;
      case 'MANUAL_ADJUST':
        addToSku(ev.sku, ev.quantityDelta);
        break;
    }
  }

  const visibleCounts: SummaryLine[] = Array.from(counts.entries())
    .filter(([, visibleCount]) => visibleCount !== 0)
    .map(([sku, visibleCount]) => ({ sku, visibleCount }))
    .sort((a, b) => a.sku.localeCompare(b.sku));

  return {
    sessionId,
    visibleCounts,
    unknownCount,
    coverageStatus: 'UNKNOWN',
    generatedAt: new Date().toISOString(),
    note: VISIBLE_SHELF_NOTE,
  };
}
