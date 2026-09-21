export type SessionState = 'ACTIVE' | 'REVIEW' | 'FINAL'

export type ObservationState = 'PROVISIONAL' | 'CONFIRMED' | 'UNKNOWN' | 'REVIEW_REQUIRED'

export interface Session {
  sessionId: string
  siteId: string
  zone: string
  shelf: string
  deviceId: string
  operatorId: string
  catalogVersion: string
  modelVersion: string
  state: SessionState
  startedAt: string
  endedAt: string | null
  coverageStatus: 'COMPLETE' | 'GAPS_DETECTED' | 'UNKNOWN'
}

export interface CandidateSku {
  sku: string
  name: string
  score: number
}

export interface Observation {
  objectId: string
  sessionId: string
  trackIds: string[]
  shelfPosition: string
  candidateSkus: CandidateSku[]
  assignedSku: string | null
  evidenceKeys: string[]
  state: ObservationState
  confidence: number
  revision: number
}

export interface ReviewTask {
  taskId: string
  sessionId: string
  objectId: string
  reason: string
  status: 'OPEN' | 'RESOLVED'
  reviewerDecision: string | null
}

export type CountEventType = 'CONFIRM' | 'REVERSE' | 'REASSIGN' | 'MANUAL_ADJUST'

export interface CountEvent {
  eventId: string
  sessionId: string
  objectId: string
  type: CountEventType
  sku: string | null
  quantityDelta: number
  actor: string
  reason: string | null
  createdAt: string
}

export interface SkuCount {
  sku: string
  name: string
  visibleCount: number
}

export interface SessionSummary {
  sessionId: string
  visibleCounts: SkuCount[]
  unknownCount: number
  coverageStatus: 'COMPLETE' | 'GAPS_DETECTED' | 'UNKNOWN'
  generatedAt: string
}

export interface ReviewDecisionInput {
  objectId: string
  newSku?: string
  quantityDelta?: number
  reason: string
}
