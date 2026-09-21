import type { InventoryApi } from './client'
import type { Observation, ReviewDecisionInput, ReviewTask, Session, SessionSummary } from './types'
import {
  MOCK_OBSERVATIONS,
  MOCK_REVIEW_TASKS,
  MOCK_SESSIONS,
  computeMockSummary,
} from './mockData'

function delay<T>(value: T, ms = 150): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export class MockInventoryApi implements InventoryApi {
  async listSessions(): Promise<Session[]> {
    return delay([...MOCK_SESSIONS])
  }

  async getSession(sessionId: string): Promise<Session> {
    const session = MOCK_SESSIONS.find((s) => s.sessionId === sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    return delay(session)
  }

  async getObservations(sessionId: string): Promise<Observation[]> {
    return delay(MOCK_OBSERVATIONS[sessionId] ?? [])
  }

  async getReviewTasks(sessionId: string): Promise<ReviewTask[]> {
    return delay(MOCK_REVIEW_TASKS[sessionId] ?? [])
  }

  async getSummary(sessionId: string): Promise<SessionSummary> {
    return delay(computeMockSummary(sessionId))
  }

  async submitReviewDecision(sessionId: string, decision: ReviewDecisionInput): Promise<void> {
    const tasks = MOCK_REVIEW_TASKS[sessionId] ?? []
    const task = tasks.find((t) => t.objectId === decision.objectId)
    if (task) {
      task.status = 'RESOLVED'
      task.reviewerDecision = `${decision.newSku ? `reassigned to ${decision.newSku}` : 'adjusted'}: ${decision.reason}`
    }
    const observations = MOCK_OBSERVATIONS[sessionId] ?? []
    const obs = observations.find((o) => o.objectId === decision.objectId)
    if (obs) {
      if (decision.newSku) obs.assignedSku = decision.newSku
      obs.state = 'CONFIRMED'
      obs.revision += 1
    }
    return delay(undefined)
  }

  async finalizeSession(sessionId: string): Promise<void> {
    const openTasks = (MOCK_REVIEW_TASKS[sessionId] ?? []).filter((t) => t.status === 'OPEN')
    if (openTasks.length > 0) {
      throw new Error('Cannot finalize: open review tasks remain')
    }
    const session = MOCK_SESSIONS.find((s) => s.sessionId === sessionId)
    if (session) session.state = 'FINAL'
    return delay(undefined)
  }

  async exportSessionCsv(sessionId: string): Promise<string> {
    const summary = computeMockSummary(sessionId)
    const header = 'sku,name,visibleCount,unknownCount,coverageStatus,timestamp'
    const rows = summary.visibleCounts.map(
      (c) => `${c.sku},${c.name},${c.visibleCount},${summary.unknownCount},${summary.coverageStatus},${summary.generatedAt}`,
    )
    if (rows.length === 0) {
      rows.push(`,,0,${summary.unknownCount},${summary.coverageStatus},${summary.generatedAt}`)
    }
    return delay([header, ...rows].join('\n'))
  }
}
