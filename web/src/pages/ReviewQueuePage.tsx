import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, type Observation, type ReviewTask } from '../api'
import { EvidenceThumbnail } from '../components/EvidenceThumbnail'
import { useAuth } from '../auth/AuthContext'

interface DraftDecision {
  newSku: string
  reason: string
}

export function ReviewQueuePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { username } = useAuth()
  const [tasks, setTasks] = useState<ReviewTask[]>([])
  const [observations, setObservations] = useState<Observation[]>([])
  const [drafts, setDrafts] = useState<Record<string, DraftDecision>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!sessionId) return
    Promise.all([api.getReviewTasks(sessionId), api.getObservations(sessionId)])
      .then(([t, obs]) => {
        setTasks(t)
        setObservations(obs)
      })
      .catch((e: Error) => setError(e.message))
  }, [sessionId])

  useEffect(() => {
    load()
  }, [load])

  function updateDraft(objectId: string, patch: Partial<DraftDecision>) {
    setDrafts((prev) => ({
      ...prev,
      [objectId]: { newSku: prev[objectId]?.newSku ?? '', reason: prev[objectId]?.reason ?? '', ...patch },
    }))
  }

  async function submitDecision(task: ReviewTask) {
    setSubmitError(null)
    const draft = drafts[task.objectId]
    if (!draft || !draft.reason.trim()) {
      setSubmitError('A reason is required before submitting a review decision.')
      return
    }
    if (!sessionId) return
    try {
      await api.submitReviewDecision(sessionId, {
        objectId: task.objectId,
        newSku: draft.newSku || undefined,
        reason: draft.reason,
      })
      load()
    } catch (e) {
      setSubmitError((e as Error).message)
    }
  }

  if (error) return <p className="error">{error}</p>

  const openTasks = tasks.filter((t) => t.status === 'OPEN')

  return (
    <div>
      <h2>Review queue</h2>
      <p className="muted">Reviewer: {username}. Every correction is recorded with who, when, and why.</p>
      {submitError && <p className="error">{submitError}</p>}
      {openTasks.length === 0 && <p>No open review tasks for this session.</p>}
      <ul className="review-list">
        {openTasks.map((task) => {
          const obs = observations.find((o) => o.objectId === task.objectId)
          const draft = drafts[task.objectId] ?? { newSku: '', reason: '' }
          return (
            <li key={task.taskId} className="card review-item">
              <div className="review-item-header">
                <strong>{task.objectId}</strong>
                <span className="muted">{task.reason}</span>
              </div>
              {obs && (
                <>
                  <div className="evidence-row">
                    {obs.evidenceKeys.map((k) => (
                      <EvidenceThumbnail key={k} evidenceKey={k} label="orig" />
                    ))}
                  </div>
                  <div className="muted">
                    Candidates: {obs.candidateSkus.map((c) => `${c.sku} (${(c.score * 100).toFixed(0)}%)`).join(', ') || 'none'}
                  </div>
                </>
              )}
              <div className="review-form">
                <label>
                  Reassign SKU
                  <input
                    value={draft.newSku}
                    placeholder={obs?.assignedSku ?? 'e.g. SKU-1001'}
                    onChange={(e) => updateDraft(task.objectId, { newSku: e.target.value })}
                  />
                </label>
                <label>
                  Reason (required)
                  <input
                    value={draft.reason}
                    onChange={(e) => updateDraft(task.objectId, { reason: e.target.value })}
                  />
                </label>
                <button onClick={() => submitDecision(task)}>Submit decision</button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
