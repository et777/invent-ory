import type { Observation, ReviewTask, Session, SessionSummary } from './types'

export const MOCK_SESSIONS: Session[] = [
  {
    sessionId: 'sess-active-001',
    siteId: 'site-toronto-01',
    zone: 'Aisle 4',
    shelf: 'Shelf B',
    deviceId: 'device-iphone-14',
    operatorId: 'op-jsmith',
    catalogVersion: 'catalog-v3',
    modelVersion: 'model-v0.4.0',
    state: 'ACTIVE',
    startedAt: '2026-09-19T14:02:00Z',
    endedAt: null,
    coverageStatus: 'UNKNOWN',
  },
  {
    sessionId: 'sess-review-002',
    siteId: 'site-toronto-01',
    zone: 'Aisle 4',
    shelf: 'Shelf B',
    deviceId: 'device-iphone-14',
    operatorId: 'op-jsmith',
    catalogVersion: 'catalog-v3',
    modelVersion: 'model-v0.4.0',
    state: 'REVIEW',
    startedAt: '2026-09-18T09:15:00Z',
    endedAt: '2026-09-18T09:41:00Z',
    coverageStatus: 'GAPS_DETECTED',
  },
  {
    sessionId: 'sess-final-003',
    siteId: 'site-toronto-01',
    zone: 'Aisle 2',
    shelf: 'Shelf A',
    deviceId: 'device-iphone-14',
    operatorId: 'op-akumar',
    catalogVersion: 'catalog-v2',
    modelVersion: 'model-v0.3.1',
    state: 'FINAL',
    startedAt: '2026-09-10T11:00:00Z',
    endedAt: '2026-09-10T11:22:00Z',
    coverageStatus: 'COMPLETE',
  },
]

export const MOCK_OBSERVATIONS: Record<string, Observation[]> = {
  'sess-review-002': [
    {
      objectId: 'obj-0001',
      sessionId: 'sess-review-002',
      trackIds: ['trk-01', 'trk-02'],
      shelfPosition: 'x:0.12,y:0.44',
      candidateSkus: [{ sku: 'SKU-1001', name: 'Cereal 500g', score: 0.94 }],
      assignedSku: 'SKU-1001',
      evidenceKeys: ['evidence/obj-0001/crop-1.jpg', 'evidence/obj-0001/crop-2.jpg'],
      state: 'CONFIRMED',
      confidence: 0.94,
      revision: 1,
    },
    {
      objectId: 'obj-0002',
      sessionId: 'sess-review-002',
      trackIds: ['trk-03'],
      shelfPosition: 'x:0.30,y:0.44',
      candidateSkus: [
        { sku: 'SKU-1002', name: 'Cereal 750g', score: 0.51 },
        { sku: 'SKU-1001', name: 'Cereal 500g', score: 0.47 },
      ],
      assignedSku: null,
      evidenceKeys: ['evidence/obj-0002/crop-1.jpg'],
      state: 'REVIEW_REQUIRED',
      confidence: 0.51,
      revision: 1,
    },
    {
      objectId: 'obj-0003',
      sessionId: 'sess-review-002',
      trackIds: ['trk-04'],
      shelfPosition: 'x:0.55,y:0.40',
      candidateSkus: [],
      assignedSku: null,
      evidenceKeys: ['evidence/obj-0003/crop-1.jpg'],
      state: 'UNKNOWN',
      confidence: 0.12,
      revision: 1,
    },
    {
      objectId: 'obj-0004',
      sessionId: 'sess-review-002',
      trackIds: ['trk-05'],
      shelfPosition: 'x:0.62,y:0.41',
      candidateSkus: [{ sku: 'SKU-1003', name: 'Granola Bar Box', score: 0.88 }],
      assignedSku: 'SKU-1003',
      evidenceKeys: ['evidence/obj-0004/crop-1.jpg'],
      state: 'CONFIRMED',
      confidence: 0.88,
      revision: 1,
    },
  ],
  'sess-active-001': [
    {
      objectId: 'obj-1001',
      sessionId: 'sess-active-001',
      trackIds: ['trk-10'],
      shelfPosition: 'x:0.20,y:0.30',
      candidateSkus: [{ sku: 'SKU-2001', name: 'Sparkling Water 12pk', score: 0.9 }],
      assignedSku: 'SKU-2001',
      evidenceKeys: ['evidence/obj-1001/crop-1.jpg'],
      state: 'CONFIRMED',
      confidence: 0.9,
      revision: 1,
    },
  ],
  'sess-final-003': [
    {
      objectId: 'obj-2001',
      sessionId: 'sess-final-003',
      trackIds: ['trk-20'],
      shelfPosition: 'x:0.15,y:0.20',
      candidateSkus: [{ sku: 'SKU-3001', name: 'Pasta 500g', score: 0.97 }],
      assignedSku: 'SKU-3001',
      evidenceKeys: ['evidence/obj-2001/crop-1.jpg'],
      state: 'CONFIRMED',
      confidence: 0.97,
      revision: 1,
    },
    {
      objectId: 'obj-2002',
      sessionId: 'sess-final-003',
      trackIds: ['trk-21'],
      shelfPosition: 'x:0.28,y:0.20',
      candidateSkus: [{ sku: 'SKU-3001', name: 'Pasta 500g', score: 0.95 }],
      assignedSku: 'SKU-3001',
      evidenceKeys: ['evidence/obj-2002/crop-1.jpg'],
      state: 'CONFIRMED',
      confidence: 0.95,
      revision: 1,
    },
  ],
}

export const MOCK_REVIEW_TASKS: Record<string, ReviewTask[]> = {
  'sess-review-002': [
    {
      taskId: 'task-0001',
      sessionId: 'sess-review-002',
      objectId: 'obj-0002',
      reason: 'Low confidence: ambiguous between SKU-1001 and SKU-1002',
      status: 'OPEN',
      reviewerDecision: null,
    },
    {
      taskId: 'task-0002',
      sessionId: 'sess-review-002',
      objectId: 'obj-0003',
      reason: 'No SKU match found above threshold',
      status: 'OPEN',
      reviewerDecision: null,
    },
  ],
  'sess-active-001': [],
  'sess-final-003': [],
}

export function computeMockSummary(sessionId: string): SessionSummary {
  const observations = MOCK_OBSERVATIONS[sessionId] ?? []
  const session = MOCK_SESSIONS.find((s) => s.sessionId === sessionId)
  const counts = new Map<string, { name: string; count: number }>()
  let unknownCount = 0

  for (const obs of observations) {
    if (obs.state === 'CONFIRMED' && obs.assignedSku) {
      const existing = counts.get(obs.assignedSku)
      const name = obs.candidateSkus.find((c) => c.sku === obs.assignedSku)?.name ?? obs.assignedSku
      counts.set(obs.assignedSku, { name, count: (existing?.count ?? 0) + 1 })
    } else if (obs.state === 'UNKNOWN' || obs.state === 'REVIEW_REQUIRED') {
      unknownCount += 1
    }
  }

  return {
    sessionId,
    visibleCounts: Array.from(counts.entries()).map(([sku, v]) => ({
      sku,
      name: v.name,
      visibleCount: v.count,
    })),
    unknownCount,
    coverageStatus: session?.coverageStatus ?? 'UNKNOWN',
    generatedAt: new Date().toISOString(),
  }
}
