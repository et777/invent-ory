export type SessionState = 'ACTIVE' | 'REVIEW' | 'FINAL';

export type EventType = 'CONFIRM' | 'REVERSE' | 'REASSIGN' | 'MANUAL_ADJUST';

export type ItemStatus = 'accepted' | 'duplicate' | 'rejected';

export interface BatchItemResult {
  clientRequestId?: string;
  id: string;
  status: ItemStatus;
  reason?: string;
}

export interface Product {
  orgId: string;
  sku: string;
  name: string;
  barcode?: string;
  category?: string;
  catalogVersion: number;
  referenceImageKeys: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  orgId: string;
  sessionId: string;
  siteId: string;
  zone: string;
  shelf?: string;
  deviceId: string;
  operatorId: string;
  catalogVersion: number;
  modelVersion: string;
  state: SessionState;
  startedAt: string;
  endedAt?: string;
}

export interface Observation {
  sessionId: string;
  objectId: string;
  orgId: string;
  trackIds: string[];
  shelfPosition?: { x: number; y: number; z?: number };
  candidateSkus: Array<{ sku: string; score: number }>;
  evidenceKeys: string[];
  state: 'PROVISIONAL' | 'CONFIRMED' | 'UNKNOWN' | 'REVIEW_REQUIRED';
  revision: number;
  updatedAt: string;
}

export interface CountEvent {
  sessionId: string;
  eventId: string;
  orgId: string;
  objectId: string;
  type: EventType;
  sku?: string;
  fromSku?: string;
  quantityDelta: number;
  actor: string;
  reason?: string;
  evidence?: string[];
  timestamp: string;
}

export type ReviewTaskStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';

export interface ReviewTask {
  sessionId: string;
  taskId: string;
  orgId: string;
  objectId: string;
  reason: string;
  status: ReviewTaskStatus;
  candidateSkus?: Array<{ sku: string; score: number }>;
  reviewerDecision?: {
    actor: string;
    decidedAt: string;
    reason: string;
    resultingEventId?: string;
  };
}

export interface SummaryLine {
  sku: string;
  visibleCount: number;
}

export interface SessionSummary {
  sessionId: string;
  visibleCounts: SummaryLine[];
  unknownCount: number;
  coverageStatus: 'PARTIAL' | 'COMPLETE' | 'UNKNOWN';
  generatedAt: string;
  note: string;
}
