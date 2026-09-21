import type {
  Observation,
  ReviewDecisionInput,
  ReviewTask,
  Session,
  SessionSummary,
} from './types'

/**
 * Shared data-access contract. The real client and the mock client both
 * implement this so switching VITE_USE_MOCK is a one-line config change.
 */
export interface InventoryApi {
  listSessions(): Promise<Session[]>
  getSession(sessionId: string): Promise<Session>
  getObservations(sessionId: string): Promise<Observation[]>
  getReviewTasks(sessionId: string): Promise<ReviewTask[]>
  getSummary(sessionId: string): Promise<SessionSummary>
  submitReviewDecision(sessionId: string, decision: ReviewDecisionInput): Promise<void>
  finalizeSession(sessionId: string): Promise<void>
  exportSessionCsv(sessionId: string): Promise<string>
}

export function getAuthToken(): string | null {
  return sessionStorage.getItem('inventory_auth_token')
}

export function setAuthToken(token: string): void {
  sessionStorage.setItem('inventory_auth_token', token)
}

export function clearAuthToken(): void {
  sessionStorage.removeItem('inventory_auth_token')
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken()
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText} (${path})`)
  }
  return res.json() as Promise<T>
}

export class HttpInventoryApi implements InventoryApi {
  listSessions(): Promise<Session[]> {
    return request('/sessions')
  }

  getSession(sessionId: string): Promise<Session> {
    return request(`/sessions/${sessionId}`)
  }

  getObservations(sessionId: string): Promise<Observation[]> {
    return request(`/sessions/${sessionId}/observations`)
  }

  getReviewTasks(sessionId: string): Promise<ReviewTask[]> {
    return request(`/sessions/${sessionId}/review-tasks`)
  }

  getSummary(sessionId: string): Promise<SessionSummary> {
    return request(`/sessions/${sessionId}/summary`)
  }

  submitReviewDecision(sessionId: string, decision: ReviewDecisionInput): Promise<void> {
    return request(`/sessions/${sessionId}/review-decisions`, {
      method: 'POST',
      body: JSON.stringify(decision),
    })
  }

  finalizeSession(sessionId: string): Promise<void> {
    return request(`/sessions/${sessionId}/finalize`, { method: 'POST' })
  }

  async exportSessionCsv(sessionId: string): Promise<string> {
    const token = getAuthToken()
    const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      throw new Error(`Export failed: ${res.status} ${res.statusText}`)
    }
    return res.text()
  }
}
